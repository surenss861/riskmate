import SwiftUI

/// Modal sheet for resolving a single sync conflict: server vs local vs merge, field-level choice, metadata, impact note.
/// Presents until resolution completes successfully; on failure surfaces error and allows retry.
struct ConflictResolutionSheet: View {
    let conflict: SyncConflict
    let entityLabel: String
    /// Called with chosen strategy and per-field resolved values. Sheet awaits completion and only dismisses on success.
    let onResolve: (ConflictResolutionOutcome) async throws -> Void
    let onCancel: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var isResolving = false
    @State private var errorMessage: String?
    /// Selected strategy for the single field (or overall)
    @State private var selectedStrategy: ConflictResolutionStrategy = .localWins
    /// For merge: per-field chosen value keyed by field name. For single field, we use server or local value as the "merged" choice.
    @State private var perFieldChoice: [String: FieldChoice] = [:]

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .short
        f.timeStyle = .short
        return f
    }()

    enum FieldChoice: String, CaseIterable {
        case server = "Server"
        case local = "Local"
    }

    var body: some View {
        NavigationStack {
            RMBackground()
                .overlay {
                    ScrollView {
                        VStack(alignment: .leading, spacing: RMTheme.Spacing.lg) {
                            Text("This \(entityLabel) was changed both on this device and on the server. Choose which version to keep or merge.")
                                .font(RMTheme.Typography.bodySmall)
                                .foregroundColor(RMTheme.Colors.textSecondary)
                                .padding(.horizontal)

                            // Field-by-field comparison card
                            fieldComparisonCard

                            // Impact note tied to selection
                            impactNote
                                .padding(.horizontal)

                            if let err = errorMessage {
                                Text(err)
                                    .font(RMTheme.Typography.captionSmall)
                                    .foregroundColor(RMTheme.Colors.error)
                                    .padding(.horizontal)
                            }
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
                        .disabled(isResolving)
                    }
                }
                .safeAreaInset(edge: .bottom) {
                    resolutionButtons
                }
        }
        .onAppear {
            perFieldChoice[conflict.field] = .local
        }
    }

    private var fieldComparisonCard: some View {
        VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
            Text("Conflicting field: \(conflict.field.replacingOccurrences(of: "_", with: " ").capitalized)")
                .font(RMTheme.Typography.captionBold)
                .foregroundColor(RMTheme.Colors.textTertiary)
                .textCase(.uppercase)
                .padding(.horizontal, RMTheme.Spacing.pagePadding)

            // Server version card with metadata (updated-at timestamp, actor)
            ConflictVersionCard(
                title: "Server version",
                value: conflict.serverValueDisplay,
                timestamp: conflict.serverTimestamp,
                subtitle: "Updated on server",
                actor: conflict.serverActor
            )

            // Local version card with metadata
            ConflictVersionCard(
                title: "Your version",
                value: conflict.localValueDisplay,
                timestamp: conflict.localTimestamp,
                subtitle: "Your changes on this device",
                actor: conflict.localActor
            )

            // Per-field resolution choice
            HStack(spacing: RMTheme.Spacing.sm) {
                Text("Use for this field:")
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                Picker("", selection: Binding(
                    get: { perFieldChoice[conflict.field] ?? .local },
                    set: { perFieldChoice[conflict.field] = $0 }
                )) {
                    ForEach(FieldChoice.allCases, id: \.self) { choice in
                        Text(choice.rawValue).tag(choice)
                    }
                }
                .pickerStyle(.segmented)
            }
            .padding(.horizontal, RMTheme.Spacing.pagePadding)
        }
    }

    private var impactNote: some View {
        Group {
            switch selectedStrategy {
            case .serverWins:
                Text("Server version will be kept. Your local change for this field will be discarded.")
            case .localWins:
                Text("Your version will be sent to the server. Server data for this field will be overwritten.")
            case .merge:
                let choice = perFieldChoice[conflict.field] ?? .local
                if choice == .server {
                    Text("Merged result will use the server value for this field.")
                } else {
                    Text("Merged result will use your value for this field.")
                }
            case .askUser:
                Text("You will be prompted to choose when this conflict is processed.")
            }
        }
        .font(RMTheme.Typography.captionSmall)
        .foregroundColor(RMTheme.Colors.textTertiary)
    }

    private var resolutionButtons: some View {
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

            Button {
                Haptics.tap()
                resolve(with: .merge)
            } label: {
                Text("Merge")
                    .font(RMTheme.Typography.bodySmallBold)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, RMTheme.Spacing.md)
                    .background(RMTheme.Colors.surface)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                    .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm, style: .continuous))
            }
            .disabled(isResolving)
        }
        .padding(.horizontal, RMTheme.Spacing.pagePadding)
        .padding(.top, RMTheme.Spacing.sm)
        .background(RMTheme.Colors.background.opacity(0.95))
    }

    private func resolve(with strategy: ConflictResolutionStrategy) {
        guard !isResolving else { return }
        isResolving = true
        errorMessage = nil
        selectedStrategy = strategy

        let choice = perFieldChoice[conflict.field] ?? .local
        let perFieldResolvedValues: [String: Any]? = {
            if strategy == .merge {
                let value: AnyHashable? = choice == .server ? conflict.serverValue : conflict.localValue
                guard let v = value else { return nil }
                return [conflict.field: v]
            }
            return nil
        }()
        let outcome = ConflictResolutionOutcome(strategy: strategy, perFieldResolvedValues: perFieldResolvedValues)

        Task { @MainActor in
            do {
                try await onResolve(outcome)
                dismiss()
            } catch {
                isResolving = false
                errorMessage = error.localizedDescription
            }
        }
    }
}

/// One version card (server or local) with value and metadata (updated-at timestamp, actor)
private struct ConflictVersionCard: View {
    let title: String
    let value: String
    let timestamp: Date
    let subtitle: String
    var actor: String?

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
                if let actor = actor, !actor.isEmpty {
                    Text("By \(actor)")
                        .font(RMTheme.Typography.captionSmall)
                        .foregroundColor(RMTheme.Colors.textTertiary)
                }
                Text("Updated at \(Self.dateFormatter.string(from: timestamp))")
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
