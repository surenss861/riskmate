import SwiftUI

@main
struct RiskmateApp: App {
    @StateObject private var sessionManager = SessionManager.shared
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(sessionManager)
                .background(DesignSystem.Colors.background)
                .preferredColorScheme(.dark)
        }
    }
}
