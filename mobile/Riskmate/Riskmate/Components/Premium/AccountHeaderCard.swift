import SwiftUI

/// Account identity + quick actions. Package 8 — productized account screen.
struct AccountHeaderCard: View {
    let userName: String
    let userEmail: String?
    let organizationName: String?
    let onSupportBundle: () -> Void
    let onNotificationPrefs: () -> Void
    let onSignOut: () -> Void

    private var initials: String {
        let name = userName.trimmingCharacters(in: .whitespaces)
        if name.isEmpty, let e = userEmail?.first { return String(e).uppercased() }
        let parts = name.split(separator: " ").compactMap { $0.first }
        if parts.count >= 2 { return String(parts[0]) + String(parts[1]) }
        if let first = parts.first { return String(first) }
        return "?"
    }

    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.lg) {
                HStack(spacing: RMTheme.Spacing.md) {
                    Text(initials)
                        .font(RMTheme.Typography.title2)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                        .frame(width: 56, height: 56)
                        .background(RMTheme.Colors.surface.opacity(0.8))
                        .clipShape(Circle())
                    VStack(alignment: .leading, spacing: RMTheme.Spacing.xs) {
                        Text(userName)
                            .font(RMTheme.Typography.title3)
                            .foregroundColor(RMTheme.Colors.textPrimary)
                        if let email = userEmail, !email.isEmpty {
                            Text(email)
                                .font(RMTheme.Typography.caption)
                                .foregroundColor(RMTheme.Colors.textSecondary)
                        }
                        if let org = organizationName, !org.isEmpty {
                            Text(org)
                                .font(RMTheme.Typography.caption2)
                                .foregroundColor(RMTheme.Colors.textTertiary)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                VStack(spacing: RMTheme.Spacing.sm) {
                    NavigationLink {
                        SupportBundleView()
                    } label: {
                        quickActionLabel(title: "Support bundle", icon: "questionmark.circle", destructive: false)
                    }
                    .buttonStyle(.plain)
                    .rmPressable(scale: 0.98, haptic: true, lightImpact: true)
                    NavigationLink {
                        NotificationPreferencesView()
                    } label: {
                        quickActionLabel(title: "Notification preferences", icon: "bell.badge.fill", destructive: false)
                    }
                    .buttonStyle(.plain)
                    .rmPressable(scale: 0.98, haptic: true, lightImpact: true)
                    Button {
                        Haptics.impact(.light)
                        onSignOut()
                    } label: {
                        quickActionLabel(title: "Sign out", icon: "rectangle.portrait.and.arrow.right", destructive: true)
                    }
                    .buttonStyle(.plain)
                    .rmPressable(scale: 0.98, haptic: true, lightImpact: true)
                }
            }
        }
        .rmAppearIn(staggerIndex: 0)
    }

    private func quickActionLabel(title: String, icon: String, destructive: Bool) -> some View {
        HStack(spacing: RMTheme.Spacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundColor(destructive ? RMTheme.Colors.error : RMTheme.Colors.accent)
            Text(title)
                .font(RMTheme.Typography.body)
                .foregroundColor(destructive ? RMTheme.Colors.error : RMTheme.Colors.textPrimary)
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(RMTheme.Colors.textTertiary)
        }
        .padding(RMTheme.Spacing.sm)
        .contentShape(Rectangle())
    }
}

#Preview {
    AccountHeaderCard(
        userName: "Jane Doe",
        userEmail: "jane@example.com",
        organizationName: "Acme Safety",
        onSupportBundle: {},
        onNotificationPrefs: {},
        onSignOut: {}
    )
    .padding()
    .background(RMTheme.Colors.background)
}
