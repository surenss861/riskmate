import SwiftUI

struct ContentView: View {
    @StateObject private var sessionManager = SessionManager.shared
    @State private var selectedTab: MainTab = .dashboard
    @State private var selectedSidebarItem: SidebarItem? = .dashboard
    @State private var showOnboarding = false
    
    var body: some View {
        ZStack {
            RMBackground()
            
            if sessionManager.isLoading {
                VStack(spacing: RMTheme.Spacing.lg) {
                    RMSkeletonView(width: 100, height: 100, cornerRadius: 20)
                    RMSkeletonView(width: 150, height: 20)
                }
            } else if sessionManager.isAuthenticated {
                // Check onboarding
                if showOnboarding {
                    OnboardingView(isPresented: $showOnboarding)
                } else {
                    // Device-aware navigation
                    if UIDevice.current.userInterfaceIdiom == .pad {
                        iPadNavigation
                    } else {
                        iPhoneNavigation
                    }
                }
            } else {
                AuthView()
            }
        }
        .preferredColorScheme(.dark)
        .task {
            print("[ContentView] Starting session check...")
            await sessionManager.checkSession()
            print("[ContentView] Session check complete. isAuthenticated=\(sessionManager.isAuthenticated), isLoading=\(sessionManager.isLoading)")
            
            // Check if onboarding is needed
            if sessionManager.isAuthenticated {
                let onboardingComplete = UserDefaults.standard.bool(forKey: "onboarding_complete")
                showOnboarding = !onboardingComplete
            }
        }
        .onAppear {
            print("[ContentView] ✅ View appeared. isAuthenticated=\(sessionManager.isAuthenticated), isLoading=\(sessionManager.isLoading)")
        }
    }
    
    // MARK: - iPhone Navigation (TabView)
    
    private var iPhoneNavigation: some View {
        TabView(selection: $selectedTab) {
            // Operations (Dashboard) - First tab
            NavigationStack {
                OperationsView()
                    .rmNavigationBar(title: "Operations")
            }
            .tabItem {
                Label("Operations", systemImage: "briefcase.fill")
            }
            .tag(MainTab.operations)
            
            // Ledger (Audit Feed) - Second tab
            NavigationStack {
                AuditFeedView()
                    .rmNavigationBar(title: "Ledger")
            }
            .tabItem {
                Label("Ledger", systemImage: "list.bullet.rectangle")
            }
            .tag(MainTab.ledger)
            
            // Work Records (Jobs) - Third tab
            NavigationStack {
                JobsListView()
                    .rmNavigationBar(title: "Work Records")
            }
            .tabItem {
                Label("Work Records", systemImage: "doc.text.fill")
            }
            .tag(MainTab.workRecords)
            
            // Settings (Account) - Fourth tab
            NavigationStack {
                AccountView()
            }
            .tabItem {
                Label("Settings", systemImage: "gearshape.fill")
            }
            .tag(MainTab.settings)
        }
        .tint(RMTheme.Colors.accent)
    }
    
    // MARK: - iPad Navigation (NavigationSplitView)
    
    private var iPadNavigation: some View {
        NavigationSplitView {
            // Sidebar
            SidebarView(selectedItem: $selectedSidebarItem)
                .navigationSplitViewColumnWidth(min: 200, ideal: 250)
        } detail: {
            // Detail View
            Group {
                switch selectedSidebarItem {
                case .dashboard:
                    NavigationStack {
                        DashboardView()
                    }
                case .operations:
                    NavigationStack {
                        OperationsView()
                            .rmNavigationBar(title: "Operations")
                    }
                case .readiness:
                    NavigationStack {
                        ReadinessView()
                    }
                case .executive:
                    NavigationStack {
                        ExecutiveViewRedesigned()
                    }
                case .jobs:
                    NavigationStack {
                        JobsListView()
                            .rmNavigationBar(title: "Work Records")
                    }
                case .audit:
                    NavigationStack {
                        AuditFeedView()
                            .rmNavigationBar(title: "Ledger")
                    }
                case .team:
                    NavigationStack {
                        TeamView()
                    }
                case .account:
                    NavigationStack {
                        AccountView()
                    }
                case .none:
                    NavigationStack {
                        DashboardView()
                    }
                }
            }
        }
        .navigationSplitViewStyle(.balanced)
    }
}

// MARK: - Sidebar View

struct SidebarView: View {
    @Binding var selectedItem: SidebarItem?
    
    var body: some View {
        List(selection: $selectedItem) {
            Section("Main") {
                SidebarRow(
                    item: .dashboard,
                    icon: "chart.bar.fill",
                    title: "Dashboard",
                    selectedItem: $selectedItem
                )
                
                SidebarRow(
                    item: .operations,
                    icon: "briefcase.fill",
                    title: "Operations",
                    selectedItem: $selectedItem
                )
            }
            
            Section("Audit") {
                SidebarRow(
                    item: .readiness,
                    icon: "checkmark.shield.fill",
                    title: "Audit Readiness",
                    selectedItem: $selectedItem
                )
                
                SidebarRow(
                    item: .executive,
                    icon: "building.2.fill",
                    title: "Executive",
                    selectedItem: $selectedItem
                )
                
                SidebarRow(
                    item: .jobs,
                    icon: "doc.text.fill",
                    title: "Work Records",
                    selectedItem: $selectedItem
                )
                
                SidebarRow(
                    item: .audit,
                    icon: "list.bullet.rectangle",
                    title: "Ledger",
                    selectedItem: $selectedItem
                )
            }
            
            Section("Team") {
                SidebarRow(
                    item: .team,
                    icon: "person.2.fill",
                    title: "Team",
                    selectedItem: $selectedItem
                )
            }
            
            Section("Settings") {
                SidebarRow(
                    item: .account,
                    icon: "gearshape.fill",
                    title: "Settings",
                    selectedItem: $selectedItem
                )
            }
        }
        .listStyle(.sidebar)
        .navigationTitle("RiskMate")
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarBackground(RMTheme.Colors.background, for: .navigationBar)
        .onAppear {
            if selectedItem == nil {
                selectedItem = .dashboard
            }
        }
    }
}

struct SidebarRow: View {
    let item: SidebarItem
    let icon: String
    let title: String
    @Binding var selectedItem: SidebarItem?
    
    var body: some View {
        Button {
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
            selectedItem = item
        } label: {
            Label(title, systemImage: icon)
                .foregroundColor(selectedItem == item ? RMTheme.Colors.accent : RMTheme.Colors.textPrimary)
        }
        .tag(item)
    }
}

// MARK: - Enums

enum MainTab: String {
    case operations
    case ledger
    case workRecords
    case settings
}

enum SidebarItem: String, Hashable {
    case dashboard
    case operations
    case readiness
    case executive
    case jobs
    case audit
    case team
    case account
}

#Preview {
    ContentView()
}
