import Foundation
import UserNotifications

/// Handles notification permissions, device token registration, badge, and notification presentation.
/// Set as UNUserNotificationCenter.current().delegate from AppDelegate.
final class NotificationService: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationService()

    /// Last device token received from the system; set by AppDelegate, used to register after login.
    private(set) var lastDeviceToken: Data?

    func setDeviceToken(_ token: Data) {
        lastDeviceToken = token
    }

    private override init() {
        super.init()
    }

    // MARK: - Permissions

    /// Request notification permissions. Returns true if granted, false if denied, throws on errors.
    func requestPermissions() async throws -> Bool {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()

        switch settings.authorizationStatus {
        case .authorized, .provisional:
            return true
        case .denied:
            return false
        case .notDetermined:
            let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
            return granted
        @unknown default:
            return false
        }
    }

    /// Current authorization status (authorized, denied, notDetermined).
    func authorizationStatus() async -> UNAuthorizationStatus {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        return settings.authorizationStatus
    }

    /// Returns true if we should prompt for permissions (not yet determined).
    func shouldRequestPermissions() async -> Bool {
        let status = await authorizationStatus()
        return status == .notDetermined
    }

    // MARK: - Device token registration

    /// Register the APNs device token with the backend. Call from AppDelegate after receiving token.
    func registerDeviceToken(_ token: Data) async throws {
        let tokenString = token.map { String(format: "%02.2hhx", $0) }.joined()
        guard !tokenString.isEmpty else { return }

        try await APIClient.shared.registerPushToken(token: tokenString, platform: "ios")
    }

    /// Register device token only if user is authenticated (e.g. after token arrives at launch).
    func registerDeviceTokenIfAuthenticated(_ token: Data) async {
        guard SessionManager.shared.isAuthenticated else { return }
        setDeviceToken(token)
        do {
            try await registerDeviceToken(token)
        } catch {
            print("[NotificationService] registerDeviceToken failed: \(error.localizedDescription)")
        }
    }

    /// Re-register stored device token with backend (call after login or when permissions granted).
    func registerStoredTokenIfNeeded() async {
        guard SessionManager.shared.isAuthenticated,
              let token = lastDeviceToken else { return }
        do {
            try await registerDeviceToken(token)
        } catch {
            print("[NotificationService] registerStoredToken failed: \(error.localizedDescription)")
        }
    }

    /// Unregister current device token on logout.
    func unregisterDeviceToken(_ token: Data) async throws {
        let tokenString = token.map { String(format: "%02.2hhx", $0) }.joined()
        guard !tokenString.isEmpty else { return }
        try await APIClient.shared.unregisterPushToken(token: tokenString)
    }

    // MARK: - Notification tap (deep link)

    /// Handle user tapping a notification. Parse payload and route via DeepLinkRouter.
    /// Supports Expo payload structure (deepLink inside userInfo["data"]) and top-level deepLink.
    /// Marks notifications as read and refreshes badge when user engages with the notification.
    func handleNotificationTap(_ notification: UNNotification) async {
        await markAsReadAndRefreshBadge()
        let userInfo = notification.request.content.userInfo
        var deepLinkString: String?
        if let data = userInfo["data"] as? [AnyHashable: Any],
           let link = data["deepLink"] as? String {
            deepLinkString = link
        } else if let link = userInfo["deepLink"] as? String {
            deepLinkString = link
        }
        if let deepLink = deepLinkString,
           let url = URL(string: deepLink) {
            await MainActor.run {
                DeepLinkRouter.shared.handle(url)
            }
        }
    }

    /// Update app icon badge from push payload (APNs aps.badge or Expo data.badge).
    func updateBadgeFromPayload(_ userInfo: [AnyHashable: Any]) {
        if let aps = userInfo["aps"] as? [AnyHashable: Any],
           let badge = aps["badge"] as? Int {
            setBadgeCount(badge)
            return
        }
        if let data = userInfo["data"] as? [AnyHashable: Any],
           let badge = data["badge"] as? Int {
            setBadgeCount(badge)
        }
    }

    // MARK: - Badge

    func setBadgeCount(_ count: Int) {
        Task { @MainActor in
            UNUserNotificationCenter.current().setBadgeCount(count) { error in
                if let error = error {
                    print("[NotificationService] setBadgeCount failed: \(error.localizedDescription)")
                }
            }
        }
    }

    func clearBadge() {
        setBadgeCount(0)
    }

    /// Mark all notifications as read and refresh badge from server (e.g. when opening notifications or tapping one).
    func markAsReadAndRefreshBadge() async {
        do {
            try await APIClient.shared.markNotificationsAsRead(ids: nil)
        } catch {
            // Non-fatal: e.g. network or not authenticated
        }
        do {
            let count = try await APIClient.shared.getUnreadNotificationCount()
            await MainActor.run {
                setBadgeCount(count)
            }
        } catch {
            // Non-fatal: fallback to clearing badge
            clearBadge()
        }
    }

    // MARK: - Foreground presentation

    /// Show notification when app is in foreground (banner + sound + badge).
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        updateBadgeFromPayload(notification.request.content.userInfo)
        completionHandler([.banner, .sound, .badge, .list])
    }

    /// Handle notification tap (response).
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        updateBadgeFromPayload(response.notification.request.content.userInfo)
        Task {
            await handleNotificationTap(response.notification)
            completionHandler()
        }
    }
}
