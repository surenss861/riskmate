import SwiftUI
import SwiftDate

/// Jobs List View with search, filters, and premium interactions
struct JobsListView: View {
    let initialFilter: String?
    
    @StateObject private var jobsStore = JobsStore.shared
    @StateObject private var entitlements = EntitlementsManager.shared
    @StateObject private var statusManager = ServerStatusManager.shared
    @EnvironmentObject private var quickAction: QuickActionRouter
    @State private var searchText = ""
    @State private var debouncedSearchText = ""
    @State private var selectedStatus: String = "all"
    @State private var selectedRiskLevel: String = "all"
    @FocusState private var isSearchFocused: Bool
    @State private var isRefreshing = false
    @State private var showExportProofSheet = false
    @State private var exportProofJobId: String? = nil
    @State private var showCreateJobSheet = false
    @State private var showCloseJobConfirm = false
    @State private var jobToClose: Job? = nil
    @Namespace private var jobListNamespace
    @Namespace private var filterChipNamespace
    @State private var selectedQuickChip: JobsQuickFilter?
    @State private var scrollY: CGFloat = 0
    @State private var scrollBaselineY: CGFloat?

    private let scrollSpace = "workRecordsScroll"

    private var dividerOpacity: CGFloat {
        let raw = (scrollBaselineY ?? 0) - scrollY
        let amount = max(0, raw)
        if amount < 16 { return 0 }
        if amount > 28 { return maxDividerOpacity }
        let t = (amount - 16) / (28 - 16)
        return maxDividerOpacity * t
    }

    private let maxDividerOpacity: CGFloat = 0.075

    init(initialFilter: String? = nil) {
        self.initialFilter = initialFilter
    }
    
    private var isAuditor: Bool { entitlements.isAuditor() }
    
    // Computed properties from store
    private var jobs: [Job] { jobsStore.jobs }
    private var isLoading: Bool { jobsStore.isLoading }
    private var errorMessage: String? { jobsStore.errorMessage }
    private var lastSyncDate: Date? { jobsStore.lastSyncDate }
    
    private var hasActiveFilters: Bool {
        selectedStatus != "all" || selectedRiskLevel != "all" || !searchText.isEmpty || selectedQuickChip != nil
    }
    
    private var resultsCountHighRisk: Int {
        filteredJobs.filter { ($0.riskScore ?? 0) >= 80 }.count
    }
    
    private var resultsCountNeedEvidence: Int {
        filteredJobs.filter { job in
            let req = job.evidenceRequired ?? 0
            return req > 0 && (job.evidenceCount ?? 0) < req
        }.count
    }

    /// Quick insight line under controls: "Showing 12 jobs · 3 need evidence · 1 high risk"
    private var resultsCountLine: String {
        var parts: [String] = ["Showing \(filteredJobs.count) jobs"]
        if resultsCountNeedEvidence > 0 { parts.append("\(resultsCountNeedEvidence) need evidence") }
        if resultsCountHighRisk > 0 { parts.append("\(resultsCountHighRisk) high risk") }
        return parts.joined(separator: " · ")
    }
    
    var filteredJobs: [Job] {
        var filtered = jobs

        // Quick chip (applied first for instant feedback)
        if let chip = selectedQuickChip {
            filtered = applyQuickFilter(chip, to: filtered)
        }

        // Search filter (use debounced text)
        if !debouncedSearchText.isEmpty {
            filtered = filtered.filter { job in
                job.clientName.localizedCaseInsensitiveContains(debouncedSearchText) ||
                job.jobType.localizedCaseInsensitiveContains(debouncedSearchText) ||
                job.location.localizedCaseInsensitiveContains(debouncedSearchText)
            }
        }

        // Status filter
        if selectedStatus != "all" {
            filtered = filtered.filter { $0.status == selectedStatus }
        }

        // Risk level filter
        if selectedRiskLevel != "all" {
            filtered = filtered.filter { $0.riskLevel?.lowercased() == selectedRiskLevel.lowercased() }
        }

        return filtered
    }

    /// Jobs that need action: missing signatures (active), missing evidence, or high risk. For "Needs action" section.
    private var needsActionJobs: [Job] {
        filteredJobs.filter { job in
            if job.status.lowercased() == "active" { return true }
            if let req = job.evidenceRequired, req > 0, (job.evidenceCount ?? 0) < req { return true }
            let level = (job.riskLevel ?? "").lowercased()
            if level == "high" || level == "critical" { return true }
            if (job.riskScore ?? 0) >= 80 { return true }
            return false
        }
    }

    /// Jobs not in Needs action; shown in "Recent jobs" section.
    private var recentJobs: [Job] {
        let needIds = Set(needsActionJobs.map(\.id))
        return filteredJobs.filter { !needIds.contains($0.id) }
    }
    
    private func applyQuickFilter(_ chip: JobsQuickFilter, to list: [Job]) -> [Job] {
        switch chip {
        case .highRisk:
            return list.filter { job in
                let level = (job.riskLevel ?? "").lowercased()
                return level == "high" || level == "critical"
            }
        case .blockers:
            return list.filter { job in (job.riskScore ?? 0) >= 80 }
        case .needsSignature:
            return list.filter { $0.status == "active" }
        case .recent:
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            let fallback = ISO8601DateFormatter()
            fallback.formatOptions = [.withInternetDateTime]
            let cutoff = Calendar.current.date(byAdding: .day, value: -7, to: Date()) ?? Date()
            return list.filter { job in
                let dateStr = job.updatedAt ?? job.createdAt
                guard let date = formatter.date(from: dateStr) ?? fallback.date(from: dateStr) else { return false }
                return date >= cutoff
            }
        }
    }
    
    var body: some View {
        RMBackground()
            .overlay {
                VStack(spacing: 0) {
                    RMOfflineBanner()
                    // Jobs List (control surface is in safeAreaInset so it stays pinned)
                    if isLoading {
                        ScrollView {
                            VStack(spacing: RMTheme.Spacing.md) {
                                RMSkeletonList(count: 6)
                            }
                            .padding(.top, RMTheme.Spacing.md)
                        }
                    } else if let errorMessage = errorMessage {
                        // Error state - show error with retry
                        VStack(spacing: RMTheme.Spacing.lg) {
                            RMEmptyState(
                                icon: "exclamationmark.triangle.fill",
                                title: "Failed to Load Jobs",
                                message: errorMessage,
                                    action: RMEmptyStateAction(
                                        title: "Retry",
                                        action: {
                                            Task {
                                                _ = try? await jobsStore.fetch(forceRefresh: true)
                                            }
                                        }
                                    )
                            )
                        }
                        .padding(RMTheme.Spacing.pagePadding)
                    } else if filteredJobs.isEmpty {
                        VStack(spacing: RMTheme.Spacing.lg) {
                            RMEmptyState(
                                icon: searchText.isEmpty ? "doc.text" : "magnifyingglass",
                                title: searchText.isEmpty ? "No active jobs yet" : "No Results",
                                message: searchText.isEmpty
                                    ? (isAuditor ? "Job creation is available on the web app. Use the Ledger and Operations tabs to view and add evidence to existing jobs." : "Create your first job below or use Ledger and Operations to add evidence.")
                                    : "Try adjusting your search, filters, or time range. No jobs match your criteria.",
                                action: searchText.isEmpty && !isAuditor ? RMEmptyStateAction(
                                    title: "Create Job",
                                    action: { showCreateJobSheet = true }
                                ) : nil,
                                voiceHint: searchText.isEmpty ? "Try saying: \"Show high risk jobs\"" : nil
                            )
                            if searchText.isEmpty && jobs.isEmpty {
                                VStack(spacing: RMTheme.Spacing.sm) {
                                    Divider()
                                        .background(RMTheme.Colors.divider.opacity(0.3))
                                    Text("Work Records become immutable only when anchored to the ledger.")
                                        .font(RMTheme.Typography.bodySmall)
                                        .foregroundColor(RMTheme.Colors.textTertiary)
                                        .multilineTextAlignment(.center)
                                        .padding(.horizontal, RMTheme.Spacing.md)
                                    if !statusManager.isOnline && !isAuditor {
                                        HStack(spacing: RMTheme.Spacing.xs) {
                                            Image(systemName: "wifi.slash")
                                                .foregroundColor(RMTheme.Colors.warning)
                                            Text("Create jobs offline — they'll sync when you're back online.")
                                                .font(RMTheme.Typography.caption)
                                                .foregroundColor(RMTheme.Colors.textSecondary)
                                        }
                                        .padding(.horizontal, RMTheme.Spacing.md)
                                        .padding(.top, RMTheme.Spacing.xs)
                                    }
                                }
                                .padding(.top, RMTheme.Spacing.md)
                            }
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .padding(RMSystemTheme.Spacing.xl)
                    } else {
                        List {
                            Section {
                                Color.clear
                                    .frame(height: 1)
                                    .listRowInsets(EdgeInsets())
                                    .listRowBackground(Color.clear)
                                    .listRowSeparator(.hidden)
                                    .trackScrollY(in: scrollSpace)
                            }
                            if !needsActionJobs.isEmpty {
                                Section {
                                    ForEach(Array(needsActionJobs.enumerated()), id: \.element.id) { index, job in
                                        jobRowLink(index: index, job: job, isLastInSection: job.id == needsActionJobs.last?.id, reasons: needsActionReasons(for: job))
                                    }
                                } header: {
                                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                                        Text("Needs action")
                                            .font(RMTheme.Typography.sectionTitle)
                                            .foregroundColor(RMTheme.Colors.textPrimary)
                                        Text("• \(needsActionJobs.count)")
                                            .font(.system(size: 11, weight: .medium, design: .monospaced))
                                            .foregroundColor(RMTheme.Colors.textTertiary)
                                            .padding(.horizontal, 8)
                                            .padding(.vertical, 4)
                                            .background(RMTheme.Colors.surface1.opacity(0.9))
                                            .clipShape(Capsule())
                                    }
                                }
                            }
                            Section {
                                ForEach(Array(recentJobs.enumerated()), id: \.element.id) { index, job in
                                    jobRowLink(index: index, job: job, isLastInSection: job.id == recentJobs.last?.id, reasons: [])
                                }
                            } header: {
                                HStack(alignment: .firstTextBaseline, spacing: RMTheme.Spacing.sm) {
                                    Text("Recent jobs")
                                        .font(RMTheme.Typography.sectionTitle)
                                        .foregroundColor(RMTheme.Colors.textPrimary)
                                    if !jobsStore.pendingJobIds.isEmpty {
                                        Text("\(jobsStore.pendingJobIds.count) pending")
                                            .font(RMTheme.Typography.caption)
                                            .foregroundColor(RMTheme.Colors.warning)
                                            .padding(.horizontal, RMTheme.Spacing.sm)
                                            .padding(.vertical, 2)
                                            .background(RMTheme.Colors.warning.opacity(0.2))
                                            .clipShape(Capsule())
                                    }
                                }
                            }
                            // Load more indicator
                            if jobsStore.isLoadingMore {
                                HStack {
                                    Spacer()
                                    ProgressView()
                                        .padding()
                                    Spacer()
                                }
                                .listRowBackground(Color.clear)
                            }
                            // End of list indicator
                            if !jobsStore.hasMore && !filteredJobs.isEmpty {
                                HStack {
                                    Spacer()
                                    Text("All jobs loaded")
                                        .font(RMTheme.Typography.caption)
                                        .foregroundColor(RMTheme.Colors.textTertiary)
                                        .padding()
                                    Spacer()
                                }
                                .listRowBackground(Color.clear)
                            }
                        }
                        .listStyle(.plain)
                        .scrollContentBackground(.hidden)
                        .scrollDismissesKeyboard(.interactively)
                        .coordinateSpace(name: scrollSpace)
                    }
                }
            }
            .onPreferenceChange(ScrollYKey.self) { value in
                if scrollBaselineY == nil { scrollBaselineY = value }
                scrollY = value
            }
            .rmNavigationBar(title: "Work Records")
            .toolbar(.hidden, for: .navigationBar)
            .safeAreaInset(edge: .top, spacing: 0) {
                RMTopBar(title: "Work Records", notificationBadge: 0) {
                    if !isAuditor {
                        Button {
                            Haptics.tap()
                            showCreateJobSheet = true
                        } label: {
                            Image(systemName: "plus")
                                .font(.system(size: 17, weight: .semibold))
                                .foregroundColor(RMTheme.Colors.textPrimary)
                                .frame(width: 40, height: 40)
                                .background(RMTheme.Colors.surface2)
                                .clipShape(Circle())
                                .overlay(Circle().stroke(Color.white.opacity(RMTheme.Surfaces.strokeOpacity), lineWidth: 1))
                                .themeShadow(RMTheme.Shadow.cardLight)
                        }
                        .accessibilityLabel("Create new job")
                    }
                }
            }
            .safeAreaInset(edge: .top, spacing: 0) {
                VStack(spacing: 0) {
                    VStack(spacing: 8) {
                        // Today control strip (mini command center)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                workRecordActionChip(icon: "plus.circle.fill", title: "Create Job") {
                                    showCreateJobSheet = true
                                }
                                workRecordActionChip(icon: "camera.fill", title: "Add Evidence") {
                                    quickAction.presentEvidence(jobId: nil)
                                }
                                workRecordActionChip(icon: "signature", title: "Request Signatures") {
                                    quickAction.requestSwitchToLedger()
                                }
                                workRecordActionChip(icon: "square.and.arrow.up", title: "Export") {
                                    quickAction.requestSwitchToLedger()
                                }
                            }
                            .padding(.horizontal, 2)
                        }
                        .padding(.bottom, 2)
                        HStack(spacing: RMTheme.Spacing.sm) {
                            Image(systemName: "magnifyingglass")
                                .foregroundColor(RMTheme.Colors.textTertiary)
                                .accessibilityHidden(true)
                            TextField("Search jobs...", text: $searchText)
                                .focused($isSearchFocused)
                                .foregroundColor(RMTheme.Colors.textPrimary)
                                .font(RMTheme.Typography.body)
                                .accessibilityLabel("Search jobs")
                        }
                        .padding(.horizontal, RMTheme.Spacing.md)
                        .frame(height: 44)
                        .background(RMTheme.Colors.inputFill)
                        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
                        .overlay(RoundedRectangle(cornerRadius: RMTheme.Radius.sm).stroke(isSearchFocused ? RMTheme.Colors.inputStrokeFocused : RMTheme.Colors.inputStroke, lineWidth: 1))
                        RMFilterChips(selection: $selectedQuickChip, namespace: filterChipNamespace)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                FilterPill(
                                    title: "Status",
                                    value: $selectedStatus,
                                    options: ["all": "All", "active": "Active", "in_progress": "In Progress", "completed": "Completed", "cancelled": "Cancelled"],
                                    onSelect: { selectedStatus = $0 }
                                )
                                FilterPill(
                                    title: "Risk",
                                    value: $selectedRiskLevel,
                                    options: ["all": "All", "low": "Low", "medium": "Medium", "high": "High", "critical": "Critical"],
                                    onSelect: { selectedRiskLevel = $0 }
                                )
                                if hasActiveFilters {
                                    Button {
                                        selectedStatus = "all"
                                        selectedRiskLevel = "all"
                                        selectedQuickChip = nil
                                        searchText = ""
                                        FilterPersistence.clearJobsFilters()
                                    } label: {
                                        HStack(spacing: 4) {
                                            Image(systemName: "xmark.circle.fill")
                                            Text("Clear")
                                        }
                                        .font(RMTheme.Typography.captionBold)
                                        .foregroundColor(RMTheme.Colors.textSecondary)
                                        .padding(.horizontal, RMTheme.Spacing.sm)
                                        .padding(.vertical, RMTheme.Spacing.xs)
                                        .background(RMTheme.Colors.inputFill)
                                        .clipShape(Capsule())
                                    }
                                    .accessibilityLabel("Clear filters")
                                }
                            }
                        }
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RMTheme.Colors.surface2)
                    .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.card))
                    .overlay(RoundedRectangle(cornerRadius: RMTheme.Radius.card).stroke(Color.white.opacity(RMTheme.Surfaces.strokeOpacity), lineWidth: 1))
                    .themeShadow(RMTheme.Shadow.card)
                    .padding(.horizontal, 16)
                    .padding(.top, RMTheme.Spacing.sm)
                    .padding(.bottom, 0)
                    Text(resultsCountLine)
                        .font(.system(size: 11))
                        .foregroundColor(RMTheme.Colors.textTertiary.opacity(0.62))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 16)
                        .padding(.top, 6)
                        .padding(.bottom, 8)
                    Rectangle()
                        .fill(.ultraThinMaterial)
                        .opacity(dividerOpacity)
                        .frame(height: 1)
                        .transaction { $0.animation = .easeOut(duration: 0.15) }
                }
                .background(RMTheme.Colors.background)
            }
            .syncStatusChip()
            .onAppear {
                // Apply initial filter if provided (e.g. from Dashboard tap-to-drill)
                if let filter = initialFilter {
                    switch filter {
                    case "active":
                        selectedStatus = "active"
                    case "highRisk":
                        selectedRiskLevel = "high"
                        selectedQuickChip = .highRisk
                    case "blockers":
                        selectedQuickChip = .blockers
                    case "missingEvidence":
                        selectedStatus = "active"
                    default:
                        break
                    }
                }
            }
            .task {
                let filters = FilterPersistence.loadJobsFilters()
                selectedStatus = filters.status
                selectedRiskLevel = filters.riskLevel
                if let raw = FilterPersistence.loadJobsQuickChip(), let chip = JobsQuickFilter(rawValue: raw) {
                    selectedQuickChip = chip
                }
                _ = try? await jobsStore.fetch()
            }
            .onChange(of: searchText) { _, newValue in
                // Debounce search input (200ms)
                Task {
                    try? await Task.sleep(nanoseconds: 200_000_000)
                    if newValue == searchText {
                        debouncedSearchText = newValue
                    }
                }
            }
            .onChange(of: selectedStatus) { _, _ in
                FilterPersistence.saveJobsFilters(status: selectedStatus, riskLevel: selectedRiskLevel)
            }
            .onChange(of: selectedRiskLevel) { _, _ in
                FilterPersistence.saveJobsFilters(status: selectedStatus, riskLevel: selectedRiskLevel)
            }
            .onChange(of: selectedQuickChip) { _, new in
                FilterPersistence.saveJobsQuickChip(new?.rawValue)
            }
            .anchoringRefresh(isRefreshing: $isRefreshing) {
                _ = try? await jobsStore.fetch(forceRefresh: true)
            }
            .navigationDestination(for: Job.self) { job in
                JobDetailView(jobId: job.id, initialJob: job, namespace: jobListNamespace)
            }
            .sheet(isPresented: $showExportProofSheet, onDismiss: { exportProofJobId = nil }) {
                if let id = exportProofJobId {
                    ExportProofSheet(jobId: id, isPresented: $showExportProofSheet)
                }
            }
            .sheet(isPresented: $showCreateJobSheet) {
                CreateJobSheet()
            }
            .confirmationDialog("Mark as complete?", isPresented: $showCloseJobConfirm, titleVisibility: .visible) {
                Button("Mark complete") {
                    Haptics.tap()
                    ToastCenter.shared.show("Coming soon", systemImage: "clock", style: .info)
                    jobToClose = nil
                    showCloseJobConfirm = false
                }
                Button("Cancel", role: .cancel) {
                    jobToClose = nil
                    showCloseJobConfirm = false
                }
            } message: {
                Text("Close this job and mark it complete. Full support coming soon.")
            }
    }

    private func presentCloseJobConfirm(for job: Job) {
        guard job.status.lowercased() != "completed", job.status.lowercased() != "cancelled" else { return }
        jobToClose = job
        showCloseJobConfirm = true
    }

    private func presentExportSheet(for job: Job) {
        exportProofJobId = job.id
        showExportProofSheet = true
    }

    /// Reason labels for Needs action section only. Use "Open job" until we have real signature signal (e.g. signatureRequired && signatureCount == 0).
    private func needsActionReasons(for job: Job) -> [String] {
        var r: [String] = []
        if let req = job.evidenceRequired, req > 0, (job.evidenceCount ?? 0) < req { r.append("Missing evidence") }
        if job.status.lowercased() == "active" { r.append("Open job") }
        let level = (job.riskLevel ?? "").lowercased()
        if level == "high" || level == "critical" || (job.riskScore ?? 0) >= 80 { r.append("High risk") }
        return r
    }

    @ViewBuilder
    private func jobRowLink(index: Int, job: Job, isLastInSection: Bool, reasons: [String] = []) -> some View {
        NavigationLink(value: job) {
            VStack(alignment: .leading, spacing: 6) {
                JobCard(
                    job: job,
                    isOffline: jobsStore.pendingCreatedJobIds.contains(job.id),
                    isUnsynced: jobsStore.pendingUpdateJobIds.contains(job.id) && !jobsStore.pendingCreatedJobIds.contains(job.id),
                    namespace: jobListNamespace
                ) {
                    // Navigation handled by NavigationLink
                }
                if !reasons.isEmpty {
                    HStack(spacing: 6) {
                        ForEach(reasons, id: \.self) { reason in
                            Text(reason)
                                .font(.system(size: 10, weight: .medium, design: .monospaced))
                                .foregroundColor(RMTheme.Colors.textTertiary)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(RMTheme.Colors.surface1.opacity(0.7))
                                .clipShape(Capsule())
                        }
                    }
                }
            }
        }
        .rmAppearIn(staggerIndex: min(index, 12))
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
        .listRowInsets(EdgeInsets(
            top: RMTheme.Spacing.xs,
            leading: RMTheme.Spacing.md,
            bottom: RMTheme.Spacing.xs,
            trailing: RMTheme.Spacing.md
        ))
        .jobCardLongPressActions(
            job: job,
            onAddEvidence: isAuditor ? nil : { quickAction.presentEvidence(jobId: job.id) },
            onViewLedger: { quickAction.requestSwitchToLedger() },
            onExportProof: { presentExportSheet(for: job) }
        )
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            if !isAuditor {
                Button {
                    Haptics.tap()
                    quickAction.presentEvidence(jobId: job.id)
                } label: {
                    Label("Add evidence", systemImage: "camera.fill")
                }
                .tint(RMTheme.Colors.accent)
            }
            Button {
                Haptics.success()
                presentExportSheet(for: job)
            } label: {
                Label("Export", systemImage: "square.and.arrow.up")
            }
            .tint(RMTheme.Colors.categoryAccess)
            if job.status.lowercased() != "completed", job.status.lowercased() != "cancelled" {
                Button {
                    Haptics.tap()
                    presentCloseJobConfirm(for: job)
                } label: {
                    Label("Close job", systemImage: "checkmark.circle")
                }
                .tint(RMTheme.Colors.success)
            }
            Button {
                Haptics.success()
                copyJobId(job.id)
            } label: {
                Label("Copy ID", systemImage: "doc.on.doc")
            }
            .tint(RMTheme.Colors.accent)
        }
        .contextMenu {
            if !isAuditor {
                Button {
                    quickAction.presentEvidence(jobId: job.id)
                } label: {
                    Label("Add evidence", systemImage: "camera.fill")
                }
            }
            Button {
                Haptics.success()
                presentExportSheet(for: job)
            } label: {
                Label("Export PDF", systemImage: "square.and.arrow.up")
            }
            if job.status.lowercased() != "completed", job.status.lowercased() != "cancelled" {
                Button {
                    presentCloseJobConfirm(for: job)
                } label: {
                    Label("Close job", systemImage: "checkmark.circle")
                }
            }
            Button {
                Haptics.success()
                copyJobId(job.id)
            } label: {
                Label("Copy Job ID", systemImage: "doc.on.doc")
            }
        }
        .onAppear {
            if job.id == filteredJobs.last?.id, jobsStore.hasMore, !jobsStore.isLoadingMore {
                Task {
                    try? await jobsStore.loadMore()
                }
            }
        }
    }

    private func workRecordActionChip(icon: String, title: String, action: @escaping () -> Void) -> some View {
        Button {
            Haptics.tap()
            action()
        } label: {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 14))
                Text(title)
                    .font(RMTheme.Typography.captionBold)
            }
            .foregroundColor(RMTheme.Colors.textPrimary)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(RMTheme.Colors.surface1.opacity(0.8))
            .clipShape(Capsule())
            .overlay(Capsule().stroke(Color.white.opacity(0.08), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
    
    // Note: loadJobs() removed - now using JobsStore.shared
    // Filters are applied client-side via filteredJobs computed property
    
    private func copyJobId(_ id: String) {
        Haptics.success()
        UIPasteboard.general.string = id
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)
    }
}

// MARK: - Job Row Component

struct RMJobRow: View {
    let job: Job
    
    var body: some View {
        HStack(spacing: RMTheme.Spacing.md) {
            // Risk Badge
            if let riskLevel = job.riskLevel {
                Text(riskLevel.uppercased())
                    .font(RMTheme.Typography.captionBold)
                    .foregroundColor(.white)
                    .padding(.horizontal, RMTheme.Spacing.sm)
                    .padding(.vertical, RMTheme.Spacing.xs)
                    .background(riskColor(riskLevel))
                    .clipShape(Capsule())
                    .frame(width: 70, alignment: .leading)
            }
            
            // Job Info
            VStack(alignment: .leading, spacing: RMTheme.Spacing.xs) {
                Text(job.clientName)
                    .font(RMTheme.Typography.bodySmallBold)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                    .lineLimit(1)
                
                Text("\(job.jobType) • \(job.location)")
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                    .lineLimit(1)
                
                HStack(spacing: RMTheme.Spacing.sm) {
                    StatusBadge(status: job.status)
                    
                    if let createdAt = ISO8601DateFormatter().date(from: job.createdAt) {
                        Text(relativeTime(createdAt))
                            .font(RMTheme.Typography.captionSmall)
                            .foregroundColor(RMTheme.Colors.textTertiary)
                    }
                }
            }
            
            Spacer()
            
            // Risk Score
            if let riskScore = job.riskScore {
                VStack(alignment: .trailing, spacing: RMTheme.Spacing.xs) {
                    Text("\(riskScore)")
                        .font(RMTheme.Typography.title3)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    
                    Text("Risk")
                        .font(RMTheme.Typography.captionSmall)
                        .foregroundColor(RMTheme.Colors.textTertiary)
                }
            }
            
            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(RMTheme.Colors.textTertiary)
        }
        .padding(.vertical, RMTheme.Spacing.sm)
        .padding(.horizontal, RMTheme.Spacing.md)
        .background(RMTheme.Colors.inputFill)
        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
        .overlay(
            RoundedRectangle(cornerRadius: RMTheme.Radius.sm)
                .stroke(RMTheme.Colors.border, lineWidth: 0.5)
        )
    }
    
    private func riskColor(_ level: String) -> Color {
        switch level.lowercased() {
        case "critical": return RMTheme.Colors.error
        case "high": return Color.orange
        case "medium": return RMTheme.Colors.warning
        case "low": return RMTheme.Colors.success
        default: return RMTheme.Colors.textTertiary
        }
    }
    
    private func relativeTime(_ date: Date) -> String {
        return date.toRelative(since: nil, dateTimeStyle: .named, unitsStyle: .short)
    }
}

// MARK: - Status Badge

struct StatusBadge: View {
    let status: String
    
    var body: some View {
        Text(status.replacingOccurrences(of: "_", with: " ").uppercased())
            .font(RMTheme.Typography.captionSmall)
            .foregroundColor(statusColor(status))
            .padding(.horizontal, RMTheme.Spacing.xs)
            .padding(.vertical, 2)
            .background(statusColor(status).opacity(0.2))
            .clipShape(Capsule())
    }
    
    private func statusColor(_ status: String) -> Color {
        switch status.lowercased() {
        case "completed": return RMTheme.Colors.success
        case "in_progress", "active": return RMTheme.Colors.info
        case "cancelled": return RMTheme.Colors.error
        default: return RMTheme.Colors.textTertiary
        }
    }
}

// MARK: - Filter Pill

struct FilterPill: View {
    let title: String
    @Binding var value: String
    let options: [String: String]
    let onSelect: (String) -> Void
    
    @State private var showingPicker = false
    
    var body: some View {
        Menu {
            ForEach(Array(options.keys.sorted()), id: \.self) { key in
                Button {
                    onSelect(key)
                    let generator = UIImpactFeedbackGenerator(style: .light)
                    generator.impactOccurred()
                } label: {
                    HStack {
                        Text(options[key] ?? key)
                        if value == key {
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }
        } label: {
            HStack(spacing: RMTheme.Spacing.xs) {
                Text(title)
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                
                Text(options[value] ?? "All")
                    .font(RMTheme.Typography.captionBold)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                
                Image(systemName: "chevron.down")
                    .font(.system(size: 10))
                    .foregroundColor(RMTheme.Colors.textTertiary)
            }
            .padding(.horizontal, RMTheme.Spacing.md)
            .padding(.vertical, RMTheme.Spacing.sm)
            .background(RMTheme.Colors.surface1.opacity(0.65))
            .clipShape(Capsule())
            .overlay(Capsule().stroke(value == "all" ? Color.white.opacity(0.07) : RMTheme.Colors.accent.opacity(0.35), lineWidth: 1))
            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: value)
        }
    }
}

// MARK: - Job Detail Sheet

struct RMJobDetailSheet: View {
    let job: Job
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: RMTheme.Spacing.lg) {
                    // Header
                    VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                        Text(job.clientName)
                            .font(RMTheme.Typography.title2)
                            .foregroundColor(RMTheme.Colors.textPrimary)
                        
                        HStack(spacing: RMTheme.Spacing.sm) {
                            if let riskLevel = job.riskLevel {
                                Text(riskLevel.uppercased())
                                    .font(RMTheme.Typography.captionBold)
                                    .foregroundColor(.white)
                                    .padding(.horizontal, RMTheme.Spacing.sm)
                                    .padding(.vertical, RMTheme.Spacing.xs)
                                    .background(riskColor(riskLevel))
                                    .clipShape(Capsule())
                            }
                            
                            StatusBadge(status: job.status)
                        }
                    }
                    
                    Divider()
                        .overlay(RMTheme.Colors.divider)
                    
                    // Details
                    DetailRow(label: "Job Type", value: job.jobType)
                    DetailRow(label: "Location", value: job.location)
                    
                    if let riskScore = job.riskScore {
                        DetailRow(label: "Risk Score", value: "\(riskScore)")
                    }
                    
                    if let createdAt = ISO8601DateFormatter().date(from: job.createdAt) {
                        DetailRow(label: "Created", value: formatDate(createdAt))
                    }
                    
                    // Job ID
                    HStack {
                        Text("Job ID")
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.textTertiary)
                        
                        Spacer()
                        
                        Button {
                            UIPasteboard.general.string = job.id
                            UINotificationFeedbackGenerator().notificationOccurred(.success)
                        } label: {
                            HStack(spacing: RMTheme.Spacing.xs) {
                                Text(job.id)
                                    .font(RMTheme.Typography.captionBold)
                                    .foregroundColor(RMTheme.Colors.accent)
                                
                                Image(systemName: "doc.on.doc")
                                    .font(.system(size: 12))
                                    .foregroundColor(RMTheme.Colors.accent)
                            }
                        }
                    }
                    .padding(RMTheme.Spacing.md)
                    .background(RMTheme.Colors.inputFill)
                    .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
                }
                .padding(RMTheme.Spacing.md)
            }
            .background(RMBackground())
            .navigationTitle("Job Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                    .foregroundColor(RMTheme.Colors.accent)
                }
            }
        }
    }
    
    private func riskColor(_ level: String) -> Color {
        switch level.lowercased() {
        case "critical": return RMTheme.Colors.error
        case "high": return Color.orange
        case "medium": return RMTheme.Colors.warning
        case "low": return RMTheme.Colors.success
        default: return RMTheme.Colors.textTertiary
        }
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Detail Row

struct DetailRow: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text(label)
                .font(RMTheme.Typography.bodyBold)
                .foregroundColor(RMTheme.Colors.textPrimary)
            
            Spacer()
            
            Text(value)
                .font(RMTheme.Typography.body)
                .foregroundColor(RMTheme.Colors.textSecondary)
        }
    }
}
