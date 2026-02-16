import SwiftUI

/// User notification preferences: master push/email toggles and per-type toggles.
/// Fetches via GET /api/notifications/preferences and PATCHes updates via APIClient.
struct NotificationPreferencesView: View {
    @State private var prefs: APIClient.NotificationPreferences?
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var isSaving = false

    var body: some View {
        ZStack {
            RMBackground()

            if isLoading && prefs == nil {
                VStack(spacing: RMTheme.Spacing.lg) {
                    ProgressView()
                    Text("Loading preferences...")
                        .font(RMTheme.Typography.body)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                }
            } else if let error = errorMessage {
                RMEmptyState(
                    icon: "exclamationmark.triangle.fill",
                    title: "Error",
                    message: error
                )
                .padding(RMTheme.Spacing.pagePadding)
            } else if let prefs = prefs {
                List {
                    Section {
                        Toggle(isOn: binding(\.push_enabled)) {
                            Label("Push notifications", systemImage: "bell.badge.fill")
                                .foregroundColor(RMTheme.Colors.textPrimary)
                        }
                        .tint(RMTheme.Colors.accent)
                        .listRowBackground(RMTheme.Colors.surface.opacity(0.5))
                        .disabled(isSaving)

                        Toggle(isOn: binding(\.email_enabled)) {
                            Label("Email notifications", systemImage: "envelope.fill")
                                .foregroundColor(RMTheme.Colors.textPrimary)
                        }
                        .tint(RMTheme.Colors.accent)
                        .listRowBackground(RMTheme.Colors.surface.opacity(0.5))
                        .disabled(isSaving)
                    } header: {
                        Text("Master toggles")
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.textTertiary)
                    }

                    Section {
                        preferenceToggle(\.mentions_enabled, title: "Mentions", icon: "at")
                        preferenceToggle(\.job_assigned_enabled, title: "Job assigned", icon: "person.badge.plus")
                        preferenceToggle(\.signature_request_enabled, title: "Signature requests", icon: "signature")
                        preferenceToggle(\.evidence_uploaded_enabled, title: "Evidence uploaded", icon: "photo.on.rectangle.angled")
                        preferenceToggle(\.hazard_added_enabled, title: "Hazard added", icon: "exclamationmark.triangle")
                        preferenceToggle(\.deadline_enabled, title: "Deadlines", icon: "clock")
                        preferenceToggle(\.weekly_summary_enabled, title: "Weekly summary", icon: "chart.bar.doc.horizontal")
                        preferenceToggle(\.high_risk_job_enabled, title: "High-risk jobs", icon: "flame")
                        preferenceToggle(\.report_ready_enabled, title: "Report ready", icon: "doc.richtext")
                    } header: {
                        Text("By type")
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.textTertiary)
                    }
                }
                .scrollContentBackground(.hidden)
                .refreshable {
                    await load()
                }
            }
        }
        .navigationTitle("Notification preferences")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await load()
        }
    }

    private func binding(_ keyPath: WritableKeyPath<APIClient.NotificationPreferences, Bool>) -> Binding<Bool> {
        Binding(
            get: { prefs?[keyPath: keyPath] ?? false },
            set: { newValue in
                guard var p = prefs else { return }
                p[keyPath: keyPath] = newValue
                prefs = p
                Task { await save(p) }
            }
        )
    }

    private func preferenceToggle(
        _ keyPath: WritableKeyPath<APIClient.NotificationPreferences, Bool>,
        title: String,
        icon: String
    ) -> some View {
        Toggle(isOn: binding(keyPath)) {
            Label(title, systemImage: icon)
                .foregroundColor(RMTheme.Colors.textPrimary)
        }
        .tint(RMTheme.Colors.accent)
        .listRowBackground(RMTheme.Colors.surface.opacity(0.5))
        .disabled(isSaving)
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        do {
            prefs = try await APIClient.shared.getNotificationPreferences()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func save(_ newPrefs: APIClient.NotificationPreferences) async {
        isSaving = true
        errorMessage = nil
        do {
            let updated = try await APIClient.shared.patchNotificationPreferences(newPrefs)
            prefs = updated
        } catch {
            errorMessage = error.localizedDescription
            // Revert local state on failure
            prefs = try? await APIClient.shared.getNotificationPreferences()
        }
        isSaving = false
    }
}

#Preview {
    NavigationStack {
        NotificationPreferencesView()
    }
}
