import Foundation
import UIKit

/// Crash reporting setup (Sentry-ready structure)
/// Attaches diagnostics to crashes automatically
class CrashReporting {
    static let shared = CrashReporting()
    
    private init() {
        setupCrashReporting()
    }
    
    private func setupCrashReporting() {
        // TODO: Initialize Sentry SDK
        // SentrySDK.start { options in
        //     options.dsn = "YOUR_SENTRY_DSN"
        //     options.environment = "production"
        //     options.attachStacktrace = true
        //     options.enableAutoSessionTracking = true
        // }
        
        // Set user context
        updateUserContext()
    }
    
    func updateUserContext() {
        // TODO: Set Sentry user context
        // SentrySDK.setUser(User(userId: userId, email: email))
        // SentrySDK.setContext(value: ["organization_id": orgId], key: "organization")
    }
    
    func setContext(key: String, value: [String: Any]) {
        // TODO: Set Sentry context
        // SentrySDK.setContext(value: value, key: key)
        
        #if DEBUG
        print("[CrashReporting] Context set: \(key) = \(value)")
        #endif
    }
    
    func captureError(_ error: Error, level: SentryLevel = .error) {
        // TODO: Capture error to Sentry
        // SentrySDK.capture(error: error) { scope in
        //     scope.setLevel(level)
        //     scope.setContext(value: getDiagnosticsContext(), key: "diagnostics")
        // }
        
        #if DEBUG
        print("[CrashReporting] Error captured: \(error.localizedDescription)")
        #endif
    }
    
    func captureMessage(_ message: String, level: SentryLevel = .info) {
        // TODO: Capture message to Sentry
        // SentrySDK.capture(message: message) { scope in
        //     scope.setLevel(level)
        //     scope.setContext(value: getDiagnosticsContext(), key: "diagnostics")
        // }
        
        #if DEBUG
        print("[CrashReporting] Message captured: \(message)")
        #endif
    }
    
    private func getDiagnosticsContext() -> [String: Any] {
        var context: [String: Any] = [:]
        
        // App info
        if let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String {
            context["app_version"] = version
        }
        if let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String {
            context["build_number"] = build
        }
        
        // Device info
        context["ios_version"] = UIDevice.current.systemVersion
        context["device_model"] = UIDevice.current.model
        
        // Backend info
        context["backend_url"] = AppConfig.shared.backendURL
        
        // Sync state
        let cache = OfflineCache.shared
        switch cache.syncState {
        case .synced:
            context["sync_state"] = "synced"
        case .syncing:
            context["sync_state"] = "syncing"
        case .queued(let count):
            context["sync_state"] = "queued"
            context["queue_depth"] = count
        case .error(let message):
            context["sync_state"] = "error"
            context["sync_error"] = message
        }
        
        context["queue_depth"] = cache.queuedItems.count
        
        // Upload state
        let uploadManager = BackgroundUploadManager.shared
        context["active_uploads"] = uploadManager.uploads.filter { $0.state == .uploading || $0.state == .queued }.count
        
        return context
    }
}

enum SentryLevel {
    case debug
    case info
    case warning
    case error
    case fatal
}
