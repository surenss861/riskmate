import SwiftUI
import SwiftDate

/// Jobs List View with search, filters, and premium interactions
struct JobsListView: View {
    let initialFilter: String?
    
    @StateObject private var jobsStore = JobsStore.shared
    @StateObject private var entitlements = EntitlementsManager.shared
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
        selectedStatus != "all" || selectedRiskLevel != "all" || !searchText.isEmpty
    }
    
    var filteredJobs: [Job] {
        var filtered = jobs
        
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
    
    var body: some View {
        RMBackground()
            .overlay {
                VStack(spacing: 0) {
                    RMOfflineBanner()
                    // Sticky Filter Bar
                    RMStickyFilterBar {
                        VStack(spacing: RMTheme.Spacing.sm) {
                            // Search Bar
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
                            .padding(RMTheme.Spacing.md)
                            .background(RMTheme.Colors.inputFill)
                            .cornerRadius(RMTheme.Radius.sm)
                            .overlay {
                                RoundedRectangle(cornerRadius: RMTheme.Radius.sm)
                                    .stroke(isSearchFocused ? RMTheme.Colors.inputStrokeFocused : RMTheme.Colors.inputStroke, lineWidth: 1)
                            }
                            
                            // Filter Pills
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: RMTheme.Spacing.sm) {
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
                    }
                    
                    // Jobs List
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
                                ) : nil
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
                                }
                                .padding(.top, RMTheme.Spacing.md)
                            }
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .padding(RMSystemTheme.Spacing.xl)
                    } else {
                        List {
                            Section {
                            ForEach(filteredJobs) { job in
                                NavigationLink(value: job) {
                                    JobCard(job: job, isOffline: jobsStore.pendingJobIds.contains(job.id)) {
                                        // Navigation handled by NavigationLink
                                    }
                                }
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
                                    Button {
                                        Haptics.success()
                                        copyJobId(job.id)
                                    } label: {
                                        Label("Copy ID", systemImage: "doc.on.doc")
                                    }
                                    .tint(RMTheme.Colors.accent)
                                    
                                    Button {
                                        Haptics.success()
                                        presentExportSheet(for: job)
                                    } label: {
                                        Label("Export", systemImage: "square.and.arrow.up")
                                    }
                                    .tint(RMTheme.Colors.categoryAccess)
                                }
                                .contextMenu {
                                    Button {
                                        Haptics.success()
                                        copyJobId(job.id)
                                    } label: {
                                        Label("Copy Job ID", systemImage: "doc.on.doc")
                                    }
                                    Button {
                                        Haptics.success()
                                        presentExportSheet(for: job)
                                    } label: {
                                        Label("Export PDF", systemImage: "square.and.arrow.up")
                                    }
                                }
                                .onAppear {
                                    // Load more when scrolling near bottom
                                    if job.id == filteredJobs.last?.id, jobsStore.hasMore, !jobsStore.isLoadingMore {
                                        Task {
                                            try? await jobsStore.loadMore()
                                        }
                                    }
                                }
                            }
                            } header: {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Proof Records")
                                        .font(.system(size: 15, weight: .semibold))
                                        .foregroundColor(RMTheme.Colors.textPrimary)
                                    Text("Not yet anchored")
                                        .font(RMTheme.Typography.caption)
                                        .foregroundColor(RMTheme.Colors.textTertiary)
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
                    }
                }
            }
            .rmNavigationBar(title: "Work Records")
            .syncStatusChip()
            .toolbar {
                if !isAuditor {
                    ToolbarItem(placement: .primaryAction) {
                        Button {
                            Haptics.tap()
                            showCreateJobSheet = true
                        } label: {
                            Image(systemName: "plus.circle.fill")
                                .foregroundColor(RMTheme.Colors.accent)
                        }
                        .accessibilityLabel("Create new job")
                    }
                }
            }
            .onAppear {
                // Apply initial filter if provided
                if let filter = initialFilter {
                    switch filter {
                    case "active":
                        selectedStatus = "active"
                    case "highRisk":
                        selectedRiskLevel = "high"
                    case "missingEvidence":
                        // TODO: Add missing evidence filter when backend supports it
                        selectedStatus = "active"
                    default:
                        break
                    }
                }
            }
            .task {
                // Load persisted filters
                let filters = FilterPersistence.loadJobsFilters()
                selectedStatus = filters.status
                selectedRiskLevel = filters.riskLevel
                
                // Fetch from store (cache-first: shows cached instantly, refreshes in background)
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
            .anchoringRefresh(isRefreshing: $isRefreshing) {
                _ = try? await jobsStore.fetch(forceRefresh: true)
            }
            .navigationDestination(for: Job.self) { job in
                JobDetailView(jobId: job.id)
            }
            .sheet(isPresented: $showExportProofSheet, onDismiss: { exportProofJobId = nil }) {
                if let id = exportProofJobId {
                    ExportProofSheet(jobId: id, isPresented: $showExportProofSheet)
                }
            }
            .sheet(isPresented: $showCreateJobSheet) {
                CreateJobSheet()
            }
    }
    
    private func presentExportSheet(for job: Job) {
        exportProofJobId = job.id
        showExportProofSheet = true
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
            .background(RMTheme.Colors.inputFill)
            .clipShape(Capsule())
            .overlay {
                Capsule()
                    .stroke(
                        value == "all" ? RMTheme.Colors.border : RMTheme.Colors.accent.opacity(0.6),
                        lineWidth: value == "all" ? 1 : 1.5
                    )
            }
            .shadow(
                color: value != "all" ? RMTheme.Colors.accent.opacity(0.3) : Color.clear,
                radius: value != "all" ? 6 : 0
            )
            .scaleEffect(value != "all" ? 1.02 : 1.0)
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
