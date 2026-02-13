import SwiftUI

/// Sheet that lists report runs for a job and presents SignatureCaptureSheet to add signatures.
/// Save handler calls APIClient.createSignature to persist the signature.
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

    private let packetType = "insurance"
    private let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        return f
    }()

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
                    RMEmptyState(
                        icon: "doc.badge.plus",
                        title: "No Report Runs",
                        message: "Generate a Risk Snapshot report from the Export section to create a report run, then add signatures here."
                    )
                    .padding(RMTheme.Spacing.pagePadding)
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
            .alert("Team Signatures", isPresented: .constant(errorMessage != nil)) {
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
                    onSave: { data in
                        Task {
                            await submitSignature(reportRunId: ctx.run.id, role: ctx.role, data: data)
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

    private var runsList: some View {
        ScrollView(showsIndicators: false) {
            LazyVStack(spacing: RMTheme.Spacing.md) {
                ForEach(runs) { run in
                    ReportRunCard(
                        run: run,
                        signatures: signaturesByRunId[run.id] ?? [],
                        dateFormatter: dateFormatter,
                        onSignAs: { role in
                            Haptics.tap()
                            signingContext = SigningContext(run: run, role: role)
                        },
                        canSign: run.status == "ready_for_signatures"
                    )
                }
            }
            .padding(RMTheme.Spacing.pagePadding)
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
            // Prefer runs ready for signatures at top
            runs.sort { r1, r2 in
                if r1.status == "ready_for_signatures", r2.status != "ready_for_signatures" { return true }
                if r1.status != "ready_for_signatures", r2.status == "ready_for_signatures" { return false }
                return r1.generatedAt > r2.generatedAt
            }
            for run in runs {
                let sigs = (try? await APIClient.shared.getSignatures(reportRunId: run.id)) ?? []
                signaturesByRunId[run.id] = sigs
            }
        } catch {
            errorMessage = error.localizedDescription
            runs = []
        }
    }

    @MainActor
    private func submitSignature(reportRunId: String, role: SignatureRole, data: SignatureCaptureData) async {
        isSubmitting = true
        defer {
            isSubmitting = false
            signingContext = nil
        }
        do {
            _ = try await APIClient.shared.createSignature(
                reportRunId: reportRunId,
                signerName: data.signerName,
                signerTitle: data.signerTitle,
                signatureRole: role,
                signatureSvg: data.signatureSvg,
                attestationText: data.attestationText
            )
            ToastCenter.shared.show("Signature saved", systemImage: "checkmark.circle.fill", style: .success)
            await loadRuns()
        } catch {
            errorMessage = error.localizedDescription
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
