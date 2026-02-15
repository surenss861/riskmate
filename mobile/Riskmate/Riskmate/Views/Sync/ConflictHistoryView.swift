import SwiftUI

/// Lists past and current sync conflicts; shows resolution chosen and allows viewing details.
struct ConflictHistoryView: View {
    @State private var history: [ConflictHistoryRow] = []
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            RMBackground()
                .overlay {
                    Group {
                        if history.isEmpty {
                            VStack(spacing: RMTheme.Spacing.lg) {
                                Image(systemName: "checkmark.circle")
                                    .font(.system(size: 48))
                                    .foregroundColor(RMTheme.Colors.textTertiary)
                                Text("No conflicts")
                                    .font(RMTheme.Typography.title3)
                                    .foregroundColor(RMTheme.Colors.textPrimary)
                                Text("Sync conflicts will appear here once resolved or pending.")
                                    .font(RMTheme.Typography.bodySmall)
                                    .foregroundColor(RMTheme.Colors.textSecondary)
                                    .multilineTextAlignment(.center)
                                    .padding(.horizontal)
                            }
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                        } else {
                            List {
                                ForEach(history, id: \.id) { row in
                                    ConflictHistoryRowView(row: row)
                                        .listRowBackground(Color.clear)
                                        .listRowInsets(EdgeInsets(
                                            top: RMTheme.Spacing.sm,
                                            leading: RMTheme.Spacing.pagePadding,
                                            bottom: RMTheme.Spacing.sm,
                                            trailing: RMTheme.Spacing.pagePadding
                                        ))
                                }
                            }
                            .listStyle(.plain)
                            .scrollContentBackground(.hidden)
                        }
                    }
                }
                .navigationTitle("Conflict history")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Done") {
                            dismiss()
                        }
                        .foregroundColor(RMTheme.Colors.accent)
                    }
                }
                .onAppear {
                    loadHistory()
                }
                .onReceive(NotificationCenter.default.publisher(for: .syncConflictHistoryDidChange)) { _ in
                    loadHistory()
                }
        }
    }

    private func loadHistory() {
        history = OfflineDatabase.shared.getAllConflicts()
    }
}

private struct ConflictHistoryRowView: View {
    let row: ConflictHistoryRow

    private var entityLabel: String {
        switch row.entityType {
        case "job": return "Job"
        case "hazard": return "Hazard"
        case "control": return "Control"
        default: return row.entityType.capitalized
        }
    }

    private var resolutionLabel: String {
        guard let strat = row.resolutionStrategy else { return "Pending" }
        switch strat {
        case "server_wins": return "Used server version"
        case "local_wins": return "Used my version"
        case "merge": return "Merged"
        default: return strat.replacingOccurrences(of: "_", with: " ")
        }
    }

    private var isResolved: Bool { row.resolvedAt != nil }

    private var resolvedDateText: String? {
        guard let date = row.resolvedAt else { return nil }
        let f = DateFormatter()
        f.dateStyle = .short
        f.timeStyle = .short
        return f.string(from: date)
    }

    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                HStack {
                    Text("\(entityLabel) · \(row.entityId.prefix(8))…")
                        .font(RMTheme.Typography.bodySmallBold)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    Spacer()
                    if isResolved {
                        Text(resolutionLabel)
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.success)
                            .padding(.horizontal, RMTheme.Spacing.sm)
                            .padding(.vertical, 4)
                            .background(RMTheme.Colors.success.opacity(0.2))
                            .clipShape(Capsule())
                    } else {
                        Text("Pending")
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.warning)
                            .padding(.horizontal, RMTheme.Spacing.sm)
                            .padding(.vertical, 4)
                            .background(RMTheme.Colors.warning.opacity(0.2))
                            .clipShape(Capsule())
                    }
                }
                if let server = row.serverVersion, !server.isEmpty {
                    Text("Server: \(server)")
                        .font(RMTheme.Typography.captionSmall)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                        .lineLimit(2)
                }
                if let local = row.localVersion, !local.isEmpty {
                    Text("Yours: \(local)")
                        .font(RMTheme.Typography.captionSmall)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                        .lineLimit(2)
                }
                if let dateText = resolvedDateText {
                    Text("Resolved \(dateText)")
                        .font(RMTheme.Typography.captionSmall)
                        .foregroundColor(RMTheme.Colors.textTertiary)
                }
            }
        }
    }
}

extension Notification.Name {
    static let syncConflictHistoryDidChange = Notification.Name("SyncConflictHistoryDidChange")
}

#Preview {
    ConflictHistoryView()
}
