import SwiftUI
import Combine
import UIKit

struct ContentView: View {
    @StateObject private var sessionManager = SessionManager.shared
    @StateObject private var serverStatus = ServerStatusManager.shared
    @StateObject private var entitlements = EntitlementsManager.shared
    @EnvironmentObject private var quickAction: QuickActionRouter
    @EnvironmentObject private var deepLinkRouter: DeepLinkRouter
    @State private var selectedTab: MainTab = .operations
    @State private var selectedSidebarItem: SidebarItem? = .operations
    @State private var showOnboarding = false
    @State private var showFirstRunOnboarding = false
    @State private var backendHealthCheckComplete = false
    @State private var backendHealthError: String?
    @State private var workRecordsFilter: String? = nil
    @State private var showJobFromDeepLink = false
    @State private var deepLinkJobId: String?
    @State private var deepLinkJobTab: JobDetailTab?
    @State private var deepLinkHazardId: String?
    @State private var showReportFromDeepLink = false
    @State private var deepLinkReportRunId: String?
    @State private var showNotificationCenterFromDeepLink = false
    @State private var showCommentFromDeepLink = false
    @State private var deepLinkCommentId: String?
    @State private var showExportHistorySheet = false
    @State private var showCreateJobSheet = false
    @Namespace private var tabBarNamespace
    @State private var tabDragOffset: CGFloat = 0
    @StateObject private var motionObserver = RMMotionObserver.shared

    private var isAuditor: Bool {
        entitlements.isAuditor()
    }
    
    var body: some View {
        let _ = motionObserver.reduceMotion
        return ZStack {
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
                    Group {
                        if UIDevice.current.userInterfaceIdiom == .pad {
                            iPadNavigation
                        } else {
                            iPhoneNavigation
                        }
                    }
                    .safeAreaInset(edge: .top, spacing: 0) {
                        if serverStatus.recentlyDegraded {
                            Text("Some features are temporarily unavailable.")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundColor(RMTheme.Colors.textSecondary)
                                .padding(.horizontal, RMTheme.Spacing.pagePadding)
                                .padding(.vertical, 8)
                                .frame(maxWidth: .infinity)
                                .background(RMTheme.Colors.surface2.opacity(0.95))
                                .overlay(Rectangle().frame(height: 1).foregroundColor(RMTheme.Colors.border.opacity(0.5)), alignment: .bottom)
                        }
                    }
                }
            } else {
                // ONLY unauthenticated entry: hero auth (AuthView = AuthHeroShell). No other login/signup view.
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
        .onChange(of: deepLinkRouter.pendingJobId) { _, new in
            guard let jobId = new else { return }
            deepLinkJobId = jobId
            deepLinkJobTab = deepLinkRouter.pendingJobTab.flatMap(JobDetailTab.init(rawValue:))
            deepLinkHazardId = deepLinkRouter.pendingHazardId
            showJobFromDeepLink = true
        }
        .onChange(of: deepLinkRouter.pendingReportRunId) { _, new in
            guard let runId = new else { return }
            deepLinkReportRunId = runId
            showReportFromDeepLink = true
        }
        .onChange(of: deepLinkRouter.openNotifications) { _, open in
            if open {
                selectedTab = .settings
                showNotificationCenterFromDeepLink = true
                deepLinkRouter.clearPending()
            }
        }
        .onChange(of: deepLinkRouter.pendingCommentId) { _, new in
            guard let commentId = new else { return }
            deepLinkCommentId = commentId
            showCommentFromDeepLink = true
        }
        .fullScreenCover(isPresented: $showNotificationCenterFromDeepLink, onDismiss: {
            showNotificationCenterFromDeepLink = false
        }) {
            NavigationStack {
                NotificationCenterView()
            }
        }
        .fullScreenCover(isPresented: $showReportFromDeepLink, onDismiss: {
            deepLinkRouter.clearPending()
            deepLinkReportRunId = nil
            showReportFromDeepLink = false
        }) {
            Group {
                if let runId = deepLinkReportRunId {
                    ReportRunDeepLinkView(reportRunId: runId)
                        .environmentObject(quickAction)
                } else {
                    EmptyView()
                }
            }
        }
        .fullScreenCover(isPresented: $showJobFromDeepLink, onDismiss: {
            deepLinkRouter.clearPending()
            deepLinkJobId = nil
            deepLinkJobTab = nil
            deepLinkHazardId = nil
            showJobFromDeepLink = false
        }) {
            Group {
                if let jobId = deepLinkJobId {
                    JobDetailView(jobId: jobId, initialTab: deepLinkJobTab, initialHazardId: deepLinkHazardId)
                        .environmentObject(quickAction)
                } else {
                    EmptyView()
                }
            }
        }
        .fullScreenCover(isPresented: $showCommentFromDeepLink, onDismiss: {
            deepLinkRouter.clearPending()
            deepLinkCommentId = nil
            showCommentFromDeepLink = false
        }) {
            Group {
                if let commentId = deepLinkCommentId {
                    CommentDeepLinkView(signoffId: commentId)
                        .environmentObject(quickAction)
                } else {
                    EmptyView()
                }
            }
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
    
    // MARK: - iPhone Navigation (sliding tab transition + safeAreaInset for tab bar)

    private let tabOrder: [MainTab] = [.operations, .ledger, .workRecords, .settings]

    private func tabIndex(_ tab: MainTab) -> Int {
        tabOrder.firstIndex(of: tab) ?? 0
    }

    private static let tabSpring = Animation.interactiveSpring(response: 0.40, dampingFraction: 0.88, blendDuration: 0.2)

    private var iPhoneNavigation: some View {
        let bottomPad: CGFloat = !entitlements.isAuditor() && selectedTab == .workRecords ? 126 : 74
        return GeometryReader { geo in
            let width = geo.size.width
            ZStack {
                ZStack {
                    tabScreen(.operations, bottomPadding: bottomPad) {
                        OperationsView(onKPINavigate: { filter in
                            quickAction.requestSwitchToWorkRecords(filter: filter)
                        })
                        .rmNavigationBar(title: "Operations")
                    }
                    .offset(x: CGFloat(tabIndex(.operations) - tabIndex(selectedTab)) * width + tabDragOffset)
                    .scaleEffect(selectedTab == .operations ? 1.0 : 0.985)
                    .opacity(selectedTab == .operations ? 1.0 : 0.92)
                    .allowsHitTesting(selectedTab == .operations)

                    tabScreen(.ledger, bottomPadding: bottomPad) {
                        AuditFeedView()
                            .rmNavigationBar(title: "Ledger")
                    }
                    .offset(x: CGFloat(tabIndex(.ledger) - tabIndex(selectedTab)) * width + tabDragOffset)
                    .scaleEffect(selectedTab == .ledger ? 1.0 : 0.985)
                    .opacity(selectedTab == .ledger ? 1.0 : 0.92)
                    .allowsHitTesting(selectedTab == .ledger)

                    tabScreen(.workRecords, bottomPadding: bottomPad) {
                        JobsListView(initialFilter: workRecordsFilter)
                            .rmNavigationBar(title: "Work Records")
                    }
                    .offset(x: CGFloat(tabIndex(.workRecords) - tabIndex(selectedTab)) * width + tabDragOffset)
                    .scaleEffect(selectedTab == .workRecords ? 1.0 : 0.985)
                    .opacity(selectedTab == .workRecords ? 1.0 : 0.92)
                    .allowsHitTesting(selectedTab == .workRecords)

                    tabScreen(.settings, bottomPadding: bottomPad) {
                        AccountView()
                    }
                    .offset(x: CGFloat(tabIndex(.settings) - tabIndex(selectedTab)) * width + tabDragOffset)
                    .scaleEffect(selectedTab == .settings ? 1.0 : 0.985)
                    .opacity(selectedTab == .settings ? 1.0 : 0.92)
                    .allowsHitTesting(selectedTab == .settings)
                }
                .animation(Self.tabSpring, value: selectedTab)
                .animation(Self.tabSpring, value: tabDragOffset)
                .clipped()
                .contentShape(Rectangle())
                // Swipe-between-tabs: gesture only on sliding content so top bar taps are never intercepted
                .gesture(
                    DragGesture(minimumDistance: 20)
                        .onChanged { value in
                            let tx = value.translation.width
                            let idx = tabIndex(selectedTab)
                            let maxDrag: CGFloat = width * 0.6
                            if tx > 0, idx == 0 { tabDragOffset = tx * 0.4 }
                            else if tx < 0, idx == tabOrder.count - 1 { tabDragOffset = tx * 0.4 }
                            else { tabDragOffset = min(max(tx, -maxDrag), maxDrag) }
                        }
                        .onEnded { value in
                            let threshold = width * 0.28
                            let idx = tabIndex(selectedTab)
                            if value.translation.width < -threshold, idx < tabOrder.count - 1 {
                                Haptics.tap()
                                withAnimation(Self.tabSpring) {
                                    selectedTab = tabOrder[idx + 1]
                                    tabDragOffset = 0
                                }
                            } else if value.translation.width > threshold, idx > 0 {
                                Haptics.tap()
                                withAnimation(Self.tabSpring) {
                                    selectedTab = tabOrder[idx - 1]
                                    tabDragOffset = 0
                                }
                            } else {
                                withAnimation(Self.tabSpring) {
                                    tabDragOffset = 0
                                }
                            }
                        }
                )
            }
        }
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 0) {
                if !entitlements.isAuditor() && selectedTab == .workRecords {
                    AddEvidenceDockedBar(onTap: { quickAction.presentEvidence(jobId: nil) })
                }
                RMTabBar(selection: $selectedTab, namespace: tabBarNamespace)
                    .zIndex(999)
            }
        }
        .onReceive(quickAction.$requestedTab.compactMap { $0 }) { _ in
            guard let (tab, filter) = quickAction.consumeTabRequest() else { return }
            workRecordsFilter = filter
            withAnimation(Self.tabSpring) { selectedTab = tab }
        }
        .onChange(of: quickAction.showNotificationCenter) { _, show in
            if show {
                selectedTab = .settings
                showNotificationCenterFromDeepLink = true
                quickAction.dismissNotificationCenterRequest()
            }
        }
        .onChange(of: quickAction.showCreateJobSheet) { _, show in
            if show {
                showCreateJobSheet = true
                quickAction.dismissCreateJobSheet()
            }
        }
        .sheet(isPresented: $showCreateJobSheet, onDismiss: {
            quickAction.dismissCreateJobSheet()
        }) {
            CreateJobSheet()
        }
        .task {
            selectedTab = entitlements.isAuditor() ? .ledger : .operations
        }
    }

    @ViewBuilder
    private func tabScreen<Content: View>(_ tab: MainTab, bottomPadding: CGFloat, @ViewBuilder content: () -> Content) -> some View {
        NavigationStack {
            content()
                .padding(.bottom, bottomPadding)
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
                        DashboardView(
                            onNavigateToTeam: { selectedSidebarItem = .team },
                            onNavigateToExports: { showExportHistorySheet = true }
                        )
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
                        DashboardView(
                            onNavigateToTeam: { selectedSidebarItem = .team },
                            onNavigateToExports: { showExportHistorySheet = true }
                        )
                    }
                }
            }
        }
        .sheet(isPresented: $showExportHistorySheet) {
            ExportHistoryOverviewView()
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

// MARK: - Notification permission education (pre-prompt)

/// Pre-permission modal shown when we would request notification authorization.
/// Outlines benefits; only calls requestAuthorization after user taps "Enable".
/// Docked "Add Evidence" bar above tab bar (Work Records) — native, no overlap.
private struct AddEvidenceDockedBar: View {
    var onTap: () -> Void

    private static let barHeight: CGFloat = 52

    var body: some View {
        Button(action: {
            Haptics.tap()
            onTap()
        }) {
            HStack(spacing: 8) {
                Image(systemName: "camera.fill")
                    .font(.system(size: 18, weight: .semibold))
                Text("Add Evidence")
                    .font(.system(size: 16, weight: .semibold))
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .frame(height: Self.barHeight)
            .background(RMTheme.Colors.accent)
        }
        .buttonStyle(.plain)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Color.white.opacity(0.06))
                .frame(height: 1)
        }
    }
}

struct NotificationPermissionEducationView: View {
    let onEnable: () -> Void
    let onNotNow: () -> Void

    var body: some View {
        VStack(spacing: RMTheme.Spacing.xl) {
            Image(systemName: "bell.badge.fill")
                .font(.system(size: 56))
                .foregroundColor(RMTheme.Colors.accent)

            VStack(spacing: RMTheme.Spacing.sm) {
                Text("Stay in the loop")
                    .font(RMTheme.Typography.title2)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                Text("Enable notifications to get job updates, signature requests, and important alerts from your team.")
                    .font(RMTheme.Typography.body)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
            }

            VStack(spacing: RMTheme.Spacing.md) {
                Button {
                    onEnable()
                } label: {
                    Text("Enable")
                        .font(RMTheme.Typography.bodyBold)
                        .foregroundColor(.black)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, RMTheme.Spacing.md)
                        .background(RMTheme.Colors.accent)
                        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.md))
                }
                Button {
                    onNotNow()
                } label: {
                    Text("Not Now")
                        .font(RMTheme.Typography.body)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                }
            }
            .padding(.horizontal, RMTheme.Spacing.lg)
        }
        .padding(RMTheme.Spacing.xl)
        .background(RMTheme.Colors.background)
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

// MARK: - Comment (sign-off) deep link

private struct CommentDeepLinkView: View {
    let signoffId: String
    @State private var jobId: String?
    @State private var loadError: String?
    @Environment(\.dismiss) private var dismiss

    @ViewBuilder
    private var content: some View {
        if let jobId = jobId {
            JobDetailView(jobId: jobId, initialTab: .signatures)
                .environmentObject(QuickActionRouter.shared)
        } else if let error = loadError {
            VStack(spacing: RMTheme.Spacing.lg) {
                Text("Could not open comment")
                    .font(RMTheme.Typography.headingSmall)
                Text(error)
                    .font(RMTheme.Typography.body)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
                Button("Dismiss") {
                    dismiss()
                }
                .buttonStyle(.borderedProminent)
            }
            .padding(RMTheme.Spacing.pagePadding)
        } else {
            VStack(spacing: RMTheme.Spacing.lg) {
                RMSkeletonView(width: 80, height: 80, cornerRadius: 12)
                Text("Loading…")
                    .font(RMTheme.Typography.body)
                    .foregroundColor(RMTheme.Colors.textSecondary)
            }
        }
    }

    var body: some View {
        content
            .task {
                guard jobId == nil, loadError == nil else { return }
                do {
                    let resolvedJobId = try await APIClient.shared.getJobIdForSignoff(signoffId: signoffId)
                    jobId = resolvedJobId
                } catch {
                    loadError = error.localizedDescription
                }
            }
    }
}

// MARK: - Report run deep link

private struct ReportRunDeepLinkView: View {
    let reportRunId: String
    @State private var jobId: String?
    @State private var loadError: String?
    @Environment(\.dismiss) private var dismiss

    @ViewBuilder
    private var content: some View {
        if let jobId = jobId {
            JobDetailView(jobId: jobId, initialTab: .signatures)
                .environmentObject(QuickActionRouter.shared)
        } else if let error = loadError {
            VStack(spacing: RMTheme.Spacing.lg) {
                Text("Could not load report")
                    .font(RMTheme.Typography.headingSmall)
                Text(error)
                    .font(RMTheme.Typography.body)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
                Button("Dismiss") {
                    dismiss()
                }
                .buttonStyle(.borderedProminent)
            }
            .padding(RMTheme.Spacing.pagePadding)
        } else {
            VStack(spacing: RMTheme.Spacing.lg) {
                RMSkeletonView(width: 80, height: 80, cornerRadius: 12)
                Text("Loading report…")
                    .font(RMTheme.Typography.body)
                    .foregroundColor(RMTheme.Colors.textSecondary)
            }
        }
    }

    var body: some View {
        content
            .task {
                guard jobId == nil, loadError == nil else { return }
                do {
                    let run = try await APIClient.shared.getReportRun(reportRunId: reportRunId)
                    jobId = run.jobId
                } catch {
                    loadError = error.localizedDescription
                }
            }
    }
}

// MARK: - Sidebar

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
