import SwiftUI

/// Overview of recent exports (from BackgroundExportManager). Shown when user taps "Exports" from Dashboard.
struct ExportHistoryOverviewView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var exportManager = BackgroundExportManager.shared
    
    private var recentExports: [ExportTask] {
        Array(exportManager.exports.sorted { $0.createdAt > $1.createdAt }.prefix(30))
    }
    
    var body: some View {
        NavigationStack {
            Group {
                if recentExports.isEmpty {
                    RMEmptyState(
                        icon: "square.and.arrow.up",
                        title: "No exports yet",
                        message: "Generate a report or proof pack from a job to see export history here."
                    )
                    .padding(.vertical, RMTheme.Spacing.xxl)
                } else {
                    ScrollView(showsIndicators: false) {
                        LazyVStack(spacing: RMTheme.Spacing.sm) {
                            ForEach(recentExports) { task in
                                ExportOverviewRow(task: task)
                            }
                        }
                        .padding(RMTheme.Spacing.pagePadding)
                    }
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
        }
        .preferredColorScheme(.dark)
    }
}

private struct ExportOverviewRow: View {
    let task: ExportTask
    
    var body: some View {
        HStack(spacing: RMTheme.Spacing.md) {
            Image(systemName: task.type == .proofPack ? "archivebox.fill" : "doc.text.fill")
                .font(.system(size: 20))
                .foregroundColor(RMTheme.Colors.accent)
                .frame(width: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text(task.type.displayName)
                    .font(RMTheme.Typography.bodySmallBold)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                Text("Job \(task.jobId.prefix(8))… • \(stateText)")
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(RMTheme.Colors.textSecondary)
            }
            Spacer()
            Text(formatDate(task.createdAt))
                .font(RMTheme.Typography.caption)
                .foregroundColor(RMTheme.Colors.textTertiary)
        }
        .padding(RMTheme.Spacing.md)
        .background(RMTheme.Colors.inputFill)
        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
    }
    
    private var stateText: String {
        switch task.state {
        case .queued: return "Queued"
        case .preparing, .downloading: return "In progress"
        case .ready: return "Ready"
        case .failed: return "Failed"
        }
    }
    
    private func formatDate(_ date: Date) -> String {
        let f = RelativeDateTimeFormatter()
        f.unitsStyle = .abbreviated
        return f.localizedString(for: date, relativeTo: Date())
    }
}
