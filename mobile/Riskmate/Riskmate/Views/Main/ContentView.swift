import SwiftUI

struct ContentView: View {
    @StateObject private var sessionManager = SessionManager.shared
    
    var body: some View {
        ZStack {
            // Ensure background is always applied
            DesignSystem.Colors.background
                .ignoresSafeArea(.all)
            
            Group {
                if sessionManager.isAuthenticated {
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
                    AuthView()
                }
            }
        }
        .task {
            await sessionManager.checkSession()
        }
    }
}

#Preview {
    ContentView()
}
