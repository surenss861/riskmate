import SwiftUI
import Combine

struct ContentView: View {
    @StateObject private var sessionManager = SessionManager.shared
    @StateObject private var serverStatus = ServerStatusManager.shared
    @StateObject private var entitlements = EntitlementsManager.shared
    @EnvironmentObject private var quickAction: QuickActionRouter
    @State private var selectedTab: MainTab = .operations
    @State private var selectedSidebarItem: SidebarItem? = .operations
    @State private var showOnboarding = false
    @State private var showFirstRunOnboarding = false
    @State private var backendHealthCheckComplete = false
    @State private var backendHealthError: String?
    @State private var workRecordsFilter: String? = nil
    
    private var isAuditor: Bool {
        entitlements.isAuditor()
    }
    
    var body: some View {
        ZStack {
            RMBackground()
            
            // Backend health check gate (show error if backend unavailable)
            if !backendHealthCheckComplete {
                VStack(spacing: RMTheme.Spacing.lg) {
                    RMSkeletonView(width: 100, height: 100, cornerRadius: 20)
                    Text("Checking backend connection...")
                        .font(RMTheme.Typography.body)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                }
            } else if let error = backendHealthError {
                // Backend unavailable - show error with retry
                RMEmptyState(
                    icon: "exclamationmark.triangle.fill",
                    title: "Backend Unavailable",
                    message: error,
                    action: RMEmptyStateAction(
                        title: "Retry",
                        action: {
                            Task {
                                await checkBackendHealth()
                            }
                        }
                    )
                )
                .padding(RMTheme.Spacing.pagePadding)
            } else if sessionManager.isLoading || !sessionManager.isBootstrapped {
                // Show polished splash screen during bootstrap
                SplashView()
            } else if sessionManager.isAuthenticated {
                // Check trust onboarding (per-user if available, otherwise per-device)
                let userId = sessionManager.currentUser?.id ?? ""
                let hasSeenOnboarding = userId.isEmpty
                    ? UserDefaultsManager.Onboarding.hasSeenDeviceOnboarding()
                    : UserDefaultsManager.Onboarding.hasSeenOnboarding(userId: userId)
                
                if !hasSeenOnboarding {
                    TrustOnboardingView(isPresented: .constant(true))
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
            // First: Check backend health (gate)
            await checkBackendHealth()
            
            // Only proceed if backend is healthy
            guard backendHealthError == nil else {
                return
            }
            
            print("[ContentView] Starting session check...")
            await sessionManager.checkSession()
            print("[ContentView] Session check complete. isAuthenticated=\(sessionManager.isAuthenticated), isLoading=\(sessionManager.isLoading)")
            
            // Load entitlements after authentication
            if sessionManager.isAuthenticated {
                await entitlements.refresh(force: true)
            }
            
            // Trust onboarding is handled in view body above
        }
        .onAppear {
            print("[ContentView] ✅ View appeared. isAuthenticated=\(sessionManager.isAuthenticated), isLoading=\(sessionManager.isLoading)")
        }
    }
    
    private func checkBackendHealth() async {
        backendHealthCheckComplete = false
        backendHealthError = nil
        
        do {
            try await serverStatus.requireHealthyBackend()
            backendHealthError = nil
            print("[ContentView] ✅ Backend health check passed")
        } catch {
            let errorDesc = error.localizedDescription
            backendHealthError = errorDesc
            print("[ContentView] ❌ Backend health check failed: \(errorDesc)")
        }
        
        backendHealthCheckComplete = true
    }
    
    // MARK: - iPhone Navigation (TabView)
    
    private var iPhoneNavigation: some View {
        TabView(selection: $selectedTab) {
            // Operations (Dashboard) - First tab (always visible)
            NavigationStack {
                OperationsView(onKPINavigate: { filter in
                    quickAction.requestSwitchToWorkRecords(filter: filter)
                })
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
                JobsListView(initialFilter: workRecordsFilter)
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
        .onReceive(quickAction.$requestedTab.compactMap { $0 }) { _ in
            guard let (tab, filter) = quickAction.consumeTabRequest() else { return }
            workRecordsFilter = filter
            selectedTab = tab
        }
        .overlay(alignment: .bottomTrailing) {
            // Global FAB for quick evidence capture (hidden for auditors and on Operations tab)
            if !entitlements.isAuditor() && selectedTab != .operations {
                Button {
                    quickAction.presentEvidence(jobId: nil)
                } label: {
                    Image(systemName: "camera.fill")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundColor(.white)
                        .frame(width: 56, height: 56)
                        .background(RMTheme.Colors.accent)
                        .clipShape(Circle())
                        .shadow(color: .black.opacity(0.2), radius: 8, x: 0, y: 4)
                }
                .padding(.trailing, 20)
                .padding(.bottom, 100) // Above tab bar
            }
        }
        .task {
            // Set initial tab based on role (deterministic, runs once)
            // Auditors start on Ledger, operators start on Operations
            if entitlements.isAuditor() {
                selectedTab = .ledger
            } else {
                selectedTab = .operations
            }
        }
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
                        OperationsView(onKPINavigate: { filter in
                            quickAction.requestSwitchToWorkRecords(filter: filter)
                        })
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
                        JobsListView(initialFilter: workRecordsFilter)
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
        .onReceive(quickAction.$requestedTab.compactMap { $0 }) { _ in
            guard let (tab, filter) = quickAction.consumeTabRequest() else { return }
            workRecordsFilter = filter
            switch tab {
            case .ledger: selectedSidebarItem = .audit
            case .workRecords: selectedSidebarItem = .jobs
            case .operations: selectedSidebarItem = .operations
            case .settings: selectedSidebarItem = .account
            }
        }
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
        .navigationTitle("Riskmate")
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
        .environmentObject(QuickActionRouter.shared)
}
