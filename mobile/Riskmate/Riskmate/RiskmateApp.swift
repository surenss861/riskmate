import SwiftUI

@main
struct RiskmateApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var sessionManager = SessionManager.shared
    
    init() {
        // Initialize crash reporting
        _ = CrashReporting.shared
        
        // DEBUG: Force logout on launch (for testing - remove in production)
        // This prevents "logged in on launch" when Supabase session persists in Keychain
        #if DEBUG
        Task {
            do {
                // Clear Supabase session
                try await AuthService.shared.signOut()
                print("[RiskmateApp] 🧹 DEBUG: Cleared session on launch")
            } catch {
                print("[RiskmateApp] ⚠️ DEBUG: Failed to clear session: \(error)")
            }
            // Clear session manager state
            await sessionManager.logout()
        }
        #endif
        
        // Restore Supabase session early (before any API calls)
        // In DEBUG, this will restore after we just cleared it (so user starts logged out)
        // In production, this restores existing session from Keychain
        Task {
            await AuthService.shared.ensureSessionRestored()
        }
        
        // Initial health check on app launch
        Task {
            await ServerStatusManager.shared.checkHealth()
        }
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(sessionManager)
                .preferredColorScheme(.dark)
                .background(RMTheme.Colors.background)
        }
    }
}

// MARK: - AppDelegate for Background URLSession

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        handleEventsForBackgroundURLSession identifier: String,
        completionHandler: @escaping () -> Void
    ) {
        BackgroundUploadManager.shared.setBackgroundCompletionHandler(completionHandler)
    }
}
