import SwiftUI

@main
struct RiskmateApp: App {
    @StateObject private var sessionManager = SessionManager.shared
    
    init() {
        print("[RiskmateApp] 🚀 App initializing...")
        print("[RiskmateApp] SessionManager state: isAuthenticated=\(sessionManager.isAuthenticated), isLoading=\(sessionManager.isLoading)")
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(sessionManager)
                .background(DesignSystem.Colors.background)
                .preferredColorScheme(.dark)
                .onAppear {
                    print("[RiskmateApp] ✅ WindowGroup appeared")
                }
        }
    }
}
