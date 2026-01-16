import SwiftUI

@main
struct RiskmateApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var sessionManager = SessionManager.shared
    
    init() {
        // Initialize crash reporting
        _ = CrashReporting.shared
        
        // Restore Supabase session early (before any API calls)
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
