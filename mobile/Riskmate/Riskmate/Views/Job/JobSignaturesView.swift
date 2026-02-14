import SwiftUI
import WebKit

/// Signatures tab content: 3 signature cards (Prepared By, Reviewed By, Approved By),
/// report run banner, Sign Now → SignatureCaptureSheet, SVG display, role-based permissions.
struct JobSignaturesView: View {
    let jobId: String
    /// Job creator user id (job.createdBy). Used so only creator or admins can sign as Prepared By.
    var jobCreatorId: String? = nil
    /// When all three roles are signed, call to open export (e.g. Proof Pack).
    var onExportTapped: (() -> Void)? = nil

    @State private var activeRun: ReportRun?
    @State private var signatures: [ReportSignature] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var signaturesErrorMessage: String?
    @State private var isLoadingSignatures = false
    @State private var signingContext: SigningContext?
    @State private var isCreatingRun = false
    @State private var showManageRunsSheet = false

    private let packetType = "insurance"
    private var rbac: RBAC {
        let role = EntitlementsManager.shared.getEntitlements()?.role
        return RBAC(role: role)
    }
    private var currentUserId: String {
        SessionManager.shared.currentUser?.id ?? ""
    }
    private func signatureInfos(from sigs: [ReportSignature]) -> [RBAC.SignatureInfo] {
        sigs.map { RBAC.SignatureInfo(signatureRole: $0.signatureRole, signerUserId: $0.signerUserId) }
    }
    private func canSignAsReportRole(_ role: SignatureRole, existingSignatures: [ReportSignature]) -> Bool {
        rbac.canSignAsReportRole(role.rawValue, currentUserId: currentUserId, jobCreatorId: jobCreatorId, existingSignatures: signatureInfos(from: existingSignatures))
    }
    private let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        return f
    }()
    private let relativeFormatter: RelativeDateTimeFormatter = {
        let f = RelativeDateTimeFormatter()
        f.unitsStyle = .abbreviated
        return f
    }()

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.sectionSpacing) {
                if isLoading {
                    VStack(spacing: RMTheme.Spacing.lg) {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: RMTheme.Colors.accent))
                        Text("Loading signatures…")
                            .font(RMTheme.Typography.body)
                            .foregroundColor(RMTheme.Colors.textSecondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, RMTheme.Spacing.xxl)
                } else if let err = errorMessage {
                    VStack(spacing: RMTheme.Spacing.md) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.system(size: 40))
                            .foregroundColor(RMTheme.Colors.error)
                        Text(err)
                            .font(RMTheme.Typography.bodySmall)
                            .foregroundColor(RMTheme.Colors.textSecondary)
                            .multilineTextAlignment(.center)
                        Button("Retry") {
                            Task { await loadData() }
                        }
                        .font(RMTheme.Typography.bodyBold)
                        .foregroundColor(RMTheme.Colors.accent)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, RMTheme.Spacing.xxl)
                } else if activeRun == nil {
                    emptyStateView
                } else if let run = activeRun {
                    reportRunBanner(run: run)
                    if !isRunSignable(run.status) {
                        createNewRunSection
                    }
                    if let sigErr = signaturesErrorMessage {
                        signaturesErrorBanner(message: sigErr, isLoading: isLoadingSignatures) {
                            Task { await retrySignaturesFetch() }
                        }
                    }
                    ForEach([SignatureRole.preparedBy, .reviewedBy, .approvedBy], id: \.self) { role in
                        signatureCard(
                            role: role,
                            signature: signatures.first { $0.signatureRole == role.rawValue },
                            run: run
                        )
                    }
                    if allSigned {
                        exportSection
                    }
                }
            }
            .padding(.horizontal, RMTheme.Spacing.pagePadding)
            .padding(.vertical, RMTheme.Spacing.lg)
        }
        .refreshable {
            await loadData()
        }
        .task(id: jobId) {
            await loadData()
        }
        .sheet(item: $signingContext) { ctx in
            SignatureCaptureSheet(
                role: ctx.role,
                reportRunId: ctx.run.id,
                reportRunHash: ctx.run.dataHash,
                reportRunCreatedAt: dateFormatter.string(from: ctx.run.generatedAt),
                onSave: { data, completion in
                    Task {
                        await submitSignature(reportRunId: ctx.run.id, role: ctx.role, data: data, completion: completion)
                    }
                },
                onCancel: {
                    signingContext = nil
                }
            )
            .onDisappear {
                signingContext = nil
            }
        }
        .sheet(isPresented: $showManageRunsSheet) {
            TeamSignaturesSheet(jobId: jobId, jobCreatorId: jobCreatorId) {
                showManageRunsSheet = false
                Task { await loadData() }
            }
        }
        .onChange(of: showManageRunsSheet) { _, showing in
            if !showing { Task { await loadData() } }
        }
        .alert("Signatures", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK") { errorMessage = nil }
        } message: {
            if let msg = errorMessage {
                Text(msg)
            }
        }
    }

    private func isRunSignable(_ status: String) -> Bool {
        status == "draft" || status == "ready_for_signatures"
    }

    private var createNewRunSection: some View {
        Button {
            Haptics.tap()
            Task { await createNewRunAndRefresh() }
        } label: {
            HStack {
                if isCreatingRun {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                } else {
                    Image(systemName: "arrow.clockwise")
                    Text("Create new run")
                        .font(RMTheme.Typography.bodySmallBold)
                }
            }
            .foregroundColor(.black)
            .frame(maxWidth: .infinity)
            .padding(.vertical, RMTheme.Spacing.sm)
            .background(RMTheme.Colors.accent)
            .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
        }
        .buttonStyle(.plain)
        .disabled(isCreatingRun)
    }

    private var allSigned: Bool {
        let roles: [SignatureRole] = [.preparedBy, .reviewedBy, .approvedBy]
        return roles.allSatisfy { role in
            signatures.contains { $0.signatureRole == role.rawValue }
        }
    }

    private var emptyStateView: some View {
        VStack(spacing: RMTheme.Spacing.lg) {
            RMEmptyState(
                icon: "doc.badge.plus",
                title: "No Report Run",
                message: "Create a report run to add team signatures. You can generate a Risk Snapshot from the job menu (⋮) → Export."
            )
            Button {
                Haptics.tap()
                Task { await ensureActiveRun() }
            } label: {
                HStack {
                    if isCreatingRun {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    } else {
                        Text("Create report run")
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, RMTheme.Spacing.sm)
            }
            .buttonStyle(.borderedProminent)
            .tint(RMTheme.Colors.accent)
            .disabled(isCreatingRun)
        }
        .padding(.vertical, RMTheme.Spacing.xl)
    }

    private func signaturesErrorBanner(message: String, isLoading: Bool, onRetry: @escaping () -> Void) -> some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                HStack(alignment: .center, spacing: RMTheme.Spacing.sm) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 20))
                        .foregroundColor(RMTheme.Colors.error)
                    Text(message)
                        .font(RMTheme.Typography.bodySmall)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                        .multilineTextAlignment(.leading)
                    Spacer(minLength: 0)
                    Button("Retry") {
                        Haptics.tap()
                        onRetry()
                    }
                    .font(RMTheme.Typography.bodySmallBold)
                    .foregroundColor(RMTheme.Colors.accent)
                    .disabled(isLoading)
                }
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: RMTheme.Colors.accent))
                        .frame(maxWidth: .infinity)
                }
            }
        }
    }

    private func reportRunBanner(run: ReportRun) -> some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.xs) {
                HStack {
                    Text("Report run")
                        .font(RMTheme.Typography.captionSmall)
                        .foregroundColor(RMTheme.Colors.textTertiary)
                    Spacer()
                    Button {
                        Haptics.tap()
                        showManageRunsSheet = true
                    } label: {
                        Text("Manage runs")
                            .font(RMTheme.Typography.captionSmall)
                            .foregroundColor(RMTheme.Colors.accent)
                    }
                    .buttonStyle(.plain)
                    Text(run.status.replacingOccurrences(of: "_", with: " "))
                        .font(RMTheme.Typography.captionSmall)
                        .foregroundColor(statusColor(run.status))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(statusColor(run.status).opacity(0.15))
                        .clipShape(Capsule())
                }
                Text("Generated \(dateFormatter.string(from: run.generatedAt))")
                    .font(RMTheme.Typography.bodySmall)
                    .foregroundColor(RMTheme.Colors.textSecondary)
            }
        }
    }

    private func signatureCard(role: SignatureRole, signature: ReportSignature?, run: ReportRun) -> some View {
        let signaturesUnavailable = signaturesErrorMessage != nil || isLoadingSignatures
        let canSign = !signaturesUnavailable && (run.status == "draft" || run.status == "ready_for_signatures") && canSignAsReportRole(role, existingSignatures: signatures)
        let alreadySigned = signature != nil

        return RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                HStack {
                    Text(role.displayTitle)
                        .font(RMTheme.Typography.bodySmallBold)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    Spacer()
                    statusBadge(signed: alreadySigned)
                }

                if let sig = signature {
                    signedContent(signature: sig)
                } else {
                    unsignedContent(role: role, canSign: canSign)
                }

                if canSign && !alreadySigned {
                    Button {
                        Haptics.tap()
                        signingContext = SigningContext(run: run, role: role)
                    } label: {
                        HStack {
                            Image(systemName: "pencil.circle.fill")
                            Text("Sign Now")
                                .font(RMTheme.Typography.bodySmallBold)
                        }
                        .foregroundColor(.black)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, RMTheme.Spacing.sm)
                        .background(RMTheme.Colors.accent)
                        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func statusBadge(signed: Bool) -> some View {
        Text(signed ? "Signed" : "Pending")
            .font(RMTheme.Typography.captionSmall)
            .foregroundColor(signed ? RMTheme.Colors.success : RMTheme.Colors.textTertiary)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background((signed ? RMTheme.Colors.success : RMTheme.Colors.inputFill).opacity(0.2))
            .clipShape(Capsule())
    }

    private func signedContent(signature: ReportSignature) -> some View {
        VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
            if let svg = signature.signatureSvg, !svg.isEmpty {
                SignatureSvgView(svgString: svg)
                    .frame(height: 56)
                    .frame(maxWidth: .infinity)
                    .background(RMTheme.Colors.inputFill.opacity(0.3))
                    .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.xs))
            }
            Text(signature.signerName)
                .font(RMTheme.Typography.bodySmallBold)
                .foregroundColor(RMTheme.Colors.textPrimary)
            Text(signature.signerTitle)
                .font(RMTheme.Typography.caption)
                .foregroundColor(RMTheme.Colors.textSecondary)
            if let date = signature.signedAt {
                Text("Signed \(relativeFormatter.localizedString(for: date, relativeTo: Date()))")
                    .font(RMTheme.Typography.captionSmall)
                    .foregroundColor(RMTheme.Colors.textTertiary)
            }
        }
    }

    private func unsignedContent(role: SignatureRole, canSign: Bool) -> some View {
        VStack(alignment: .leading, spacing: RMTheme.Spacing.xs) {
            RoundedRectangle(cornerRadius: RMTheme.Radius.xs)
                .stroke(RMTheme.Colors.border, style: StrokeStyle(lineWidth: 1, dash: [6]))
                .frame(height: 48)
                .overlay {
                    Text("No signature")
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.textTertiary)
                }
            Text(canSign ? "You can sign as \(role.displayTitle)" : "Unassigned or you don’t have permission")
                .font(RMTheme.Typography.captionSmall)
                .foregroundColor(RMTheme.Colors.textTertiary)
        }
    }

    private var exportSection: some View {
        VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
            Text("All signatures complete")
                .font(RMTheme.Typography.bodySmallBold)
                .foregroundColor(RMTheme.Colors.success)
            if let onExportTapped = onExportTapped {
                Button {
                    Haptics.tap()
                    onExportTapped()
                } label: {
                    HStack {
                        Image(systemName: "square.and.arrow.up")
                        Text("Export Proof Pack")
                            .font(RMTheme.Typography.bodySmallBold)
                    }
                    .foregroundColor(.black)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, RMTheme.Spacing.sm)
                    .background(RMTheme.Colors.accent)
                    .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.top, RMTheme.Spacing.sm)
    }

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "ready_for_signatures": return RMTheme.Colors.accent
        case "final", "complete": return RMTheme.Colors.success
        case "draft": return RMTheme.Colors.textTertiary
        default: return RMTheme.Colors.textSecondary
        }
    }

    @MainActor
    private func loadData() async {
        isLoading = true
        errorMessage = nil
        signaturesErrorMessage = nil
        defer { isLoading = false }
        let run: ReportRun
        do {
            let (fetchedRun, _) = try await APIClient.shared.getActiveReportRun(jobId: jobId, packetType: packetType, forceNew: false)
            run = fetchedRun
            activeRun = run
        } catch {
            errorMessage = error.localizedDescription
            activeRun = nil
            signatures = []
            return
        }
        do {
            let sigs = try await APIClient.shared.getSignatures(reportRunId: run.id)
            signatures = sigs
            signaturesErrorMessage = nil
        } catch {
            signaturesErrorMessage = error.localizedDescription
            signatures = []
        }
    }

    /// Retry only the signatures fetch; keeps activeRun and main view usable.
    @MainActor
    private func retrySignaturesFetch() async {
        guard let run = activeRun else { return }
        isLoadingSignatures = true
        signaturesErrorMessage = nil
        defer { isLoadingSignatures = false }
        do {
            let sigs = try await APIClient.shared.getSignatures(reportRunId: run.id)
            signatures = sigs
            signaturesErrorMessage = nil
        } catch {
            signaturesErrorMessage = error.localizedDescription
            signatures = []
        }
    }

    @MainActor
    private func ensureActiveRun() async {
        isCreatingRun = true
        errorMessage = nil
        defer { isCreatingRun = false }
        do {
            let (run, _) = try await APIClient.shared.getActiveReportRun(jobId: jobId, packetType: packetType, forceNew: false)
            activeRun = run
            let sigs = try await APIClient.shared.getSignatures(reportRunId: run.id)
            signatures = sigs
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Force-create a new report run when current run is non-signable (e.g. final/complete), then refresh.
    @MainActor
    private func createNewRunAndRefresh() async {
        isCreatingRun = true
        errorMessage = nil
        defer { isCreatingRun = false }
        do {
            let (run, _) = try await APIClient.shared.getActiveReportRun(jobId: jobId, packetType: packetType, forceNew: true)
            activeRun = run
            let sigs = try await APIClient.shared.getSignatures(reportRunId: run.id)
            signatures = sigs
            ToastCenter.shared.show("New report run created", systemImage: "checkmark.circle.fill", style: .success)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func submitSignature(reportRunId: String, role: SignatureRole, data: SignatureCaptureData, completion: @escaping (Result<Void, Error>) -> Void) async {
        do {
            _ = try await APIClient.shared.createSignature(
                reportRunId: reportRunId,
                signerName: data.signerName,
                signerTitle: data.signerTitle,
                signatureRole: role,
                signatureSvg: data.signatureSvg,
                attestationText: data.attestationText
            )
            signingContext = nil
            ToastCenter.shared.show("Signature saved", systemImage: "checkmark.circle.fill", style: .success)
            await loadData()
            completion(.success(()))
        } catch let error as APIError {
            let code = error.statusCode ?? 0
            if code == 403 || code == 409 {
                errorMessage = error.localizedDescription
            } else {
                errorMessage = error.localizedDescription
            }
            completion(.failure(error))
        } catch {
            errorMessage = error.localizedDescription
            completion(.failure(error))
        }
    }
}

// MARK: - Signing context

private struct SigningContext: Identifiable {
    let run: ReportRun
    let role: SignatureRole
    var id: String { run.id + role.rawValue }
}

// MARK: - SVG signature display

private struct SignatureSvgView: UIViewRepresentable {
    let svgString: String

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.dataDetectorTypes = []
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        let html = """
        <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"/><style>
        *{margin:0;padding:0}body{background:transparent;display:flex;align-items:center;justify-content:center;min-height:100%%}
        svg{max-width:100%%;max-height:100%%;object-fit:contain}
        </style></head><body>\(svgString)</body></html>
        """
        webView.loadHTMLString(html, baseURL: nil)
    }
}

// MARK: - Preview

#Preview {
    ScrollView {
        JobSignaturesView(jobId: "preview-job")
    }
}
