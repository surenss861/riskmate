import SwiftUI

@main
struct RiskmateApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var sessionManager = SessionManager.shared
    @StateObject private var quickAction = QuickActionRouter.shared
    @StateObject private var serverStatus = ServerStatusManager.shared
    
    init() {
        // Migrate legacy UserDefaults keys to namespaced format
        UserDefaultsManager.migrateLegacyKeys()
        
        // Initialize crash reporting
        _ = CrashReporting.shared
        
        // DEBUG: Force logout on launch (for testing - remove in production)
        // This prevents "logged in on launch" when Supabase session persists in Keychain
        // Make it sequential to avoid race conditions
        #if DEBUG
        Task {
            // Force logout on launch (dev only) so session doesn't persist between runs
            await AuthService.shared.signOut()
            await SessionManager.shared.logout()
            await AuthService.shared.ensureSessionRestored()
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
            ZStack {
                ContentView()
                    .environmentObject(sessionManager)
                    .environmentObject(quickAction)
                    .environmentObject(DeepLinkRouter.shared)
                    .preferredColorScheme(.dark)
                    .background(RMTheme.Colors.background)
                    #if DEBUG
                    .debugOverlay()
                    #endif
                    .sheet(isPresented: $quickAction.isEvidenceSheetPresented) {
                        EvidenceCaptureSheet(
                            jobId: quickAction.evidenceJobId,
                            onComplete: {
                                // Optional: refresh jobs cache after upload
                                Task {
                                    _ = try? await JobsStore.shared.fetch(forceRefresh: true)
                                }
                            }
                        )
                    }
                    .onOpenURL { url in
                        Task { @MainActor in
                            _ = DeepLinkRouter.shared.handle(url)
                        }
                    }
                    .onChange(of: scenePhase) { oldPhase, newPhase in
                        // Handle app lifecycle
                        handleScenePhaseChange(from: oldPhase, to: newPhase)
                    }
                    .onChange(of: serverStatus.isOnline) { wasOnline, isOnline in
                        // Auto-sync when network restored
                        if !wasOnline && isOnline {
                            Task {
                                await OfflineCache.shared.sync()
                                JobsStore.shared.refreshPendingJobs()
                            }
                        }
                    }
                
                // Global toast container
                ToastContainer()
            }
            .sheet(isPresented: .constant(ProcessInfo.processInfo.arguments.contains("RISKMATE_UI_TEST_CONFLICT_SHEET"))) {
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
            .sheet(isPresented: .constant(ProcessInfo.processInfo.arguments.contains("RISKMATE_UI_TEST_CONFLICT_HISTORY"))) {
                ConflictHistoryView()
            }
            .sheet(isPresented: .constant(ProcessInfo.processInfo.arguments.contains("RISKMATE_UI_TEST_CONFLICT_SHEET_MERGE"))) {
                // Hazard conflict is merge-capable: Merge button should be visible
                ConflictResolutionSheet(
                    conflict: SyncConflict(
                        entityType: "hazard",
                        entityId: "hazard-1",
                        field: "name",
                        serverValue: "Server Hazard" as AnyHashable,
                        localValue: "Local Hazard" as AnyHashable,
                        serverTimestamp: Date().addingTimeInterval(-3600),
                        localTimestamp: Date()
                    ),
                    entityLabel: "hazard",
                    onResolve: { _ in },
                    onCancel: {}
                )
            }
        }
    }
    
    @Environment(\.scenePhase) private var scenePhase
    
    private func handleScenePhaseChange(from oldPhase: ScenePhase, to newPhase: ScenePhase) {
        switch newPhase {
        case .background, .inactive:
            // Pause timers and animations when app backgrounds
            ServerStatusManager.shared.pauseChecks()
        case .active:
            // Resume timers and check auth when app foregrounds
            ServerStatusManager.shared.resumeChecks()
            Task {
                await NotificationService.shared.refreshBadgeFromServer()
            }

            // Check for auth expiry after long background (30+ min)
            Task {
                // Small delay to let app settle
                try? await Task.sleep(nanoseconds: 500_000_000) // 0.5s
                
                // Check if session is still valid
                if sessionManager.isAuthenticated {
                    if let token = try? await AuthService.shared.getAccessToken(),
                       JWTExpiry.isExpired(token) {
                        print("[RiskmateApp] ⚠️ Token expired while backgrounded, logging out...")
                        await sessionManager.logout()
                    }
                }
            }
        @unknown default:
            break
        }
    }
}

// MARK: - AppDelegate (Background URLSession + Push)

final class AppDelegate: NSObject, UIApplicationDelegate {

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = NotificationService.shared
        application.registerForRemoteNotifications()
        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        NotificationService.shared.setDeviceToken(deviceToken)
        Task {
            await NotificationService.shared.registerDeviceTokenIfAuthenticated(deviceToken)
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        print("[AppDelegate] Remote notifications registration failed: \(error.localizedDescription)")
    }

    func application(
        _ application: UIApplication,
        handleEventsForBackgroundURLSession identifier: String,
        completionHandler: @escaping () -> Void
    ) {
        BackgroundUploadManager.shared.setBackgroundCompletionHandler(completionHandler)
    }
}
