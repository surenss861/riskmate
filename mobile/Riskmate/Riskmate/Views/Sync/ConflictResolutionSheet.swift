import SwiftUI

/// Modal sheet for resolving a single sync conflict: show server vs local version and let user choose.
struct ConflictResolutionSheet: View {
    let conflict: SyncConflict
    let entityLabel: String
    let onResolve: (ConflictResolutionStrategy) -> Void
    let onCancel: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var isResolving = false

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .short
        f.timeStyle = .short
        return f
    }()

    var body: some View {
        NavigationStack {
            RMBackground()
                .overlay {
                    ScrollView {
                        VStack(alignment: .leading, spacing: RMTheme.Spacing.lg) {
                            Text("This \(entityLabel) was changed both on this device and on the server. Choose which version to keep.")
                                .font(RMTheme.Typography.bodySmall)
                                .foregroundColor(RMTheme.Colors.textSecondary)
                                .padding(.horizontal)

                            // Field label
                            Text("Conflicting field: \(conflict.field.replacingOccurrences(of: "_", with: " ").capitalized)")
                                .font(RMTheme.Typography.captionBold)
                                .foregroundColor(RMTheme.Colors.textTertiary)
                                .textCase(.uppercase)
                                .padding(.horizontal)

                            // Server version card
                            ConflictVersionCard(
                                title: "Server version",
                                value: conflict.serverValueDisplay,
                                timestamp: conflict.serverTimestamp,
                                subtitle: "Updated on server"
                            )

                            // Local version card
                            ConflictVersionCard(
                                title: "Your version",
                                value: conflict.localValueDisplay,
                                timestamp: conflict.localTimestamp,
                                subtitle: "Your changes on this device"
                            )

                            // Impact note
                            Text("Choosing a version will update the data and retry sync. The other version will be discarded for this field.")
                                .font(RMTheme.Typography.captionSmall)
                                .foregroundColor(RMTheme.Colors.textTertiary)
                                .padding(.horizontal)
                        }
                        .padding(.vertical, RMTheme.Spacing.lg)
                    }
                }
                .navigationTitle("Resolve conflict")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") {
                            Haptics.tap()
                            onCancel()
                            dismiss()
                        }
                        .foregroundColor(RMTheme.Colors.textSecondary)
                    }
                }
                .safeAreaInset(edge: .bottom) {
                    VStack(spacing: RMTheme.Spacing.sm) {
                        Button {
                            Haptics.tap()
                            resolve(with: .serverWins)
                        } label: {
                            HStack {
                                if isResolving { ProgressView().scaleEffect(0.9).tint(.white) }
                                Text("Use Server Version")
                                    .font(RMTheme.Typography.bodySmallBold)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, RMTheme.Spacing.md)
                            .background(RMTheme.Colors.surface)
                            .foregroundColor(RMTheme.Colors.textPrimary)
                            .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm, style: .continuous))
                        }
                        .disabled(isResolving)

                        Button {
                            Haptics.tap()
                            resolve(with: .localWins)
                        } label: {
                            Text("Use My Version")
                                .font(RMTheme.Typography.bodySmallBold)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, RMTheme.Spacing.md)
                                .background(RMTheme.Colors.accent)
                                .foregroundColor(.white)
                                .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm, style: .continuous))
                        }
                        .disabled(isResolving)
                    }
                    .padding(.horizontal, RMTheme.Spacing.pagePadding)
                    .padding(.top, RMTheme.Spacing.sm)
                    .background(RMTheme.Colors.background.opacity(0.95))
                }
        }
    }

    private func resolve(with strategy: ConflictResolutionStrategy) {
        guard !isResolving else { return }
        isResolving = true
        onResolve(strategy)
        dismiss()
    }
}

/// One version card (server or local) with value and metadata
private struct ConflictVersionCard: View {
    let title: String
    let value: String
    let timestamp: Date
    let subtitle: String

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .short
        f.timeStyle = .short
        return f
    }()

    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                Text(title)
                    .font(RMTheme.Typography.captionBold)
                    .foregroundColor(RMTheme.Colors.textTertiary)
                    .textCase(.uppercase)
                Text(value)
                    .font(RMTheme.Typography.bodySmall)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                    .lineLimit(5)
                Text(subtitle)
                    .font(RMTheme.Typography.captionSmall)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                Text(Self.dateFormatter.string(from: timestamp))
                    .font(RMTheme.Typography.captionSmall)
                    .foregroundColor(RMTheme.Colors.textTertiary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, RMTheme.Spacing.pagePadding)
    }
}

#Preview {
    ConflictResolutionSheet(
        conflict: SyncConflict(
            entityType: "job",
            entityId: "job-1",
            field: "status",
            serverValue: "in_progress" as AnyHashable,
            localValue: "completed" as AnyHashable,
            serverTimestamp: Date().addingTimeInterval(-3600),
            localTimestamp: Date()
        ),
        entityLabel: "job",
        onResolve: { _ in },
        onCancel: {}
    )
}
