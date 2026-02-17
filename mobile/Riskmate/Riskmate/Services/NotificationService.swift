import Foundation
import UIKit
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

    /// Call after permission is granted so iOS will issue the device token. Gates registerForRemoteNotifications behind authorization.
    func registerForRemoteNotificationsIfAuthorized() {
        Task {
            let status = await authorizationStatus()
            guard status == .authorized || status == .provisional else { return }
            await MainActor.run {
                UIApplication.shared.registerForRemoteNotifications()
            }
        }
    }

    // MARK: - Device token registration

    /// Register the APNs device token with the backend. Call from AppDelegate after receiving token.
    func registerDeviceToken(_ token: Data) async throws {
        let tokenString = token.map { String(format: "%02.2hhx", $0) }.joined()
        guard !tokenString.isEmpty else { return }

        try await APIClient.shared.registerPushToken(token: tokenString, platform: "ios")
    }

    /// Register device token only if user is authenticated (e.g. after token arrives at launch).
    /// Token is always stored first so it can be registered later via registerStoredTokenIfNeeded() after session restore.
    func registerDeviceTokenIfAuthenticated(_ token: Data) async {
        setDeviceToken(token)
        guard SessionManager.shared.isAuthenticated else { return }
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

    /// Clear the stored device token (call after successful unregister on logout to prevent reuse).
    func clearStoredToken() {
        lastDeviceToken = nil
    }

    // MARK: - Notification tap (deep link)

    /// Handle user tapping a notification. Parse payload and route via DeepLinkRouter.
    /// Supports Expo payload structure (deepLink and id inside userInfo["data"]) and top-level deepLink.
    /// Marks only the tapped notification as read (using data.id or top-level id/notification_id); then refreshes badge and routes.
    func handleNotificationTap(_ notification: UNNotification) async {
        let userInfo = notification.request.content.userInfo
        var notificationId: String?
        var deepLinkString: String?
        if let data = userInfo["data"] as? [AnyHashable: Any] {
            notificationId = data["id"] as? String
            deepLinkString = data["deepLink"] as? String
        }
        if notificationId == nil {
            notificationId = (userInfo["id"] as? String) ?? (userInfo["notification_id"] as? String)
        }
        if deepLinkString == nil, let link = userInfo["deepLink"] as? String {
            deepLinkString = link
        }
        if let id = notificationId {
            do {
                try await APIClient.shared.markNotificationsAsRead(ids: [id])
            } catch {
                // Non-fatal: e.g. network or not authenticated
            }
            do {
                let count = try await APIClient.shared.getUnreadNotificationCount()
                await MainActor.run {
                    setBadgeCount(count)
                }
            } catch {
                // Leave badge unchanged on network/API failure; log and retry later
                print("[NotificationService] getUnreadNotificationCount failed after tap: \(error.localizedDescription)")
                Task { await refreshBadgeFromServer() }
            }
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
            if #available(iOS 17.0, *) {
                UNUserNotificationCenter.current().setBadgeCount(count) { error in
                    if let error = error {
                        print("[NotificationService] setBadgeCount failed: \(error.localizedDescription)")
                    }
                }
            } else {
                UIApplication.shared.applicationIconBadgeNumber = count
            }
        }
    }

    func clearBadge() {
        setBadgeCount(0)
    }

    /// Refresh app icon badge from server unread count (e.g. on foreground). Does not mark any notifications as read.
    func refreshBadgeFromServer() async {
        do {
            let count = try await APIClient.shared.getUnreadNotificationCount()
            await MainActor.run {
                setBadgeCount(count)
            }
        } catch {
            // Non-fatal: e.g. network or not authenticated; leave badge unchanged
        }
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
            // Leave badge unchanged on failure to fetch unread count (e.g. network error)
            print("[NotificationService] getUnreadNotificationCount failed in markAsReadAndRefreshBadge: \(error.localizedDescription)")
        }
    }

    // MARK: - Foreground presentation

    /// Returns presentation options for a notification received in foreground. Called by the delegate.
    func handleForegroundNotification(_ notification: UNNotification) -> UNNotificationPresentationOptions {
        updateBadgeFromPayload(notification.request.content.userInfo)
        return [.banner, .sound, .badge, .list]
    }

    /// Show notification when app is in foreground (banner + sound + badge).
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        let options = handleForegroundNotification(notification)
        completionHandler(options)
    }

    /// Handle notification tap (response).
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        completionHandler()
        Task {
            updateBadgeFromPayload(response.notification.request.content.userInfo)
            await handleNotificationTap(response.notification)
        }
    }
}
