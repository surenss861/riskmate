import SwiftUI

struct ContentView: View {
    @StateObject private var sessionManager = SessionManager.shared
    
    var body: some View {
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
            } else {
                LoginView()
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
