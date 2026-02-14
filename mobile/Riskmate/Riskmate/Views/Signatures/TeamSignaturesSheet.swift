import SwiftUI

/// Sheet that lists report runs for a job and presents SignatureCaptureSheet to add signatures.
/// Save handler calls APIClient.createSignature to persist the signature.
/// Sign-as buttons are gated by role/entitlement (RBAC); 403/409 from createSignature show an error and keep the sheet open.
struct TeamSignaturesSheet: View {
    let jobId: String
    let onDismiss: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var runs: [ReportRun] = []
    @State private var signaturesByRunId: [String: [ReportSignature]] = [:]
    @State private var isLoading = true
    @State private var errorMessage: String?
    /// When non-nil, SignatureCaptureSheet is presented for this run and role.
    @State private var signingContext: SigningContext?
    @State private var isSubmitting = false
    /// Get-or-create active run (empty state or when no run exists).
    @State private var isCreatingRun = false

    private let packetType = "insurance"
    private var rbac: RBAC {
        let role = EntitlementsManager.shared.getEntitlements()?.role
        return RBAC(role: role)
    }
    private func canSignAs(_ role: SignatureRole) -> Bool {
        rbac.canSignAsReportRole(role.rawValue)
    }
    private let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        return f
    }()
    private var hasSignableRun: Bool {
        runs.contains { $0.status == "draft" || $0.status == "ready_for_signatures" }
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    VStack(spacing: RMTheme.Spacing.lg) {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: RMTheme.Colors.accent))
                        Text("Loading report runs…")
                            .font(RMTheme.Typography.body)
                            .foregroundColor(RMTheme.Colors.textSecondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let err = errorMessage {
                    VStack(spacing: RMTheme.Spacing.lg) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.system(size: 48))
                            .foregroundColor(RMTheme.Colors.error)
                        Text(err)
                            .font(RMTheme.Typography.bodySmall)
                            .foregroundColor(RMTheme.Colors.textSecondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                        Button("Retry") {
                            Task { await loadRuns() }
                        }
                        .font(RMTheme.Typography.bodyBold)
                        .foregroundColor(RMTheme.Colors.accent)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if runs.isEmpty {
                    emptyStateView
                } else {
                    runsList
                }
            }
            .background(RMTheme.Colors.background)
            .navigationTitle("Team Signatures")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        Haptics.tap()
                        onDismiss()
                        dismiss()
                    }
                    .foregroundColor(RMTheme.Colors.accent)
                }
            }
            .alert("Team Signatures", isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )) {
                Button("OK") { errorMessage = nil }
            } message: {
                if let msg = errorMessage {
                    Text(msg)
                }
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
                    if !isSubmitting {
                        signingContext = nil
                    }
                }
            }
            .task {
                await loadRuns()
            }
            .refreshable {
                await loadRuns()
            }
        }
    }

    private var emptyStateView: some View {
        VStack(spacing: RMTheme.Spacing.lg) {
            RMEmptyState(
                icon: "doc.badge.plus",
                title: "No Report Runs",
                message: "Create a report run to add team signatures, or generate a Risk Snapshot from the Export section."
            )
            Button {
                Haptics.tap()
                Task { await ensureActiveRunThenRefresh() }
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
            // Optional: "Sign as …" when no run exists — get-or-create then open capture sheet for selected role
            HStack(spacing: RMTheme.Spacing.sm) {
                ForEach([SignatureRole.preparedBy, .reviewedBy, .approvedBy], id: \.self) { role in
                    if canSignAs(role) {
                        Button {
                            Haptics.tap()
                            Task { await ensureActiveRunThenSignAs(role) }
                        } label: {
                            Text("Sign as \(role.displayTitle)")
                                .font(RMTheme.Typography.captionBold)
                        }
                        .buttonStyle(.bordered)
                        .tint(RMTheme.Colors.accent)
                        .disabled(isCreatingRun)
                    }
                }
            }
        }
        .padding(RMTheme.Spacing.pagePadding)
    }

    private var runsList: some View {
        ScrollView(showsIndicators: false) {
            LazyVStack(spacing: RMTheme.Spacing.md) {
                if !hasSignableRun && !runs.isEmpty {
                    Button {
                        Haptics.tap()
                        Task { await createNewSignableRun() }
                    } label: {
                        HStack {
                            if isCreatingRun {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: RMTheme.Colors.accent))
                            } else {
                                Text("Create new signable run")
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, RMTheme.Spacing.sm)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(RMTheme.Colors.accent)
                    .disabled(isCreatingRun)
                }
                ForEach(runs) { run in
                    ReportRunCard(
                        run: run,
                        signatures: signaturesByRunId[run.id] ?? [],
                        dateFormatter: dateFormatter,
                        onSignAs: { role in
                            Haptics.tap()
                            signingContext = SigningContext(run: run, role: role)
                        },
                        canSign: run.status == "draft" || run.status == "ready_for_signatures",
                        canSignAsRole: canSignAs
                    )
                }
            }
            .padding(RMTheme.Spacing.pagePadding)
        }
    }

    @MainActor
    private func ensureActiveRunThenRefresh() async {
        isCreatingRun = true
        errorMessage = nil
        defer { isCreatingRun = false }
        do {
            _ = try await APIClient.shared.getActiveReportRun(jobId: jobId, packetType: packetType, forceNew: false)
            await loadRuns()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Create a new signable run when existing runs are non-signable (Manage Runs sheet). Refreshes runs and signatures via loadRuns().
    @MainActor
    private func createNewSignableRun() async {
        isCreatingRun = true
        errorMessage = nil
        defer { isCreatingRun = false }
        do {
            _ = try await APIClient.shared.getActiveReportRun(jobId: jobId, packetType: packetType, forceNew: true)
            await loadRuns()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Get-or-create active run then present SignatureCaptureSheet for the given role (e.g. from empty state "Sign as …").
    /// If the fetched run is not signable (e.g. finalized), creates a new signable run with forceNew: true and uses that.
    @MainActor
    private func ensureActiveRunThenSignAs(_ role: SignatureRole) async {
        isCreatingRun = true
        errorMessage = nil
        defer { isCreatingRun = false }
        do {
            var (run, _) = try await APIClient.shared.getActiveReportRun(jobId: jobId, packetType: packetType, forceNew: false)
            let isSignable = run.status == "draft" || run.status == "ready_for_signatures"
            if !isSignable {
                (run, _) = try await APIClient.shared.getActiveReportRun(jobId: jobId, packetType: packetType, forceNew: true)
            }
            await loadRuns()
            if run.status == "draft" || run.status == "ready_for_signatures" {
                signingContext = SigningContext(run: run, role: role)
            } else {
                ToastCenter.shared.show("Could not create a signable run", systemImage: "exclamationmark.triangle", style: .error)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func loadRuns() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            runs = try await APIClient.shared.getReportRuns(
                jobId: jobId,
                packetType: packetType,
                limit: 20,
                status: nil
            )
            // Prefer signable runs (draft, ready_for_signatures) at top; then by date
            runs.sort { r1, r2 in
                let signable1 = r1.status == "draft" || r1.status == "ready_for_signatures"
                let signable2 = r2.status == "draft" || r2.status == "ready_for_signatures"
                if signable1, !signable2 { return true }
                if !signable1, signable2 { return false }
                if signable1, signable2 {
                    // Within signable: ready_for_signatures before draft, then newest first
                    if r1.status == "ready_for_signatures", r2.status != "ready_for_signatures" { return true }
                    if r1.status != "ready_for_signatures", r2.status == "ready_for_signatures" { return false }
                }
                return r1.generatedAt > r2.generatedAt
            }
            var collected: [String: [ReportSignature]] = [:]
            await withTaskGroup(of: (String, [ReportSignature]).self) { group in
                for run in runs {
                    group.addTask {
                        let sigs = (try? await APIClient.shared.getSignatures(reportRunId: run.id)) ?? []
                        return (run.id, sigs)
                    }
                }
                for await (runId, sigs) in group {
                    collected[runId] = sigs
                }
            }
            signaturesByRunId = collected
        } catch {
            errorMessage = error.localizedDescription
            runs = []
        }
    }

    @MainActor
    private func submitSignature(reportRunId: String, role: SignatureRole, data: SignatureCaptureData, completion: @escaping (Result<Void, Error>) -> Void) async {
        isSubmitting = true
        defer { isSubmitting = false }
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
            await loadRuns()
            completion(.success(()))
        } catch let error as APIError {
            let code = error.statusCode ?? 0
            if code == 403 || code == 409 {
                errorMessage = error.localizedDescription
                completion(.failure(error))
                return
            }
            errorMessage = error.localizedDescription
            completion(.failure(error))
        } catch {
            errorMessage = error.localizedDescription
            completion(.failure(error))
        }
    }
}

// MARK: - Signing context (run + role for sheet)

private struct SigningContext: Identifiable {
    let run: ReportRun
    let role: SignatureRole
    var id: String { run.id + role.rawValue }
}

// MARK: - Report run card

private struct ReportRunCard: View {
    let run: ReportRun
    let signatures: [ReportSignature]
    let dateFormatter: DateFormatter
    let onSignAs: (SignatureRole) -> Void
    let canSign: Bool
    /// When provided, each "Sign as" button is only enabled when this returns true for that role (and not already signed).
    var canSignAsRole: ((SignatureRole) -> Bool) = { _ in true }

    var body: some View {
        VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Report run")
                        .font(RMTheme.Typography.captionSmall)
                        .foregroundColor(RMTheme.Colors.textTertiary)
                    Text(dateFormatter.string(from: run.generatedAt))
                        .font(RMTheme.Typography.bodySmallBold)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                }
                Spacer()
                statusBadge
            }

            if !signatures.isEmpty {
                Text("\(signatures.count) signature(s): \(signatures.map(\.signerName).joined(separator: ", "))")
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                    .lineLimit(2)
            }

            if canSign {
                HStack(spacing: RMTheme.Spacing.sm) {
                    ForEach([SignatureRole.preparedBy, .reviewedBy, .approvedBy], id: \.self) { role in
                        let alreadySigned = signatures.contains { $0.signatureRole == role.rawValue }
                        let allowed = canSignAsRole(role)
                        if allowed {
                            Button {
                                onSignAs(role)
                            } label: {
                                Text("Sign as \(role.displayTitle)")
                                    .font(RMTheme.Typography.captionBold)
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(RMTheme.Colors.accent)
                            .disabled(alreadySigned)
                        }
                    }
                }
            } else {
                Text("Status: \(run.status)")
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(RMTheme.Colors.textTertiary)
            }
        }
        .padding(RMTheme.Spacing.md)
        .background(RMTheme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: RMTheme.Radius.sm, style: .continuous)
                .stroke(RMTheme.Colors.border, lineWidth: 1)
        )
    }

    private var statusBadge: some View {
        Text(run.status.replacingOccurrences(of: "_", with: " "))
            .font(RMTheme.Typography.captionSmall)
            .foregroundColor(statusColor)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(statusColor.opacity(0.15))
            .clipShape(Capsule())
    }

    private var statusColor: Color {
        switch run.status {
        case "ready_for_signatures": return RMTheme.Colors.accent
        case "final", "complete": return RMTheme.Colors.success
        case "draft": return RMTheme.Colors.textTertiary
        default: return RMTheme.Colors.textSecondary
        }
    }
}

// MARK: - Preview

#Preview {
    TeamSignaturesSheet(jobId: "preview-job", onDismiss: {})
}
