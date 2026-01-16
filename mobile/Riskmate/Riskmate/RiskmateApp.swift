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
        // Make it sequential to avoid race conditions
        #if DEBUG
        Task {
            // Step 1: Clear Supabase session
            await AuthService.shared.signOut()
            print("[RiskmateApp] 🧹 DEBUG: Cleared Supabase session")
            
            // Step 2: Clear session manager state
            await SessionManager.shared.logout()
            print("[RiskmateApp] 🧹 DEBUG: Cleared SessionManager state")
            
            // Step 3: Restore session (will be empty after signOut, so user starts logged out)
            await AuthService.shared.ensureSessionRestored()
            print("[RiskmateApp] 🧹 DEBUG: Session restore complete (should be empty)")
        }
        #else
        // Production: Restore Supabase session early (before any API calls)
        // This restores existing session from Keychain
        Task {
            await AuthService.shared.ensureSessionRestored()
        }
        #endif
        
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
