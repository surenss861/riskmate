import SwiftUI
import PDFKit
import UserNotifications

/// Job Detail screen: Overview + Evidence always; Hazards/Controls only when content exists. No Exports tab.
struct JobDetailView: View {
    let jobId: String
    /// When set (e.g. from deep link), select this tab when the view appears.
    var initialTab: JobDetailTab? = nil
    /// When set (e.g. from riskmate://jobs/{id}/hazards/{hazardId}), scroll/focus this hazard when the hazards tab is shown.
    var initialHazardId: String? = nil
    @State private var selectedTab: JobDetailTab = .overview
    @State private var job: Job?
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var showPDFViewer = false
    @State private var pdfURL: URL?
    @State private var showExportProofSheet = false
    @State private var showExportHistory = false
    @State private var hasFailedExport = false
    @State private var hazardsCount: Int = 0
    @State private var controlsCount: Int = 0
    @State private var isLoadingHazards = false
    @State private var isLoadingControls = false
    @State private var evidenceCountForExport: Int = 0
    @State private var evidenceRequiredForExport: Int = 5
    @State private var showEditJobSheet = false
    @StateObject private var jobsStore = JobsStore.shared
    @StateObject private var statusManager = ServerStatusManager.shared
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var quickAction: QuickActionRouter
    
    /// Tabs to show: Overview + Activity + Signatures + Evidence always; Hazards/Controls only when API returns count > 0
    private var visibleTabs: [JobDetailTab] {
        [.overview]
        + (hazardsCount > 0 ? [.hazards] : [])
        + (controlsCount > 0 ? [.controls] : [])
        + [.activity, .signatures, .evidence]
    }
    
    /// Single source of truth: validate selection when counts or loading state change. Only reset when loading finished and count is 0 (no jank during load).
    private var tabValidationKey: TabValidationKey {
        TabValidationKey(h: hazardsCount, c: controlsCount, loadingH: isLoadingHazards, loadingC: isLoadingControls)
    }
    
    var body: some View {
        RMBackground()
            .overlay {
                if isLoading {
                    VStack(spacing: RMTheme.Spacing.lg) {
                        RMSkeletonCard()
                        RMSkeletonList(count: 3)
                    }
                    .padding(RMTheme.Spacing.pagePadding)
                } else if let errorMessage = errorMessage {
                    // Error state - show error with retry
                    RMEmptyState(
                        icon: "exclamationmark.triangle.fill",
                        title: "Failed to Load Job",
                        message: errorMessage,
                        action: RMEmptyStateAction(
                            title: "Retry",
                            action: {
                                Task {
                                    await loadJob()
                                }
                            }
                        )
                    )
                    .padding(RMTheme.Spacing.pagePadding)
                } else if let job = job {
                    VStack(spacing: 0) {
                        // Changes will sync banner when offline or when job has pending updates
                        if !statusManager.isOnline || !OfflineDatabase.shared.getPendingUpdates(entityType: "job", entityId: jobId).isEmpty {
                            HStack(spacing: RMTheme.Spacing.sm) {
                                Image(systemName: "clock.fill")
                                    .foregroundColor(RMTheme.Colors.warning)
                                Text("Changes will sync when online")
                                    .font(RMTheme.Typography.bodySmall)
                                    .foregroundColor(RMTheme.Colors.textSecondary)
                            }
                            .padding(RMTheme.Spacing.md)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(RMTheme.Colors.warning.opacity(0.15))
                            .padding(.horizontal, RMTheme.Spacing.pagePadding)
                            .padding(.top, RMTheme.Spacing.md)
                        }
                        // Read-only banner for auditors
                        if EntitlementsManager.shared.isAuditor() {
                            ReadOnlyBanner()
                                .padding(.horizontal, RMTheme.Spacing.pagePadding)
                                .padding(.top, RMTheme.Spacing.md)
                        }
                        
                        // Sticky segmented control (only visible tabs; no Exports)
                        Picker("Job sections", selection: $selectedTab) {
                            ForEach(visibleTabs, id: \.self) { tab in
                                Text(tab.title).tag(tab)
                            }
                        }
                        .pickerStyle(.segmented)
                        .accessibilityLabel("Job sections")
                        .accessibilityHint("Tabs: \(visibleTabs.map(\.title).joined(separator: ", "))")
                        .padding(.horizontal, RMTheme.Spacing.pagePadding)
                        .onAppear {
                            if let tab = initialTab, visibleTabs.contains(tab) {
                                selectedTab = tab
                            }
                        }
                        .padding(.vertical, RMTheme.Spacing.sm)
                        .background(RMTheme.Colors.background)
                        .onChange(of: tabValidationKey) { _, _ in
                            if selectedTab == .hazards && !isLoadingHazards && hazardsCount == 0 {
                                selectedTab = .overview
                            } else if selectedTab == .controls && !isLoadingControls && controlsCount == 0 {
                                selectedTab = .overview
                            } else if !visibleTabs.contains(selectedTab) {
                                selectedTab = .overview
                            }
                        }
                        
                        // Tab Content (only visible tabs)
                        TabView(selection: $selectedTab) {
                            ForEach(visibleTabs, id: \.self) { tab in
                                tabContent(for: tab, job: job)
                                    .tag(tab)
                            }
                        }
                        .tabViewStyle(.page(indexDisplayMode: .never))
                    }
                } else {
                    RMEmptyState(
                        icon: "exclamationmark.triangle",
                        title: "Job Not Found",
                        message: "This job could not be loaded"
                    )
                }
            }
            .rmNavigationBar(title: job?.clientName ?? "Job Details")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        if !EntitlementsManager.shared.isAuditor() {
                            Button {
                                Haptics.tap()
                                showEditJobSheet = true
                            } label: {
                                Label("Edit Job", systemImage: "pencil")
                            }
                        }
                        Button {
                            Haptics.tap()
                            dismiss()
                            quickAction.requestSwitchToWorkRecords(filter: nil)
                        } label: {
                            Label("View Work Records", systemImage: "doc.text.fill")
                        }
                        Button {
                            Haptics.tap()
                            dismiss()
                            quickAction.requestSwitchToLedger()
                        } label: {
                            Label("View Ledger", systemImage: "list.bullet.rectangle")
                        }
                        Button {
                            Haptics.tap()
                            showExportProofSheet = true
                        } label: {
                            Label("Export", systemImage: "square.and.arrow.up")
                        }
                        Button {
                            Haptics.tap()
                            showExportHistory = true
                        } label: {
                            Label("Export History", systemImage: "clock.arrow.circlepath")
                        }
                        Button {
                            Haptics.tap()
                            WebAppURL.openWebApp(jobId: jobId)
                        } label: {
                            Label("Open in Web App", systemImage: "globe")
                        }
                    } label: {
                        ZStack(alignment: .topTrailing) {
                            Image(systemName: "ellipsis.circle")
                                .foregroundColor(RMTheme.Colors.textSecondary)
                            if hasFailedExport {
                                Circle()
                                    .fill(Color.orange)
                                    .frame(width: 8, height: 8)
                                    .offset(x: 4, y: -4)
                            }
                        }
                    }
                    .accessibilityLabel("More actions for this job")
                }
            }
            .sheet(isPresented: $showEditJobSheet) {
                if let job = job {
                    EditJobSheet(job: job, jobBinding: $job) { updatedJob in
                        try await jobsStore.saveJobUpdate(updatedJob)
                    }
                }
            }
            .sheet(isPresented: $showExportProofSheet) {
                ExportProofSheet(
                    jobId: jobId,
                    isPresented: $showExportProofSheet,
                    evidenceCount: evidenceCountForExport,
                    evidenceRequired: evidenceRequiredForExport,
                    useProvidedCount: true
                )
            }
            .sheet(isPresented: $showExportHistory) {
                ExportHistorySheet(jobId: jobId)
                    .environmentObject(quickAction)
            }
            .onChange(of: showExportHistory) { _, isShowing in
                if !isShowing {
                    Task { await checkForFailedExports() }
                }
            }
            .onChange(of: selectedTab) { _, _ in
                // Light haptic on tab change
                Haptics.tap()
            }
            .sheet(isPresented: $showPDFViewer) {
                if let pdfURL = pdfURL {
                    RMPDFViewerScreen(url: pdfURL)
                }
            }
            .onAppear {
                // Request notification permission for export completion
                UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
            }
            .task(id: jobId) { // Use task(id:) to prevent re-fetch on unrelated re-renders
                await loadJob()
            }
            .task(id: job?.id) {
                guard job != nil else { return }
                await loadHazardsAndControlsCount()
                await loadEvidenceCountForExport()
            }
            .task(id: jobId) {
                await checkForFailedExports()
            }
            .onReceive(NotificationCenter.default.publisher(for: SyncEngine.hazardsControlsSyncDidSucceedNotification)) { notification in
                guard let notifJobId = notification.userInfo?["jobId"] as? String,
                      notifJobId == jobId || notifJobId == job?.id else { return }
                Task { await refreshJobDetail() }
            }
    }

    private func checkForFailedExports() async {
        do {
            let list = try await APIClient.shared.getExports(jobId: jobId)
            hasFailedExport = list.contains { $0.state.lowercased() == "failed" }
        } catch {
            hasFailedExport = false
        }
    }
    
    /// Used by OverviewTab pull-to-refresh to reload job, counts, and failed-export badge.
    private func refreshJobDetail() async {
        await loadJob()
        await loadHazardsAndControlsCount()
        await loadEvidenceCountForExport()
        await checkForFailedExports()
    }
    
    @ViewBuilder
    private func tabContent(for tab: JobDetailTab, job: Job?) -> some View {
        if let job = job {
            switch tab {
            case .overview:
                OverviewTab(job: job, showManagedOnWebCard: hazardsCount == 0 && controlsCount == 0, onRefresh: { await refreshJobDetail() })
            case .hazards:
                HazardsTab(jobId: jobId, initialHazardId: initialHazardId, onRefresh: { await refreshJobDetail() })
            case .controls:
                ControlsTab(jobId: jobId, onRefresh: { await refreshJobDetail() })
            case .activity:
                JobActivityView(jobId: jobId)
            case .signatures:
                JobSignaturesView(jobId: jobId, jobCreatorId: job.createdBy, onExportTapped: { showExportProofSheet = true })
            case .evidence:
                EvidenceTab(jobId: jobId)
            }
        }
    }
    
    private func loadHazardsAndControlsCount() async {
        isLoadingHazards = true
        isLoadingControls = true
        defer {
            isLoadingHazards = false
            isLoadingControls = false
        }
        do {
            async let hazards = APIClient.shared.getHazards(jobId: jobId)
            async let controls = APIClient.shared.getControls(jobId: jobId)
            let (h, c) = try await (hazards, controls)
            let pendingHazards = OfflineDatabase.shared.getPendingHazards(jobId: jobId).count
            let pendingControls = OfflineDatabase.shared.getPendingControls(jobId: jobId).count
            hazardsCount = h.count + pendingHazards
            controlsCount = c.count + pendingControls
        } catch {
            let pendingHazards = OfflineDatabase.shared.getPendingHazards(jobId: jobId).count
            let pendingControls = OfflineDatabase.shared.getPendingControls(jobId: jobId).count
            hazardsCount = pendingHazards
            controlsCount = pendingControls
        }
    }
    
    private func loadEvidenceCountForExport() async {
        do {
            let evidence = try await APIClient.shared.getEvidence(jobId: jobId)
            evidenceCountForExport = evidence.count
        } catch {
            evidenceCountForExport = 0
        }
    }
    
    private func loadJob() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        
        // Track job opened
        Analytics.shared.trackJobOpened(jobId: jobId)
        
        do {
            job = try await APIClient.shared.getJob(jobId)
            errorMessage = nil
            job = mergePendingUpdatesIntoJob(job!)
        } catch {
            // Fall back to cached or pending offline data instead of clearing
            var fallbackJob: Job?
            if let cached = OfflineCache.shared.getCachedJobs(),
               let found = cached.first(where: { $0.id == jobId }) {
                fallbackJob = found
            }
            if fallbackJob == nil {
                for row in OfflineDatabase.shared.getPendingJobs() {
                    if let decoded = try? JSONDecoder().decode(Job.self, from: row.data), decoded.id == jobId {
                        fallbackJob = decoded
                        break
                    }
                }
            }
            if var fb = fallbackJob {
                fb = mergePendingUpdatesIntoJob(fb)
                job = fb
                errorMessage = nil
            } else {
                job = nil
                errorMessage = error.localizedDescription
            }
            print("[JobDetailView] ⚠️ API failed, using offline fallback: \(fallbackJob != nil)")
        }
    }

    /// Merge pending job updates from OfflineDatabase into the displayed job
    private func mergePendingUpdatesIntoJob(_ base: Job) -> Job {
        let rows = OfflineDatabase.shared.getPendingUpdates(entityType: "job", entityId: base.id)
        guard !rows.isEmpty else { return base }
        var clientName = base.clientName
        var jobType = base.jobType
        var location = base.location
        var status = base.status
        var updatedAt = base.updatedAt
        for row in rows {
            switch row.field {
            case "client_name": clientName = row.newValue
            case "job_type": jobType = row.newValue
            case "location": location = row.newValue
            case "status": status = row.newValue
            case "updated_at": updatedAt = row.newValue
            default: break
            }
        }
        return Job(
            id: base.id,
            clientName: clientName,
            jobType: jobType,
            location: location,
            status: status,
            riskScore: base.riskScore,
            riskLevel: base.riskLevel,
            createdAt: base.createdAt,
            updatedAt: updatedAt,
            createdBy: base.createdBy,
            evidenceCount: base.evidenceCount,
            evidenceRequired: base.evidenceRequired,
            controlsCompleted: base.controlsCompleted,
            controlsTotal: base.controlsTotal
        )
    }
}

/// Equatable key for onChange; tuples cannot conform to Equatable.
private struct TabValidationKey: Equatable {
    let h: Int
    let c: Int
    let loadingH: Bool
    let loadingC: Bool
}

// MARK: - Tabs

enum JobDetailTab: String, CaseIterable {
    case overview
    case hazards
    case controls
    case activity
    case signatures
    case evidence
    
    var title: String {
        switch self {
        case .overview: return "Overview"
        case .hazards: return "Hazards"
        case .controls: return "Controls"
        case .activity: return "Activity"
        case .signatures: return "Signatures"
        case .evidence: return "Evidence"
        }
    }
}

// MARK: - Overview Tab

struct OverviewTab: View {
    let job: Job
    var showManagedOnWebCard: Bool = false
    var onRefresh: (() async -> Void)? = nil
    @State private var recentReceipts: [ActionReceipt] = []
    @State private var evidenceCount: Int = 0
    @State private var evidenceRequired: Int = 5
    @EnvironmentObject private var quickAction: QuickActionRouter
    
    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: RMTheme.Spacing.sectionSpacing) {
                // Managed on Web card when Hazards + Controls are both empty (hide those tabs)
                if showManagedOnWebCard {
                    ManagedOnWebCard(
                        onOpenWebApp: { WebAppURL.openWebApp(jobId: job.id) },
                        onViewWorkRecords: { quickAction.requestSwitchToWorkRecords(filter: nil) }
                    )
                    .padding(.horizontal, RMTheme.Spacing.pagePadding)
                }
                
                // Add Evidence CTA at top (scrolls with content; keeps header clean)
                if !EntitlementsManager.shared.isAuditor() {
                    Button {
                        Haptics.tap()
                        quickAction.presentEvidence(jobId: job.id)
                    } label: {
                        HStack(spacing: RMTheme.Spacing.sm) {
                            Image(systemName: "camera.fill")
                                .font(.system(size: 16, weight: .semibold))
                            Text("Add Evidence")
                                .font(RMTheme.Typography.bodyBold)
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.system(size: 14, weight: .medium))
                                .opacity(0.6)
                        }
                        .foregroundColor(RMTheme.Colors.textPrimary)
                        .padding(RMTheme.Spacing.md)
                        .frame(maxWidth: .infinity)
                        .background(RMTheme.Colors.accent.opacity(0.15))
                        .overlay {
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(RMTheme.Colors.accent.opacity(0.3), lineWidth: 1)
                        }
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .padding(.horizontal, RMTheme.Spacing.pagePadding)
                }
                
                // Next Step card: status + secondary "Add evidence" link (primary CTA is the top row)
                NextStepCard(
                    showPrimaryAction: !EntitlementsManager.shared.isAuditor(),
                    evidenceCount: evidenceCount,
                    evidenceRequired: evidenceRequired,
                    onAddEvidence: { quickAction.presentEvidence(jobId: job.id) },
                    onViewWorkRecords: { quickAction.requestSwitchToWorkRecords(filter: nil) },
                    onViewLedger: { quickAction.requestSwitchToLedger() }
                )
                .padding(.horizontal, RMTheme.Spacing.pagePadding)
                
                // Risk Score Card
                RiskScoreCard(job: job)
                    .padding(.horizontal, RMTheme.Spacing.pagePadding)
                
                // Status & Info
                StatusInfoCard(job: job)
                    .padding(.horizontal, RMTheme.Spacing.pagePadding)
                
                // Readiness Score (if available - would need to fetch from API)
                // Note: Job model doesn't include readinessScore, would need separate API call
                
                // Proof Readiness Meter
                RMProofReadinessMeter(
                    readiness: ProofReadiness(
                        status: .needsEvidence, // Default until we fetch readiness data
                        evidenceCount: 2, // TODO: Get from evidence
                        evidenceRequired: 5,
                        evidenceStatus: .partial,
                        controlsCompleted: 3, // TODO: Get from controls
                        controlsRequired: 5,
                        controlsStatus: .partial,
                        needsAttestation: false
                    )
                )
                .padding(.horizontal, RMTheme.Spacing.pagePadding)
                
                // Recorded Strip
                RMRecordedStrip(
                    actor: "Alex",
                    role: "Safety Lead",
                    timestamp: Date().addingTimeInterval(-120)
                )
                .padding(.horizontal, RMTheme.Spacing.pagePadding)
                
                // Recent Receipts
                RMRecentReceipts(receipts: recentReceipts)
            }
            .padding(.vertical, RMTheme.Spacing.lg)
        }
        .refreshable {
            await onRefresh?()
            await loadRecentReceipts()
            await loadEvidenceCount()
        }
        .task {
            await loadRecentReceipts()
            await loadEvidenceCount()
        }
    }
    
    private func loadEvidenceCount() async {
        do {
            let evidence = try await APIClient.shared.getEvidence(jobId: job.id)
            evidenceCount = evidence.count
        } catch {
            // Keep default
            evidenceCount = 0
        }
    }
    
    private func loadRecentReceipts() async {
        // Load from audit events for this job
        do {
            let events = try await APIClient.shared.getAuditEvents(timeRange: "7d", limit: 10)
            // Filter events for this job and map to ActionReceipt
            recentReceipts = events
                .filter { event in
                    event.metadata["job_id"] == job.id || event.metadata["jobId"] == job.id
                }
                .prefix(5)
                .map { event in
                    // Map event category to ActionType
                    let actionType: ActionType
                    if event.summary.lowercased().contains("evidence") || event.summary.lowercased().contains("upload") {
                        actionType = .evidenceUploaded
                    } else if event.summary.lowercased().contains("hazard") {
                        actionType = .hazardChanged
                    } else if event.summary.lowercased().contains("export") || event.summary.lowercased().contains("proof pack") {
                        actionType = .exportGenerated
                    } else if event.category == "GOVERNANCE" {
                        actionType = .roleChanged
                    } else {
                        actionType = .controlCompleted
                    }
                    
                    return ActionReceipt(
                        id: event.id,
                        type: actionType,
                        title: event.summary,
                        actor: event.actor,
                        role: nil,
                        timestamp: event.timestamp,
                        jobId: job.id,
                        jobTitle: job.clientName,
                        details: event.metadata
                    )
                }
        } catch {
            print("[OverviewTab] ❌ Failed to load recent receipts: \(error.localizedDescription)")
            recentReceipts = [] // Show empty - no demo data
        }
    }
}

/// Single card when Hazards & Controls are both empty: "Managed in Web App" + actions
struct ManagedOnWebCard: View {
    let onOpenWebApp: () -> Void
    let onViewWorkRecords: () -> Void
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                HStack {
                    Image(systemName: "globe")
                        .foregroundColor(RMTheme.Colors.accent)
                    Text("Managed in Web App")
                        .rmSectionHeader()
                }
                Text("Hazards and Controls are configured in the Web App. Evidence you add here attaches automatically.")
                    .font(RMTheme.Typography.bodySmall)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                HStack(spacing: RMTheme.Spacing.md) {
                    Button(action: onOpenWebApp) {
                        Label("Open in Web App", systemImage: "globe")
                            .font(RMTheme.Typography.bodySmallBold)
                            .foregroundColor(RMTheme.Colors.accent)
                    }
                    Button(action: onViewWorkRecords) {
                        Label("View Work Records", systemImage: "doc.text.fill")
                            .font(RMTheme.Typography.bodySmallBold)
                            .foregroundColor(RMTheme.Colors.accent)
                    }
                }
            }
        }
    }
}

/// Command-center "Next Step" card: one primary action + secondary links. Whole card is tappable when incomplete.
struct NextStepCard: View {
    var showPrimaryAction: Bool = true
    var evidenceCount: Int = 0
    var evidenceRequired: Int = 5
    let onAddEvidence: () -> Void
    let onViewWorkRecords: () -> Void
    let onViewLedger: () -> Void
    
    private var remaining: Int {
        max(0, evidenceRequired - evidenceCount)
    }
    
    private var isComplete: Bool {
        evidenceCount >= evidenceRequired
    }
    
    private var statusMessage: String {
        if !showPrimaryAction {
            return "View work records and ledger from the menu."
        }
        if isComplete {
            return "Evidence complete. Ready to export Proof Pack."
        }
        return "Add \(remaining) evidence item\(remaining == 1 ? "" : "s") to unlock Proof Pack export."
    }
    
    private var cardContent: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                HStack {
                    Image(systemName: isComplete ? "checkmark.circle.fill" : "arrow.triangle.turn.up.right.diamond.fill")
                        .foregroundColor(isComplete ? RMTheme.Colors.success : RMTheme.Colors.accent)
                    Text(isComplete ? "Ready" : "Next Step")
                        .rmSectionHeader()
                    Spacer()
                    // Evidence badge inline
                    if showPrimaryAction {
                        Text("\(evidenceCount)/\(evidenceRequired)")
                            .font(RMTheme.Typography.captionBold)
                            .foregroundColor(isComplete ? RMTheme.Colors.success : RMTheme.Colors.accent)
                            .padding(.horizontal, RMTheme.Spacing.sm)
                            .padding(.vertical, 4)
                            .background((isComplete ? RMTheme.Colors.success : RMTheme.Colors.accent).opacity(0.15))
                            .clipShape(Capsule())
                    }
                }
                Text(statusMessage)
                    .font(RMTheme.Typography.bodySmall)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                VStack(spacing: RMTheme.Spacing.sm) {
                    if showPrimaryAction && !isComplete {
                        Button(action: onAddEvidence) {
                            HStack(spacing: RMTheme.Spacing.xs) {
                                Image(systemName: "camera.fill")
                                    .font(RMTheme.Typography.caption)
                                Text("Add evidence")
                                    .font(RMTheme.Typography.bodySmall)
                            }
                            .foregroundColor(RMTheme.Colors.accent)
                        }
                        .buttonStyle(.plain)
                    }
                    HStack(spacing: RMTheme.Spacing.md) {
                        Button(action: onViewWorkRecords) {
                            Label("Work Records", systemImage: "list.bullet.rectangle")
                                .font(RMTheme.Typography.bodySmall)
                                .foregroundColor(RMTheme.Colors.accent)
                        }
                        Button(action: onViewLedger) {
                            Label("Ledger", systemImage: "book.closed")
                                .font(RMTheme.Typography.bodySmall)
                                .foregroundColor(RMTheme.Colors.accent)
                        }
                    }
                }
            }
        }
    }
    
    var body: some View {
        if showPrimaryAction && !isComplete {
            Button {
                Haptics.tap()
                onAddEvidence()
            } label: {
                cardContent
            }
            .buttonStyle(.plain)
        } else {
            cardContent
        }
    }
}

struct RiskScoreCard: View {
    let job: Job
    
    private var riskScore: Int {
        if let score = job.riskScore {
            return score
        }
        // Compute from risk level if score not available
        switch job.riskLevel {
        case "Critical": return 95
        case "High": return 80
        case "Medium": return 55
        case "Low": return 30
        default: return 50
        }
    }
    
    private var riskLevel: String {
        job.riskLevel ?? "Unknown"
    }
    
    private var riskColor: Color {
        switch riskScore {
        case 0..<30: return RMTheme.Colors.categoryOperations
        case 30..<70: return RMTheme.Colors.categoryAccess
        default: return RMTheme.Colors.categoryGovernance
        }
    }
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                HStack {
                    Text("Risk Score")
                        .rmSectionHeader()
                    Spacer()
                    Text("\(riskScore)")
                        .font(RMTheme.Typography.title)
                        .foregroundColor(riskColor)
                        .contentTransition(.numericText())
                        .animation(.spring(response: 0.4, dampingFraction: 0.8), value: riskScore)
                }
                
                Text(riskLevel)
                    .font(RMTheme.Typography.bodySmall)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                
                // Risk level indicator with animation
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(RMTheme.Colors.inputFill)
                            .frame(height: 8)
                        
                        RoundedRectangle(cornerRadius: 4)
                            .fill(riskColor)
                            .frame(width: geometry.size.width * CGFloat(riskScore) / 100, height: 8)
                            .animation(.spring(response: 0.5, dampingFraction: 0.8), value: riskScore)
                    }
                }
                .frame(height: 8)
            }
        }
    }
}

struct StatusInfoCard: View {
    let job: Job
    
    var body: some View {
        RMGlassCard {
            VStack(spacing: RMTheme.Spacing.md) {
                InfoRow(label: "Status", value: job.status)
                InfoRow(label: "Client", value: job.clientName)
                InfoRow(label: "Location", value: job.location)
                // Note: dueDate and owner not in Job model - would need API extension
            }
        }
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }
}

struct InfoRow: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text(label)
                .font(RMTheme.Typography.bodySmall)
                .foregroundColor(RMTheme.Colors.textSecondary)
            Spacer()
            Text(value)
                .font(RMTheme.Typography.bodySmallBold)
                .foregroundColor(RMTheme.Colors.textPrimary)
        }
    }
}

struct JobReadinessScoreCard: View {
    let score: Int
    
    var readinessColor: Color {
        if score >= 80 { return RMTheme.Colors.success }
        if score >= 60 { return RMTheme.Colors.warning }
        return RMTheme.Colors.error
    }
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                HStack {
                    Text("Readiness Score")
                        .rmSectionHeader()
                    Spacer()
                    Text("\(score)%")
                        .font(RMTheme.Typography.title)
                        .foregroundColor(readinessColor)
                }
                
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(RMTheme.Colors.inputFill)
                            .frame(height: 8)
                        
                        RoundedRectangle(cornerRadius: 4)
                            .fill(readinessColor)
                            .frame(width: geometry.size.width * CGFloat(score) / 100, height: 8)
                    }
                }
                .frame(height: 8)
            }
        }
    }
}

struct BlockersCard: View {
    let blockers: [String]
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(RMTheme.Colors.warning)
                    Text("Blockers")
                        .rmSectionHeader()
                }
                
                VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                    ForEach(blockers, id: \.self) { blocker in
                        HStack(alignment: .top, spacing: RMTheme.Spacing.sm) {
                            Circle()
                                .fill(RMTheme.Colors.warning)
                                .frame(width: 6, height: 6)
                                .padding(.top, 6)
                            
                            Text(blocker)
                                .font(RMTheme.Typography.bodySmall)
                                .foregroundColor(RMTheme.Colors.textPrimary)
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Hazards Tab

struct HazardsTab: View {
    let jobId: String
    /// When set (e.g. from deep link), scroll to and focus this hazard once hazards are loaded.
    var initialHazardId: String? = nil
    var onRefresh: (() async -> Void)? = nil
    @State private var hazards: [Hazard] = []
    @State private var isLoading = true
    @State private var didLoad = false
    @State private var showAddHazardSheet = false
    @State private var didScrollToInitialHazard = false
    @EnvironmentObject private var quickAction: QuickActionRouter
    
    private var pendingHazardIds: Set<String> {
        Set(OfflineDatabase.shared.getPendingHazards(jobId: jobId).compactMap { data -> String? in
            (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["id"] as? String
        })
    }
    
    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(showsIndicators: false) {
                VStack(spacing: RMTheme.Spacing.sectionSpacing) {
                    if !EntitlementsManager.shared.isAuditor() {
                        HStack {
                            Text("Hazards")
                                .rmSectionHeader()
                            Spacer()
                            Button {
                                Haptics.tap()
                                showAddHazardSheet = true
                            } label: {
                                Label("Add Hazard", systemImage: "plus.circle.fill")
                                    .font(RMTheme.Typography.bodySmallBold)
                                    .foregroundColor(RMTheme.Colors.accent)
                            }
                        }
                        .padding(.horizontal, RMTheme.Spacing.pagePadding)
                    }
                    
                    if hazards.isEmpty {
                        VStack(spacing: RMTheme.Spacing.md) {
                            RMEmptyState(
                                icon: "exclamationmark.triangle",
                                title: "No Hazards",
                                message: "Add a hazard or configure on the web."
                            )
                            HStack(spacing: RMTheme.Spacing.lg) {
                                if !EntitlementsManager.shared.isAuditor() {
                                    Button {
                                        Haptics.tap()
                                        showAddHazardSheet = true
                                    } label: {
                                        Label("Add Hazard", systemImage: "plus.circle.fill")
                                            .font(RMTheme.Typography.bodySmallBold)
                                            .foregroundColor(RMTheme.Colors.accent)
                                    }
                                }
                                Button {
                                    Haptics.tap()
                                    quickAction.requestSwitchToWorkRecords(filter: nil)
                                } label: {
                                    Label("View Work Records", systemImage: "doc.text.fill")
                                        .font(RMTheme.Typography.bodySmallBold)
                                        .foregroundColor(RMTheme.Colors.accent)
                                }
                                Button {
                                    Haptics.tap()
                                    WebAppURL.openWebApp(jobId: jobId)
                                } label: {
                                    Label("Open in Web App", systemImage: "globe")
                                        .font(RMTheme.Typography.bodySmallBold)
                                        .foregroundColor(RMTheme.Colors.accent)
                                }
                            }
                        }
                        .padding(.top, RMTheme.Spacing.xxl)
                    } else {
                        ForEach(hazards) { hazard in
                            HazardCard(hazard: hazard, isOfflinePending: pendingHazardIds.contains(hazard.id))
                                .padding(.horizontal, RMTheme.Spacing.pagePadding)
                                .id(hazard.id)
                        }
                    }
                }
                .padding(.vertical, RMTheme.Spacing.lg)
            }
            .onChange(of: hazards.count) { _, _ in
                if didScrollToInitialHazard { return }
                guard let id = initialHazardId, hazards.contains(where: { $0.id == id }) else { return }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                    withAnimation(.easeInOut(duration: 0.25)) {
                        proxy.scrollTo(id, anchor: .center)
                    }
                }
                didScrollToInitialHazard = true
            }
        }
        .sheet(isPresented: $showAddHazardSheet) {
            AddHazardSheet(jobId: jobId) { newHazard in
                hazards.insert(newHazard, at: 0)
                OfflineCache.shared.refreshSyncState()
                showAddHazardSheet = false
                await onRefresh?()
            }
        }
        .onChange(of: showAddHazardSheet) { _, isShowing in
            if !isShowing {
                Task { await loadHazards() }
            }
        }
        .task(id: jobId) {
            guard !didLoad else { return }
            didLoad = true
            await loadHazards()
        }
        .onReceive(NotificationCenter.default.publisher(for: SyncEngine.hazardsControlsSyncDidSucceedNotification)) { notification in
            guard let notifJobId = notification.userInfo?["jobId"] as? String,
                  notifJobId == jobId else { return }
            Task { await loadHazards() }
        }
    }
    
    private func loadHazards() async {
        isLoading = true
        defer { isLoading = false }
        
        do {
            var apiHazards = try await APIClient.shared.getHazards(jobId: jobId)
            let pendingData = OfflineDatabase.shared.getPendingHazards(jobId: jobId)
            let pendingHazards: [Hazard] = pendingData.compactMap { data in
                guard let hazard = try? JSONDecoder().decode(Hazard.self, from: data) else { return nil }
                return hazard
            }
            hazards = apiHazards + pendingHazards
        } catch {
            let (cachedHazards, _) = OfflineCache.shared.getCachedMitigationItems(jobId: jobId)
            let pendingData = OfflineDatabase.shared.getPendingHazards(jobId: jobId)
            let pendingHazards: [Hazard] = pendingData.compactMap { data in
                guard let hazard = try? JSONDecoder().decode(Hazard.self, from: data) else { return nil }
                return hazard
            }
            let pendingIds = Set(pendingHazards.map(\.id))
            let fromCache = cachedHazards.filter { !pendingIds.contains($0.id) }
            hazards = fromCache + pendingHazards
        }
    }
}

// MARK: - Add Hazard Sheet

struct AddHazardSheet: View {
    let jobId: String
    let onCreated: (Hazard) async -> Void
    @State private var title = ""
    @State private var description = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?
    @StateObject private var statusManager = ServerStatusManager.shared
    @Environment(\.dismiss) private var dismiss

    private var isOffline: Bool { !statusManager.isOnline }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if isOffline {
                    HStack(spacing: RMTheme.Spacing.sm) {
                        Image(systemName: "wifi.slash")
                            .foregroundColor(RMTheme.Colors.warning)
                        Text("You're offline. This hazard will sync when you're back online.")
                            .font(RMTheme.Typography.bodySmall)
                            .foregroundColor(RMTheme.Colors.textSecondary)
                    }
                    .padding(RMTheme.Spacing.md)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RMTheme.Colors.warning.opacity(0.15))
                    .padding(.horizontal, RMTheme.Spacing.pagePadding)
                    .padding(.top, RMTheme.Spacing.sm)
                }
                Form {
                Section {
                    TextField("Title", text: $title)
                    TextField("Description", text: $description, axis: .vertical)
                        .lineLimit(3...6)
                }
                if let err = errorMessage {
                    Section {
                        Text(err)
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.error)
                    }
                }
                }
                .scrollContentBackground(.hidden)
            }
            .background(RMTheme.Colors.background)
            .navigationTitle("Add Hazard")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isOffline ? "Add Offline" : "Add") {
                        Task { await submit() }
                    }
                    .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || isSubmitting)
                }
            }
        }
    }
    
    private func submit() async {
        let t = title.trimmingCharacters(in: .whitespaces)
        guard !t.isEmpty else { return }
        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }
        
        let now = ISO8601DateFormatter().string(from: Date())
        let hazard = Hazard(
            id: UUID().uuidString,
            code: String(t.prefix(8)).uppercased().replacingOccurrences(of: " ", with: "_"),
            name: t,
            description: description.trimmingCharacters(in: .whitespaces),
            severity: "Medium",
            status: "open",
            createdAt: now,
            updatedAt: now
        )
        
        if ServerStatusManager.shared.isOnline {
            do {
                let created = try await APIClient.shared.createHazard(jobId: jobId, title: t, description: description)
                await onCreated(created)
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
        } else {
            SyncEngine.shared.queueCreateHazard(hazard, jobId: jobId)
            OfflineCache.shared.refreshSyncState()
            ToastCenter.shared.show("Saved offline", systemImage: "wifi.slash", style: .info)
            await onCreated(hazard)
            dismiss()
        }
    }
}

struct Hazard: Identifiable, Codable {
    let id: String
    let code: String
    let name: String
    let description: String
    let severity: String
    let status: String
    let createdAt: String
    let updatedAt: String
    
    enum CodingKeys: String, CodingKey {
        case id
        case code
        case name
        case description
        case severity
        case status
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct HazardCard: View {
    let hazard: Hazard
    var isOfflinePending: Bool = false
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                HStack {
                    Text(hazard.code)
                        .font(RMTheme.Typography.captionBold)
                        .foregroundColor(.white)
                        .padding(.horizontal, RMTheme.Spacing.sm)
                        .padding(.vertical, RMTheme.Spacing.xs)
                        .background(severityColor)
                        .clipShape(Capsule())
                    
                    Spacer()
                    
                    if isOfflinePending {
                        HStack(spacing: 4) {
                            Image(systemName: "clock.fill")
                                .font(.system(size: 10))
                            Text("Pending sync")
                                .font(RMTheme.Typography.captionSmall)
                        }
                        .foregroundColor(RMTheme.Colors.warning)
                    }
                    
                    Text(hazard.severity)
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(severityColor)
                }
                
                Text(hazard.description)
                    .font(RMTheme.Typography.bodySmall)
                    .foregroundColor(RMTheme.Colors.textPrimary)
            }
        }
    }
    
    private var severityColor: Color {
        switch hazard.severity {
        case "Critical": return RMTheme.Colors.error
        case "High": return RMTheme.Colors.warning
        case "Medium": return RMTheme.Colors.info
        case "Low": return RMTheme.Colors.success
        default: return RMTheme.Colors.textTertiary
        }
    }
}

// MARK: - Add Control Sheet

struct AddControlSheet: View {
    let jobId: String
    let hazards: [Hazard]
    let onCreated: (Control) async -> Void
    @State private var title = ""
    @State private var description = ""
    @State private var selectedHazardId: String?
    @State private var isSubmitting = false
    @State private var errorMessage: String?
    @StateObject private var statusManager = ServerStatusManager.shared
    @Environment(\.dismiss) private var dismiss

    private var isOffline: Bool { !statusManager.isOnline }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if isOffline {
                    HStack(spacing: RMTheme.Spacing.sm) {
                        Image(systemName: "wifi.slash")
                            .foregroundColor(RMTheme.Colors.warning)
                        Text("You're offline. This control will sync when you're back online.")
                            .font(RMTheme.Typography.bodySmall)
                            .foregroundColor(RMTheme.Colors.textSecondary)
                    }
                    .padding(RMTheme.Spacing.md)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RMTheme.Colors.warning.opacity(0.15))
                    .padding(.horizontal, RMTheme.Spacing.pagePadding)
                    .padding(.top, RMTheme.Spacing.sm)
                }
                Form {
                Section("Hazard") {
                    Picker("Link to hazard", selection: $selectedHazardId) {
                        Text("Select a hazard").tag(nil as String?)
                        ForEach(hazards) { h in
                            Text(h.name).tag(h.id as String?)
                        }
                    }
                }
                Section {
                    TextField("Title", text: $title)
                    TextField("Description", text: $description, axis: .vertical)
                        .lineLimit(3...6)
                }
                if let err = errorMessage {
                    Section {
                        Text(err)
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.error)
                    }
                }
                }
                .scrollContentBackground(.hidden)
            }
            .background(RMTheme.Colors.background)
            .navigationTitle("Add Control")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isOffline ? "Add Offline" : "Add") {
                        Task { await submit() }
                    }
                    .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || selectedHazardId == nil || isSubmitting)
                }
            }
            .onAppear {
                if selectedHazardId == nil, let first = hazards.first {
                    selectedHazardId = first.id
                }
            }
        }
    }
    
    private func submit() async {
        let t = title.trimmingCharacters(in: .whitespaces)
        guard !t.isEmpty, let hazardId = selectedHazardId else { return }
        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }
        
        let now = ISO8601DateFormatter().string(from: Date())
        let control = Control(
            id: UUID().uuidString,
            title: t,
            description: description.trimmingCharacters(in: .whitespaces),
            status: "Pending",
            done: false,
            isCompleted: false,
            hazardId: hazardId,
            createdAt: now,
            updatedAt: now
        )
        
        if ServerStatusManager.shared.isOnline {
            do {
                let created = try await APIClient.shared.createControl(jobId: jobId, hazardId: hazardId, title: t, description: description)
                await onCreated(created)
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
        } else {
            SyncEngine.shared.queueCreateControl(control, hazardId: hazardId, jobId: jobId)
            OfflineCache.shared.refreshSyncState()
            ToastCenter.shared.show("Saved offline", systemImage: "wifi.slash", style: .info)
            await onCreated(control)
            dismiss()
        }
    }
}

// MARK: - Controls Tab

struct ControlsTab: View {
    let jobId: String
    var onRefresh: (() async -> Void)? = nil
    @State private var controls: [Control] = []
    @State private var hazards: [Hazard] = []
    @State private var isLoading = true
    @State private var didLoad = false
    @State private var showAddControlSheet = false
    @EnvironmentObject private var quickAction: QuickActionRouter
    
    private var pendingControlIds: Set<String> {
        Set(OfflineDatabase.shared.getPendingControls(jobId: jobId).compactMap { data -> String? in
            (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["id"] as? String
        })
    }
    
    private var canAddControl: Bool {
        !hazards.isEmpty && !EntitlementsManager.shared.isAuditor()
    }
    
    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: RMTheme.Spacing.sectionSpacing) {
                if canAddControl {
                    HStack {
                        Text("Controls")
                            .rmSectionHeader()
                        Spacer()
                        Button {
                            Haptics.tap()
                            showAddControlSheet = true
                        } label: {
                            Label("Add Control", systemImage: "plus.circle.fill")
                                .font(RMTheme.Typography.bodySmallBold)
                                .foregroundColor(RMTheme.Colors.accent)
                        }
                    }
                    .padding(.horizontal, RMTheme.Spacing.pagePadding)
                }
                
                if controls.isEmpty {
                    VStack(spacing: RMTheme.Spacing.md) {
                        RMEmptyState(
                            icon: "checkmark.shield",
                            title: "No Controls",
                            message: hazards.isEmpty
                                ? "Add a hazard first, then add controls. Or configure on the web."
                                : "Add a control or configure on the web."
                        )
                        HStack(spacing: RMTheme.Spacing.lg) {
                            if canAddControl {
                                Button {
                                    Haptics.tap()
                                    showAddControlSheet = true
                                } label: {
                                    Label("Add Control", systemImage: "plus.circle.fill")
                                        .font(RMTheme.Typography.bodySmallBold)
                                        .foregroundColor(RMTheme.Colors.accent)
                                }
                            }
                            Button {
                                Haptics.tap()
                                quickAction.requestSwitchToWorkRecords(filter: nil)
                            } label: {
                                Label("View Work Records", systemImage: "doc.text.fill")
                                    .font(RMTheme.Typography.bodySmallBold)
                                    .foregroundColor(RMTheme.Colors.accent)
                            }
                            Button {
                                Haptics.tap()
                                WebAppURL.openWebApp(jobId: jobId)
                            } label: {
                                Label("Open in Web App", systemImage: "globe")
                                    .font(RMTheme.Typography.bodySmallBold)
                                    .foregroundColor(RMTheme.Colors.accent)
                            }
                        }
                    }
                    .padding(.top, RMTheme.Spacing.xxl)
                } else {
                    ForEach(controls) { control in
                        ControlCard(
                            control: control,
                            jobId: jobId,
                            hazardId: control.hazardId,
                            isOfflinePending: pendingControlIds.contains(control.id),
                            onControlUpdated: { updated in
                                if let idx = controls.firstIndex(where: { $0.id == updated.id }) {
                                    controls[idx] = updated
                                }
                            }
                        )
                        .padding(.horizontal, RMTheme.Spacing.pagePadding)
                    }
                }
            }
            .padding(.vertical, RMTheme.Spacing.lg)
        }
        .sheet(isPresented: $showAddControlSheet) {
            AddControlSheet(jobId: jobId, hazards: hazards) { newControl in
                controls.insert(newControl, at: 0)
                OfflineCache.shared.refreshSyncState()
                showAddControlSheet = false
                await onRefresh?()
            }
        }
        .onChange(of: showAddControlSheet) { _, isShowing in
            if !isShowing {
                Task {
                    await loadControls()
                    await loadHazards()
                }
            }
        }
        .task(id: jobId) {
            guard !didLoad else { return }
            didLoad = true
            await loadHazards()
            await loadControls()
        }
        .onReceive(NotificationCenter.default.publisher(for: SyncEngine.hazardsControlsSyncDidSucceedNotification)) { notification in
            guard let notifJobId = notification.userInfo?["jobId"] as? String,
                  notifJobId == jobId else { return }
            Task {
                await loadHazards()
                await loadControls()
            }
        }
    }
    
    private func loadHazards() async {
        do {
            hazards = try await APIClient.shared.getHazards(jobId: jobId)
            let pending = OfflineDatabase.shared.getPendingHazards(jobId: jobId)
            let pendingHazards: [Hazard] = pending.compactMap { (try? JSONDecoder().decode(Hazard.self, from: $0)) }
            hazards.append(contentsOf: pendingHazards)
        } catch {
            let (cachedHazards, _) = OfflineCache.shared.getCachedMitigationItems(jobId: jobId)
            let pending = OfflineDatabase.shared.getPendingHazards(jobId: jobId)
            let pendingHazards: [Hazard] = pending.compactMap { (try? JSONDecoder().decode(Hazard.self, from: $0)) }
            let pendingIds = Set(pendingHazards.map(\.id))
            hazards = cachedHazards.filter { !pendingIds.contains($0.id) } + pendingHazards
        }
    }

    private func loadControls() async {
        isLoading = true
        defer { isLoading = false }
        
        do {
            var apiControls = try await APIClient.shared.getControls(jobId: jobId)
            let pendingData = OfflineDatabase.shared.getPendingControls(jobId: jobId)
            let pendingControls: [Control] = pendingData.compactMap { data in
                guard let control = try? JSONDecoder().decode(Control.self, from: data) else { return nil }
                return control
            }
            controls = apiControls + pendingControls
        } catch {
            let (_, cachedControls) = OfflineCache.shared.getCachedMitigationItems(jobId: jobId)
            let pendingData = OfflineDatabase.shared.getPendingControls(jobId: jobId)
            let pendingControls: [Control] = pendingData.compactMap { data in
                guard let control = try? JSONDecoder().decode(Control.self, from: data) else { return nil }
                return control
            }
            let pendingIds = Set(pendingControls.map(\.id))
            let fromCache = cachedControls.filter { !pendingIds.contains($0.id) }
            controls = fromCache + pendingControls
        }
    }
}

struct Control: Identifiable, Codable {
    let id: String
    let title: String?
    let description: String
    let status: String
    let done: Bool?
    let isCompleted: Bool?
    let hazardId: String?
    let createdAt: String?
    let updatedAt: String?
    
    init(id: String, title: String?, description: String, status: String, done: Bool?, isCompleted: Bool?, hazardId: String? = nil, createdAt: String?, updatedAt: String?) {
        self.id = id
        self.title = title
        self.description = description
        self.status = status
        self.done = done
        self.isCompleted = isCompleted
        self.hazardId = hazardId
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
    
    enum CodingKeys: String, CodingKey {
        case id
        case title
        case description
        case status
        case done
        case isCompleted
        case hazardId
        case hazard_id
        case createdAt
        case updatedAt
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        description = try container.decodeIfPresent(String.self, forKey: .description) ?? ""
        status = try container.decodeIfPresent(String.self, forKey: .status) ?? "Pending"
        done = try container.decodeIfPresent(Bool.self, forKey: .done)
        isCompleted = try container.decodeIfPresent(Bool.self, forKey: .isCompleted)
        hazardId = try container.decodeIfPresent(String.self, forKey: .hazardId)
            ?? container.decodeIfPresent(String.self, forKey: .hazard_id)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encodeIfPresent(title, forKey: .title)
        try container.encode(description, forKey: .description)
        try container.encode(status, forKey: .status)
        try container.encodeIfPresent(done, forKey: .done)
        try container.encodeIfPresent(isCompleted, forKey: .isCompleted)
        try container.encodeIfPresent(hazardId, forKey: .hazardId)
        try container.encodeIfPresent(createdAt, forKey: .createdAt)
        try container.encodeIfPresent(updatedAt, forKey: .updatedAt)
    }
}

struct ControlCard: View {
    let control: Control
    let jobId: String
    var hazardId: String? = nil
    var isOfflinePending: Bool = false
    var onControlUpdated: ((Control) -> Void)? = nil
    @StateObject private var cache = OfflineCache.shared
    @State private var showTrustReceipt = false
    @State private var trustAction: TrustAction?
    
    var body: some View {
        RMGlassCard {
            HStack(spacing: RMTheme.Spacing.md) {
                Button {
                    Task {
                        await toggleControl()
                    }
                } label: {
                    Image(systemName: statusIcon)
                        .foregroundColor(statusColor)
                        .font(.system(size: 20))
                }
                .accessibilityLabel(control.status == "Completed" ? "Control completed" : "Control not completed")
                .accessibilityAddTraits(.isButton)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(control.title ?? control.description)
                        .font(RMTheme.Typography.bodySmall)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    
                    if !control.description.isEmpty && control.title != nil {
                        Text(control.description)
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.textSecondary)
                    }
                    
                    if isPendingSync || isOfflinePending {
                        HStack(spacing: 4) {
                            Image(systemName: "clock.fill")
                                .font(.system(size: 10))
                            Text("Pending sync")
                                .font(RMTheme.Typography.captionSmall)
                        }
                        .foregroundColor(RMTheme.Colors.warning)
                    } else if control.status == "Blocked" {
                        HStack(spacing: 4) {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 10))
                            Text("Blocked")
                                .font(RMTheme.Typography.captionSmall)
                        }
                        .foregroundColor(RMTheme.Colors.error)
                    }
                }
                
                Spacer()
                
                Text(control.status)
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(statusColor)
            }
        }
        .trustReceipt(trustAction, isPresented: $showTrustReceipt)
    }
    
    private var statusIcon: String {
        switch control.status {
        case "Completed": return "checkmark.circle.fill"
        case "Blocked": return "xmark.circle.fill"
        default: return "circle"
        }
    }
    
    private var statusColor: Color {
        switch control.status {
        case "Completed": return RMTheme.Colors.success
        case "Pending": return RMTheme.Colors.warning
        case "Blocked": return RMTheme.Colors.error
        default: return RMTheme.Colors.textTertiary
        }
    }
    
    private var isPendingSync: Bool {
        cache.queuedItems.contains { item in
            item.type == .control && (item.itemId == control.id || item.id == control.id)
        } || OfflineDatabase.shared.getSyncQueue().contains { op in
            (op.type == .updateControl || op.type == .createControl) && op.entityId == control.id
        }
    }
    
    private func toggleControl() async {
        let isOffline = !ServerStatusManager.shared.isOnline
        let wasCompleted = control.status == "Completed"
        let newStatus = wasCompleted ? "Pending" : "Completed"
        let now = ISO8601DateFormatter().string(from: Date())
        
        let updatedControl = Control(
            id: control.id,
            title: control.title,
            description: control.description,
            status: newStatus,
            done: !wasCompleted,
            isCompleted: !wasCompleted,
            hazardId: control.hazardId ?? hazardId,
            createdAt: control.createdAt,
            updatedAt: now
        )
        
        // Propagate to view state immediately so UI reflects change instantly (Comment 3)
        onControlUpdated?(updatedControl)
        
        // Create trust action
        trustAction = TrustAction(
            id: UUID().uuidString,
            type: .controlCompleted,
            title: "Control \(newStatus.lowercased())",
            actor: "Current User",
            role: nil,
            timestamp: Date(),
            jobId: jobId,
            jobTitle: nil,
            details: ["Control": control.description, "Status": newStatus],
            outcome: isOffline ? .pending : .allowed,
            reason: nil
        )
        
        showTrustReceipt = true
        
        Analytics.shared.trackControlCompleted(controlId: control.id, wasOffline: isOffline)
        
        if isOffline {
            SyncEngine.shared.queueUpdateControl(updatedControl, jobId: jobId, hazardId: hazardId)
            OfflineCache.shared.refreshSyncState()
        } else {
            do {
                try await APIClient.shared.updateMitigation(jobId: jobId, mitigationId: control.id, done: !wasCompleted)
            } catch {
                SyncEngine.shared.queueUpdateControl(updatedControl, jobId: jobId, hazardId: hazardId)
                OfflineCache.shared.refreshSyncState()
            }
        }
    }
}

// MARK: - Evidence Tab

struct EvidenceTab: View {
    let jobId: String
    @StateObject private var uploadManager = BackgroundUploadManager.shared
    @State private var evidence: [EvidenceItem] = []
    @State private var isLoading = true
    @State private var showImagePicker = false
    
    var body: some View {
        let activeUploads = uploadManager.uploads.filter { $0.jobId == jobId }
        ScrollView(showsIndicators: false) {
            VStack(spacing: RMTheme.Spacing.sectionSpacing) {
                // Evidence section header + Add Evidence (same label/icon in empty and non-empty)
                HStack {
                    Text("Evidence")
                        .rmSectionHeader()
                    Spacer()
                    Button {
                        Haptics.tap()
                        showImagePicker = true
                    } label: {
                        Label("Add Evidence", systemImage: "camera.fill")
                            .font(RMTheme.Typography.bodySmallBold)
                            .foregroundColor(RMTheme.Colors.accent)
                    }
                }
                .padding(.horizontal, RMTheme.Spacing.pagePadding)
                
                // Active uploads (Uploading… with progress, Failed — Tap to retry, Uploaded)
                if !activeUploads.isEmpty {
                    VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                        Text("Uploads")
                            .rmSectionHeader()
                            .padding(.horizontal, RMTheme.Spacing.pagePadding)
                        
                        ForEach(activeUploads) { upload in
                            UploadStatusCard(upload: upload)
                                .padding(.horizontal, RMTheme.Spacing.pagePadding)
                        }
                    }
                }
                
                // Synced evidence or empty state
                if evidence.isEmpty && activeUploads.isEmpty {
                    RMEmptyState(
                        icon: "photo",
                        title: "No Evidence",
                        message: "Upload photos and documents to complete readiness"
                    )
                    .padding(.top, RMTheme.Spacing.lg)
                    Button {
                        Haptics.tap()
                        showImagePicker = true
                    } label: {
                        Label("Add Evidence", systemImage: "camera.fill")
                            .font(RMTheme.Typography.bodySmallBold)
                            .foregroundColor(RMTheme.Colors.accent)
                    }
                    .padding(.top, RMTheme.Spacing.sm)
                } else {
                    ForEach(evidence) { item in
                        EvidenceCard(
                            jobId: jobId,
                            item: item,
                            onCategoryChanged: { await loadEvidence() }
                        )
                        .padding(.horizontal, RMTheme.Spacing.pagePadding)
                    }
                }
            }
            .padding(.vertical, RMTheme.Spacing.lg)
        }
        .sheet(isPresented: $showImagePicker) {
            EvidenceCaptureSheet(jobId: jobId) {
                // Refresh evidence list when sheet completes (e.g. after upload)
                Task { await loadEvidence() }
            }
        }
        .onChange(of: showImagePicker) { _, isShowing in
            if !isShowing {
                Task { await loadEvidence() }
            }
        }
        .task {
            await loadEvidence()
        }
    }
    
    private func loadEvidence() async {
        isLoading = true
        defer { isLoading = false }
        
        do {
            evidence = try await APIClient.shared.getEvidence(jobId: jobId)
            
            // Cache for offline (real data only)
            OfflineCache.shared.cacheEvidence(jobId: jobId, evidence: evidence)
        } catch {
            // Try offline cache (real previously-fetched data only)
            if let cached = OfflineCache.shared.getCachedEvidence(jobId: jobId) {
                print("[EvidenceTab] Using cached evidence (offline mode)")
                evidence = cached
            } else {
                // No cache available - show empty (no demo data)
                print("[EvidenceTab] ❌ Failed to load evidence and no cache: \(error.localizedDescription)")
                evidence = []
            }
        }
    }
}

struct UploadStatusCard: View {
    let upload: UploadTask
    @StateObject private var uploadManager = BackgroundUploadManager.shared
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                HStack {
                    Image(systemName: iconName)
                        .foregroundColor(iconColor)
                        .font(.system(size: 16))
                    
                    Text(upload.fileName)
                        .font(RMTheme.Typography.bodySmallBold)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    
                    if let cat = upload.category {
                        CategoryBadge(category: cat)
                    }
                    
                    Spacer()
                    
                    if case .failed = upload.state {
                        Button {
                            Haptics.tap()
                            Task {
                                do {
                                    try await uploadManager.retryUpload(upload)
                                } catch {
                                    ToastCenter.shared.show(
                                        error.localizedDescription,
                                        systemImage: "exclamationmark.triangle",
                                        style: .error
                                    )
                                }
                            }
                        } label: {
                            Text("Retry")
                                .font(RMTheme.Typography.captionBold)
                                .foregroundColor(RMTheme.Colors.accent)
                        }
                    }
                }
                
                if case .uploading = upload.state {
                    GeometryReader { geometry in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 4)
                                .fill(RMTheme.Colors.inputFill)
                                .frame(height: 4)
                            
                            RoundedRectangle(cornerRadius: 4)
                                .fill(RMTheme.Colors.accent)
                                .frame(width: geometry.size.width * upload.progress, height: 4)
                        }
                    }
                    .frame(height: 4)
                }
                
                Text(statusText)
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(statusColor)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture {
            if case .failed = upload.state {
                Haptics.tap()
                Task {
                    do {
                        try await uploadManager.retryUpload(upload)
                    } catch {
                        ToastCenter.shared.show(
                            error.localizedDescription,
                            systemImage: "exclamationmark.triangle",
                            style: .error
                        )
                    }
                }
            }
        }
    }
    
    private var iconName: String {
        switch upload.state {
        case .queued: return "clock.fill"
        case .uploading: return "arrow.up.circle.fill"
        case .synced: return "checkmark.circle.fill"
        case .failed: return "exclamationmark.triangle.fill"
        }
    }
    
    private var iconColor: Color {
        switch upload.state {
        case .queued: return RMTheme.Colors.textTertiary
        case .uploading: return RMTheme.Colors.accent
        case .synced: return RMTheme.Colors.success
        case .failed: return RMTheme.Colors.error
        }
    }
    
    private var statusColor: Color {
        switch upload.state {
        case .queued, .uploading: return RMTheme.Colors.textSecondary
        case .synced: return RMTheme.Colors.success
        case .failed: return RMTheme.Colors.error
        }
    }
    
    private var statusText: String {
        switch upload.state {
        case .queued:
            return "Queued"
        case .uploading:
            return "Uploading… \(Int(upload.progress * 100))%"
        case .synced:
            return "Uploaded"
        case .failed:
            return "Failed — Tap to retry"
        }
    }
}

struct EvidenceItem: Identifiable, Codable {
    let id: String
    let type: String
    let fileName: String
    let uploadedAt: Date
    /// Photo category from API: "before", "during", or "after" (evidence.category; legacy phase supported on decode)
    let category: String?
    
    enum CodingKeys: String, CodingKey {
        case id
        case type
        case fileName = "file_name"
        case uploadedAt = "uploaded_at"
        case createdAt = "created_at"
        case category
        case phase
    }
    
    init(id: String, type: String, fileName: String, uploadedAt: Date, category: String? = nil) {
        self.id = id
        self.type = type
        self.fileName = fileName
        self.uploadedAt = uploadedAt
        self.category = category
    }
    
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        type = try c.decode(String.self, forKey: .type)
        fileName = try c.decode(String.self, forKey: .fileName)
        uploadedAt = try c.decodeIfPresent(Date.self, forKey: .uploadedAt)
            ?? c.decode(Date.self, forKey: .createdAt)
        category = try c.decodeIfPresent(String.self, forKey: .category)
            ?? c.decodeIfPresent(String.self, forKey: .phase)
    }
    
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(type, forKey: .type)
        try c.encode(fileName, forKey: .fileName)
        try c.encode(uploadedAt, forKey: .uploadedAt)
        try c.encodeIfPresent(category, forKey: .category)
    }
}

struct EvidenceCard: View {
    let jobId: String
    let item: EvidenceItem
    var onCategoryChanged: (() async -> Void)?
    @State private var showCategoryPicker = false
    @State private var isUpdating = false

    var body: some View {
        RMGlassCard {
            HStack(spacing: RMTheme.Spacing.md) {
                Image(systemName: item.type == "photo" ? "photo.fill" : "doc.fill")
                    .foregroundColor(RMTheme.Colors.accent)
                    .font(.system(size: 24))

                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: RMTheme.Spacing.sm) {
                        Text(item.fileName)
                            .font(RMTheme.Typography.bodySmallBold)
                            .foregroundColor(RMTheme.Colors.textPrimary)
                        if item.type == "photo" {
                            categoryBadgeView
                        }
                    }
                    Text(formatDate(item.uploadedAt))
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                }

                Spacer()
                if item.type == "photo", onCategoryChanged != nil {
                    Button {
                        Haptics.tap()
                        showCategoryPicker = true
                    } label: {
                        Image(systemName: "pencil.circle.fill")
                            .font(.system(size: 22))
                            .foregroundColor(RMTheme.Colors.accent.opacity(0.9))
                    }
                    .disabled(isUpdating)
                }
            }
        }
        .confirmationDialog("Change photo category", isPresented: $showCategoryPicker, titleVisibility: .visible) {
            ForEach([EvidencePhase.before, .during, .after], id: \.self) { phase in
                Button(phase.displayName) {
                    Task { await updateCategory(phase.rawValue) }
                }
            }
            Button("Cancel", role: .cancel) {
                showCategoryPicker = false
            }
        } message: {
            Text("When was this photo taken relative to the job?")
        }
    }

    @ViewBuilder
    private var categoryBadgeView: some View {
        let category = item.category ?? "during"
        if onCategoryChanged != nil {
            Button {
                Haptics.tap()
                showCategoryPicker = true
            } label: {
                CategoryBadge(category: category)
            }
            .buttonStyle(.plain)
            .disabled(isUpdating)
        } else {
            CategoryBadge(category: category)
        }
    }

    private func updateCategory(_ category: String) async {
        showCategoryPicker = false
        isUpdating = true
        defer { isUpdating = false }
        do {
            try await APIClient.shared.updateDocumentCategory(jobId: jobId, docId: item.id, category: category)
            ToastCenter.shared.show("Category updated", systemImage: "checkmark.circle.fill", style: .success)
            await onCategoryChanged?()
        } catch {
            ToastCenter.shared.show(
                error.localizedDescription,
                systemImage: "exclamationmark.triangle",
                style: .error
            )
        }
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

/// Category badge for Before/During/After (ticket: iOS Native Photo Category Selection)
struct CategoryBadge: View {
    let category: String
    
    private var displayName: String {
        switch category.lowercased() {
        case "before": return "Before"
        case "after": return "After"
        default: return "During"
        }
    }
    
    private var badgeColor: Color {
        switch category.lowercased() {
        case "before": return .blue
        case "after": return .green
        default: return .orange
        }
    }
    
    var body: some View {
        Text(displayName.uppercased())
            .font(.caption2)
            .fontWeight(.bold)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(badgeColor.opacity(0.2))
            .foregroundColor(badgeColor)
            .cornerRadius(4)
    }
}

// MARK: - Exports Tab

struct ExportsTab: View {
    let jobId: String
    @EnvironmentObject private var quickAction: QuickActionRouter
    @StateObject private var exportManager = BackgroundExportManager.shared
    @State private var showShareSheet = false
    @State private var shareURL: URL?
    @State private var showError = false
    @State private var errorMessage = ""
    @State private var showTrustToast = false
    @State private var completedExport: ExportTask?
    @State private var showExportReceipt = false
    @State private var failedExport: ExportTask?
    @State private var showFailedExportSheet = false
    
    var activeExports: [ExportTask] {
        exportManager.exports.filter { $0.jobId == jobId && ($0.state == .queued || $0.state == .preparing || $0.state == .downloading) }
    }
    
    /// Recent exports (all states) for history + trust; tap → share when ready
    var recentExports: [ExportTask] {
        let allExports = exportManager.getAllExportsForJob(jobId: jobId)
        return Array(allExports.prefix(10))
    }
    
    private var scrollContent: some View {
        VStack(spacing: RMTheme.Spacing.sectionSpacing) {
            // Integrity Surface
            RMIntegritySurface(jobId: jobId)
                .padding(.horizontal, RMTheme.Spacing.pagePadding)
            
            // Generate Buttons
            generateButtonsSection
            
            // Export Queue
            exportQueueSection
            
            // Recent Exports
            recentExportsSection
            
            // Last Export Quick Access
            lastExportSection
        }
        .padding(.vertical, RMTheme.Spacing.lg)
    }
    
    private var generateButtonsSection: some View {
        VStack(spacing: RMTheme.Spacing.md) {
            ExportCard(
                title: "Risk Snapshot Report",
                description: "Complete job documentation with hazards, controls, and evidence",
                icon: "doc.text.fill",
                action: {
                    await generateExport(type: .pdf)
                },
                isGenerating: isGenerating(.pdf)
            )
            
            ExportCard(
                title: "Proof Pack",
                description: "ZIP archive with all PDFs, evidence, and verification",
                icon: "archivebox.fill",
                action: {
                    await generateExport(type: .proofPack)
                },
                isGenerating: isGenerating(.proofPack)
            )
        }
        .padding(.horizontal, RMTheme.Spacing.pagePadding)
    }
    
    @ViewBuilder
    private var exportQueueSection: some View {
        if !activeExports.isEmpty {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                Text("Export Queue")
                    .rmSectionHeader()
                    .padding(.horizontal, RMTheme.Spacing.pagePadding)
                
                ForEach(activeExports) { export in
                    ExportStatusCard(export: export)
                        .padding(.horizontal, RMTheme.Spacing.pagePadding)
                }
            }
        }
    }
    
    @ViewBuilder
    private var recentExportsSection: some View {
        VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
            Text("Recent Exports")
                .rmSectionHeader()
                .padding(.horizontal, RMTheme.Spacing.pagePadding)
            
            if recentExports.isEmpty {
                Text("Proof Packs and PDFs will appear here after you generate them.")
                    .font(RMTheme.Typography.bodySmall)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                    .padding(.horizontal, RMTheme.Spacing.pagePadding)
                    .padding(.vertical, RMTheme.Spacing.md)
            } else {
                ForEach(recentExports) { export in
                    RecentExportCard(
                        export: export,
                        onView: {
                            if case .ready = export.state, let url = export.fileURL {
                                shareURL = url
                                showShareSheet = true
                            }
                        },
                        onFailed: {
                            failedExport = export
                            showFailedExportSheet = true
                        }
                    )
                    .padding(.horizontal, RMTheme.Spacing.pagePadding)
                }
            }
        }
    }
    
    @ViewBuilder
    private var lastExportSection: some View {
        if let lastPDF = exportManager.getLastExport(jobId: jobId, type: .pdf) {
            LastExportCard(export: lastPDF, onView: {
                shareURL = lastPDF.fileURL
                showShareSheet = true
            })
            .padding(.horizontal, RMTheme.Spacing.pagePadding)
        }
    }
    
    var body: some View {
        ScrollView(showsIndicators: false) {
            scrollContent
        }
        .trustToast(
            message: "Ledger recorded",
            icon: "checkmark.circle.fill",
            isPresented: $showTrustToast
        )
        .sheet(isPresented: $showShareSheet) {
            if let shareURL = shareURL {
                ShareSheet(items: [shareURL])
            }
        }
        .alert("Error", isPresented: $showError) {
            Button("OK", role: .cancel) { }
        } message: {
            Text(errorMessage)
        }
        .onChange(of: exportManager.exports) { _, _ in
            checkForCompletedExport()
        }
        .sheet(isPresented: $showExportReceipt) {
            if let export = completedExport {
                ExportReceiptView(export: export)
            }
        }
        .sheet(isPresented: $showFailedExportSheet) {
            if let export = failedExport {
                FailedExportSheet(
                    export: export,
                    onRetry: {
                        showFailedExportSheet = false
                        Task {
                            await generateExport(type: export.type)
                        }
                    },
                    onCopyID: {
                        UIPasteboard.general.string = export.id
                        ToastCenter.shared.show("Export ID Copied", systemImage: "doc.on.doc", style: .success)
                    },
                    onAddEvidence: {
                        showFailedExportSheet = false
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                            quickAction.presentEvidence(jobId: jobId)
                        }
                    }
                )
                .presentationDetents([.medium])
            }
        }
        .onAppear {
            // Request notification permission for export completion
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
        }
    }
    
    private func checkForCompletedExport() {
        if let export = exportManager.exports.first(where: { $0.jobId == jobId && $0.state == .ready && $0.initiatedFromForeground && $0.fileURL != nil }) {
            completedExport = export
            showExportReceipt = true
            showTrustToast = true
        }
    }
    
    private func isGenerating(_ type: ExportType) -> Bool {
        activeExports.contains { $0.type == type }
    }
    
    private func generateExport(type: ExportType) async {
        do {
            try await exportManager.export(
                jobId: jobId,
                type: type,
                initiatedFromForeground: true
            )
        } catch {
            errorMessage = ExportErrorMessages.friendlyMessage(for: error)
            showError = true
        }
    }
}

struct ExportStatusCard: View {
    let export: ExportTask
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                HStack {
                    Image(systemName: iconName)
                        .foregroundColor(iconColor)
                        .font(.system(size: 16))
                    
                    Text(export.type.displayName)
                        .font(RMTheme.Typography.bodySmallBold)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    
                    Spacer()
                }
                
                if case .preparing = export.state {
                    ProgressView()
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else if case .downloading = export.state {
                    GeometryReader { geometry in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 4)
                                .fill(RMTheme.Colors.inputFill)
                                .frame(height: 4)
                            
                            RoundedRectangle(cornerRadius: 4)
                                .fill(RMTheme.Colors.accent)
                                .frame(width: geometry.size.width * export.progress, height: 4)
                        }
                    }
                    .frame(height: 4)
                }
                
                Text(statusText)
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(RMTheme.Colors.textSecondary)
            }
        }
    }
    
    private var iconName: String {
        switch export.state {
        case .queued: return "clock.fill"
        case .preparing: return "gearshape.fill"
        case .downloading: return "arrow.down.circle.fill"
        case .ready: return "checkmark.circle.fill"
        case .failed: return "exclamationmark.triangle.fill"
        }
    }
    
    private var iconColor: Color {
        switch export.state {
        case .queued: return RMTheme.Colors.textTertiary
        case .preparing, .downloading: return RMTheme.Colors.accent
        case .ready: return RMTheme.Colors.success
        case .failed: return RMTheme.Colors.error
        }
    }
    
    private var statusText: String {
        switch export.state {
        case .queued: return "Queued"
        case .preparing: return "Preparing..."
        case .downloading: return "Downloading... \(Int(export.progress * 100))%"
        case .ready: return "Ready"
        case .failed(let error): return "Failed: \(error)"
        }
    }
}

struct RecentExportCard: View {
    let export: ExportTask
    let onView: () -> Void
    var onFailed: (() -> Void)? = nil
    
    private var statusLabel: String {
        switch export.state {
        case .queued: return "Queued"
        case .preparing: return "Processing"
        case .downloading: return "Downloading"
        case .ready: return "Ready"
        case .failed: return "Failed"
        }
    }
    
    private var statusColor: Color {
        switch export.state {
        case .queued, .preparing, .downloading: return RMTheme.Colors.textTertiary
        case .ready: return RMTheme.Colors.success
        case .failed: return RMTheme.Colors.error
        }
    }
    
    private var isFailed: Bool {
        if case .failed = export.state { return true }
        return false
    }
    
    private var isReady: Bool {
        if case .ready = export.state { return export.fileURL != nil }
        return false
    }
    
    var body: some View {
        RMGlassCard {
            HStack {
                Image(systemName: export.type == .pdf ? "doc.text.fill" : "archivebox.fill")
                    .foregroundColor(isFailed ? RMTheme.Colors.error : RMTheme.Colors.accent)
                    .font(.system(size: 20))
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(export.type.displayName)
                        .font(RMTheme.Typography.bodySmallBold)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    
                    HStack(spacing: RMTheme.Spacing.sm) {
                        Text(formatDate(export.createdAt))
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.textSecondary)
                        Text("•")
                            .foregroundColor(RMTheme.Colors.textTertiary)
                        Text(statusLabel)
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(statusColor)
                    }
                }
                
                Spacer()
                
                if isReady {
                    Button {
                        onView()
                    } label: {
                        Text("View")
                            .font(RMTheme.Typography.bodySmallBold)
                            .foregroundColor(RMTheme.Colors.accent)
                    }
                } else if isFailed {
                    Button {
                        Haptics.tap()
                        onFailed?()
                    } label: {
                        Text("Details")
                            .font(RMTheme.Typography.bodySmallBold)
                            .foregroundColor(RMTheme.Colors.error)
                    }
                }
            }
        }
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

struct LastExportCard: View {
    let export: LastExport
    let onView: () -> Void
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                HStack {
                    Image(systemName: "clock.arrow.circlepath")
                        .foregroundColor(RMTheme.Colors.accent)
                        .font(.system(size: 16))
                    
                    Text("Last \(export.type.displayName)")
                        .rmSectionHeader()
                    
                    Spacer()
                }
                
                Text("Generated \(formatDate(export.generatedAt))")
                    .font(RMTheme.Typography.bodySmall)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                
                Button {
                    onView()
                } label: {
                    Text("View Last Export")
                        .font(RMTheme.Typography.bodySmallBold)
                        .foregroundColor(.black)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, RMTheme.Spacing.sm)
                        .background(RMTheme.Colors.accent)
                        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
                }
            }
        }
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

// ShareSheet moved to Components/UIKit/ShareSheet.swift

/// Sheet shown when tapping a failed export - shows failure reason + smart CTAs (Add Evidence, Retry, Contact Support).
struct FailedExportSheet: View {
    let export: ExportTask
    let onRetry: () -> Void
    let onCopyID: () -> Void
    /// When non-nil and failure reason suggests missing evidence, show "Add Evidence" CTA.
    var onAddEvidence: (() -> Void)? = nil
    @Environment(\.dismiss) private var dismiss
    
    private var errorReason: String {
        if case .failed(let reason) = export.state {
            return reason
        }
        return "Unknown error"
    }
    
    /// Show "Add Evidence" when reason indicates user-fixable evidence gap (missing evidence, upload photos).
    private var showAddEvidenceCTA: Bool {
        guard onAddEvidence != nil else { return false }
        let lower = errorReason.lowercased()
        return lower.contains("evidence") || lower.contains("missing") || lower.contains("upload")
    }
    
    var body: some View {
        NavigationStack {
            VStack(spacing: RMTheme.Spacing.lg) {
                // Error icon
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 48))
                    .foregroundColor(RMTheme.Colors.error)
                    .padding(.top, RMTheme.Spacing.xl)
                
                Text("Export Failed")
                    .font(RMTheme.Typography.title)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                
                Text(errorReason)
                    .font(RMTheme.Typography.bodySmall)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, RMTheme.Spacing.lg)
                
                Spacer()
                
                VStack(spacing: RMTheme.Spacing.md) {
                    // Add Evidence (user-fixable first)
                    if showAddEvidenceCTA, let onAddEvidence = onAddEvidence {
                        Button {
                            Haptics.impact(.medium)
                            dismiss()
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                                onAddEvidence()
                            }
                        } label: {
                            HStack {
                                Image(systemName: "camera.fill")
                                Text("Add Evidence")
                                    .font(RMTheme.Typography.bodyBold)
                            }
                            .foregroundColor(.black)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, RMTheme.Spacing.md)
                            .background(RMTheme.Colors.accent)
                            .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
                        }
                    }
                    
                    // Retry button
                    Button {
                        Haptics.impact(.medium)
                        onRetry()
                    } label: {
                        HStack {
                            Image(systemName: "arrow.clockwise")
                            Text("Try Again")
                                .font(RMTheme.Typography.bodyBold)
                        }
                        .foregroundColor(.black)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, RMTheme.Spacing.md)
                        .background(showAddEvidenceCTA ? RMTheme.Colors.accent.opacity(0.2) : RMTheme.Colors.accent)
                        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
                    }
                    
                    // Copy ID
                    Button {
                        Haptics.tap()
                        onCopyID()
                    } label: {
                        Label("Copy Export ID", systemImage: "doc.on.doc")
                            .font(RMTheme.Typography.bodySmall)
                            .foregroundColor(RMTheme.Colors.accent)
                    }
                    
                    // Contact Support (mailto + copy ID)
                    Button {
                        Haptics.tap()
                        onCopyID()
                        let subject = "Export Failed"
                        let body = "Export ID: \(export.id)"
                        let encoded = "mailto:support@riskmate.dev?subject=\(subject.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? subject)&body=\(body.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? body)"
                        if let url = URL(string: encoded) {
                            UIApplication.shared.open(url)
                        }
                    } label: {
                        Label("Contact Support", systemImage: "envelope")
                            .font(RMTheme.Typography.bodySmall)
                            .foregroundColor(RMTheme.Colors.textSecondary)
                    }
                }
                .padding(.horizontal, RMTheme.Spacing.pagePadding)
                .padding(.bottom, RMTheme.Spacing.xl)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(RMTheme.Colors.background)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

struct ExportCard: View {
    let title: String
    let description: String
    let icon: String
    let action: () async -> Void
    let isGenerating: Bool
    var disabled: Bool = false
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                HStack {
                    Image(systemName: icon)
                        .foregroundColor(disabled ? RMTheme.Colors.textTertiary : RMTheme.Colors.accent)
                        .font(.system(size: 24))
                    
                    Text(title)
                        .rmSectionHeader()
                        .foregroundColor(disabled ? RMTheme.Colors.textTertiary : RMTheme.Colors.textPrimary)
                    
                    Spacer()
                }
                
                Text(description)
                    .font(RMTheme.Typography.bodySmall)
                    .foregroundColor(disabled ? RMTheme.Colors.textTertiary : RMTheme.Colors.textSecondary)
                
                Button {
                    Task {
                        await action()
                    }
                } label: {
                    if isGenerating {
                        HStack {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .black))
                            Text("Generating...")
                                .font(RMTheme.Typography.bodySmallBold)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, RMTheme.Spacing.sm)
                        .background(RMTheme.Colors.accent.opacity(0.7))
                        .foregroundColor(.black)
                        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
                    } else {
                        Text("Generate")
                            .font(RMTheme.Typography.bodySmallBold)
                            .foregroundColor(.black)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, RMTheme.Spacing.sm)
                            .background(disabled ? RMTheme.Colors.inputFill : RMTheme.Colors.accent)
                            .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
                    }
                }
                .disabled(isGenerating || disabled)
            }
        }
        .opacity(disabled ? 0.8 : 1)
    }
}

#Preview {
    NavigationStack {
        JobDetailView(jobId: "1")
    }
    .environmentObject(QuickActionRouter.shared)
}
