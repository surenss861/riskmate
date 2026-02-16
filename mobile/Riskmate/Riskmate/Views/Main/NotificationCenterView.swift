import SwiftUI

/// Notification center screen shown when the user opens riskmate://notifications or taps a notification.
/// Lists notification-related settings and recent context; reachable from deep link without additional taps.
struct NotificationCenterView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            RMBackground()

            VStack(spacing: RMTheme.Spacing.lg) {
                RMEmptyState(
                    icon: "bell.badge.fill",
                    title: "Notifications",
                    message: "Manage notification preferences and review alerts from your account settings.",
                    action: nil
                )
                .padding(RMTheme.Spacing.pagePadding)

                Text("Open Settings to manage notification preferences.")
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(RMTheme.Colors.textTertiary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }
        }
        .rmNavigationBar(title: "Notifications")
        .task {
            await markAsReadAndRefreshBadge()
        }
    }

    /// Mark all notifications as read when user opens the center, then refresh badge from unread count.
    private func markAsReadAndRefreshBadge() async {
        do {
            try await APIClient.shared.markNotificationsAsRead(ids: nil)
        } catch {
            // Non-fatal: e.g. network or auth
        }
        do {
            let count = try await APIClient.shared.getUnreadNotificationCount()
            await MainActor.run {
                NotificationService.shared.setBadgeCount(count)
            }
        } catch {
            // Non-fatal: badge may already be set from push payload
        }
    }
}

#Preview {
    NavigationStack {
        NotificationCenterView()
    }
}
