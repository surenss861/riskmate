import SwiftUI

struct ContentView: View {
    @StateObject private var sessionManager = SessionManager.shared
    
    var body: some View {
        ZStack {
            // Ensure background is always applied
            DesignSystem.Colors.background
                .ignoresSafeArea(.all)
            
            // Always show something - never return empty
            if sessionManager.isLoading {
                // Loading state - show progress indicator
                VStack(spacing: DesignSystem.Spacing.lg) {
                    ProgressView()
                        .tint(DesignSystem.Colors.accent)
                        .scaleEffect(1.5)
                    Text("Loading...")
                        .font(DesignSystem.Typography.body)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                }
            } else if sessionManager.isAuthenticated {
                // Authenticated - show main tabs
                TabView {
                    OperationsView()
                        .tabItem {
                            Label("Operations", systemImage: "briefcase")
                        }
                    
                    AuditView()
                        .tabItem {
                            Label("Audit", systemImage: "doc.text")
                        }
                    
                    AccountView()
                        .tabItem {
                            Label("Account", systemImage: "person.circle")
                        }
                }
                .preferredColorScheme(.dark)
            } else {
                // Not authenticated - show auth view
                AuthView()
            }
        }
        .preferredColorScheme(.dark)
        .task {
            print("[ContentView] Starting session check...")
            await sessionManager.checkSession()
            print("[ContentView] Session check complete. isAuthenticated=\(sessionManager.isAuthenticated), isLoading=\(sessionManager.isLoading)")
        }
        .onAppear {
            print("[ContentView] ✅ View appeared. isAuthenticated=\(sessionManager.isAuthenticated), isLoading=\(sessionManager.isLoading)")
        }
    }
}

#Preview {
    ContentView()
}
