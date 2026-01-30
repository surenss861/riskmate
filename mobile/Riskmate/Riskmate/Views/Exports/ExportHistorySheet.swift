import SwiftUI

/// Export history for a job: list from API, tap failed → FailedExportSheet, tap ready → open download.
/// Opened from Job Detail ••• menu → "Export History".
struct ExportHistorySheet: View {
    let jobId: String
    @EnvironmentObject private var quickAction: QuickActionRouter
    @Environment(\.dismiss) private var dismiss

    @State private var exports: [Export] = []
    @State private var loading = true
    @State private var error: String?
    @State private var selectedFailedExport: Export?
    @State private var loadToken = UUID()

    var body: some View {
        NavigationStack {
            Group {
                if loading {
                    loadingState
                } else if let err = error {
                    errorState(err)
                } else if exports.isEmpty {
                    emptyState
                } else {
                    exportsList
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(RMBackground())
            .navigationTitle("Export History")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        Haptics.tap()
                        dismiss()
                    }
                    .foregroundColor(RMTheme.Colors.accent)
                }
            }
            .sheet(item: $selectedFailedExport) { export in
                failedSheet(for: export)
            }
        }
        .task {
            await loadExports()
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - States

    private var loadingState: some View {
        VStack(spacing: RMTheme.Spacing.lg) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: RMTheme.Colors.accent))
            Text("Loading exports…")
                .font(RMTheme.Typography.body)
                .foregroundColor(RMTheme.Colors.textSecondary)
        }
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: RMTheme.Spacing.lg) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 48))
                .foregroundColor(RMTheme.Colors.error)
            Text("Failed to load exports")
                .font(RMTheme.Typography.title3)
                .foregroundColor(RMTheme.Colors.textPrimary)
            Text(message)
                .font(RMTheme.Typography.bodySmall)
                .foregroundColor(RMTheme.Colors.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            RMButton(title: "Try Again", action: {
                Task { await loadExports() }
            })
        }
        .padding(RMTheme.Spacing.xl)
    }

    private var emptyState: some View {
        RMEmptyState(
            icon: "tray",
            title: "No exports yet",
            message: "Export history will appear here once you generate your first report or proof pack.",
            action: RMEmptyStateAction(title: "Close", action: { dismiss() })
        )
    }

    private var exportsList: some View {
        ScrollView(showsIndicators: false) {
            LazyVStack(spacing: RMTheme.Spacing.md) {
                ForEach(exports) { export in
                    ExportHistoryRow(export: export)
                        .onTapGesture {
                            Haptics.tap()
                            handleExportTap(export)
                        }
                }
            }
            .padding(RMTheme.Spacing.pagePadding)
        }
    }

    // MARK: - Failed sheet

    private func failedSheet(for export: Export) -> some View {
        let type: ExportType = (export.exportType == "proof_pack") ? .proofPack : .pdf
        let task = ExportTask(
            id: export.id,
            jobId: jobId,
            type: type,
            state: .failed(export.failureReason ?? "Export failed"),
            progress: 0,
            createdAt: export.createdAt,
            fileURL: nil,
            initiatedFromForeground: false
        )
        return FailedExportSheet(
            export: task,
            onRetry: {
                selectedFailedExport = nil
                Task {
                    await retryExport(export)
                }
            },
            onCopyID: {
                UIPasteboard.general.string = export.id
                ToastCenter.shared.show("Export ID Copied", systemImage: "doc.on.doc", style: .success)
            },
            onAddEvidence: {
                selectedFailedExport = nil
                dismiss()
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                    quickAction.presentEvidence(jobId: jobId)
                }
            }
        )
    }

    // MARK: - Actions

    private func handleExportTap(_ export: Export) {
        switch export.state.lowercased() {
        case "failed":
            selectedFailedExport = export
        case "ready":
            if let urlString = export.downloadUrl {
                openDownloadUrl(urlString)
            }
        case "queued", "preparing", "generating", "uploading":
            ToastCenter.shared.show("Export is generating. Check back in a moment.", systemImage: "arrow.triangle.2.circlepath", style: .info)
        default:
            break
        }
    }

    private func openDownloadUrl(_ urlString: String) {
        guard let url = URL(string: urlString) else {
            ToastCenter.shared.show("Invalid download link", systemImage: "exclamationmark.triangle", style: .error)
            return
        }
        UIApplication.shared.open(url) { ok in
            if !ok {
                ToastCenter.shared.show("Couldn't open link", systemImage: "exclamationmark.triangle", style: .error)
            }
        }
    }

    @MainActor
    private func loadExports() async {
        let token = UUID()
        loadToken = token
        loading = true
        error = nil
        do {
            let fetched = try await APIClient.shared.getExports(jobId: jobId)
            if Task.isCancelled || loadToken != token { return }
            exports = fetched.sorted { $0.createdAt > $1.createdAt }
            loading = false
        } catch {
            if Task.isCancelled || loadToken != token { return }
            self.error = error.localizedDescription
            exports = []
            loading = false
        }
    }

    @MainActor
    private func retryExport(_ export: Export) async {
        let type: ExportType = (export.exportType == "proof_pack") ? .proofPack : .pdf
        do {
            try await APIClient.shared.createExport(jobId: jobId, type: type)
            if Task.isCancelled { return }
            await loadExports()
            if Task.isCancelled { return }
            ToastCenter.shared.show("Export retrying…", systemImage: "arrow.clockwise", style: .success)
        } catch {
            if Task.isCancelled { return }
            ToastCenter.shared.show("Failed to retry export", systemImage: "exclamationmark.triangle", style: .error)
        }
    }
}

// MARK: - Row

private struct ExportHistoryRow: View {
    let export: Export

    private var displayName: String {
        switch export.exportType {
        case "proof_pack": return "Proof Pack"
        case "pdf", "ledger": return "Risk Snapshot Report"
        default: return "Export"
        }
    }

    private var iconName: String {
        switch export.state.lowercased() {
        case "ready": return "checkmark.circle.fill"
        case "failed": return "xmark.circle.fill"
        case "preparing", "generating", "uploading": return "arrow.triangle.2.circlepath"
        default: return "clock.fill"
        }
    }

    private var statusColor: Color {
        switch export.state.lowercased() {
        case "ready": return RMTheme.Colors.success
        case "failed": return RMTheme.Colors.error
        case "preparing", "generating", "uploading": return RMTheme.Colors.accent
        default: return RMTheme.Colors.textTertiary
        }
    }

    private var statusText: String {
        switch export.state.lowercased() {
        case "queued": return "Queued"
        case "preparing": return "Preparing"
        case "generating", "uploading": return "Generating"
        case "ready": return "Ready"
        case "failed": return "Failed"
        default: return export.state
        }
    }

    var body: some View {
        RMGlassCard {
            HStack(spacing: RMTheme.Spacing.md) {
                Image(systemName: iconName)
                    .font(.system(size: 24))
                    .foregroundColor(statusColor)
                    .frame(width: 40, height: 40)
                    .background(statusColor.opacity(0.15))
                    .clipShape(Circle())

                VStack(alignment: .leading, spacing: 4) {
                    Text(displayName)
                        .font(RMTheme.Typography.bodyBold)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    Text(export.createdAt.formatted(date: .abbreviated, time: .shortened))
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                    if export.state.lowercased() == "failed", let reason = export.failureReason, !reason.isEmpty {
                        Text(reason)
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.error)
                            .lineLimit(2)
                    }
                }

                Spacer()

                Text(statusText)
                    .font(RMTheme.Typography.captionBold)
                    .foregroundColor(statusColor)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(statusColor.opacity(0.15))
                    .clipShape(Capsule())
            }
        }
    }
}
