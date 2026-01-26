import SwiftUI

/// Field Dashboard - Action-first operations hub for field users
struct OperationsView: View {
    @StateObject private var jobsStore = JobsStore.shared
    @StateObject private var serverStatus = ServerStatusManager.shared
    @StateObject private var entitlements = EntitlementsManager.shared
    @EnvironmentObject private var quickAction: QuickActionRouter
    @State private var selectedView: OperationsViewType = .dashboard
    @State private var searchQuery: String = ""
    @State private var isRefreshing = false
    @State private var showCriticalBanner: Bool = false
    @State private var criticalJob: Job? = nil
    
    private var isAuditor: Bool {
        entitlements.isAuditor()
    }
    
    private func relativeTime(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
    
    var filteredJobs: [Job] {
        if searchQuery.isEmpty {
            return jobsStore.jobs
        }
        return jobsStore.jobs.filter { job in
            job.clientName.localizedCaseInsensitiveContains(searchQuery) ||
            job.location.localizedCaseInsensitiveContains(searchQuery) ||
            job.jobType.localizedCaseInsensitiveContains(searchQuery)
        }
    }
    
    var activeJobs: [Job] {
        filteredJobs.filter { job in
            job.status.lowercased() != "completed" && job.status.lowercased() != "cancelled"
        }.prefix(6).map { $0 }
    }
    
    var highRiskJobs: [Job] {
        filteredJobs.filter { job in (job.riskScore ?? 0) >= 80 }
    }
    
    var missingEvidenceJobs: [Job] {
        // TODO: Wire to actual evidence check
        []
    }
    
    @Environment(\.dismiss) private var dismiss
    
    let onKPINavigate: ((String?) -> Void)?
    
    init(onKPINavigate: ((String?) -> Void)? = nil) {
        self.onKPINavigate = onKPINavigate
    }
    
    private func handleKPITap(_ type: KPIType) {
        Haptics.tap()
        
        // Navigate to Work Records with appropriate filter
        switch type {
        case .active:
            onKPINavigate?("active")
        case .highRisk:
            onKPINavigate?("highRisk")
        case .missingEvidence:
            onKPINavigate?("missingEvidence")
        }
    }
    
    private func checkForCriticalRisk() {
        // Find first critical risk job that hasn't shown banner
        if let criticalJob = activeJobs.first(where: { job in
            CriticalRiskBanner.shouldShow(for: job)
        }) {
            self.criticalJob = criticalJob
            showCriticalBanner = true
            CriticalRiskBannerManager.markBannerShown(for: criticalJob.id)
            Analytics.shared.trackCriticalBannerShown(jobId: criticalJob.id)
        }
    }

    private var executiveContent: some View {
        VStack(spacing: 0) {
            Picker("View", selection: $selectedView) {
                Text("Dashboard").tag(OperationsViewType.dashboard)
                Text("Defensibility").tag(OperationsViewType.defensibility)
            }
            .pickerStyle(.segmented)
            .padding(RMTheme.Spacing.pagePadding)

            Group {
                switch selectedView {
                case .dashboard:
                    DashboardView()
                case .defensibility:
                    ExecutiveViewRedesigned()
                }
            }
        }
    }

    @ViewBuilder
    private var operationsListSections: some View {
        if isAuditor {
            Section {
                ReadOnlyBanner()
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }
        }

        if jobsStore.isLoading && activeJobs.isEmpty {
            Section {
                OperationsLoadingSkeleton()
            } header: {
                Text("Active Jobs")
            }
        } else if !activeJobs.isEmpty {
            Section {
                ForEach(activeJobs) { job in
                    OperationsJobRow(
                        job: job,
                        isAuditor: isAuditor,
                        onAddEvidence: { quickAction.presentEvidence(jobId: job.id) },
                        onMarkComplete: {
                            ToastCenter.shared.show("Marked complete", systemImage: "checkmark.circle", style: .success)
                        },
                        onViewLedger: { print("[OperationsView] TODO: Navigate to Ledger for job \(job.id)") },
                        onExportProof: { print("[OperationsView] TODO: Export proof for job \(job.id)") }
                    )
                }
            } header: {
                OperationsHeaderView(
                    activeCount: activeJobs.count,
                    highRiskCount: highRiskJobs.count,
                    missingEvidenceCount: missingEvidenceJobs.count,
                    lastSync: jobsStore.lastSyncDate,
                    onKPITap: handleKPITap
                )
            } footer: {
                if activeJobs.count < filteredJobs.count {
                    Text("Showing \(activeJobs.count) of \(filteredJobs.count) jobs")
                        .font(RMSystemTheme.Typography.caption)
                        .foregroundStyle(RMSystemTheme.Colors.textTertiary)
                }
            }
        } else if !jobsStore.isLoading {
            Section {
                OperationsEmptySection(
                    searchQuery: searchQuery,
                    jobsEmpty: jobsStore.jobs.isEmpty,
                    onCreateJob: { print("[OperationsView] TODO: Navigate to Create Job") }
                )
            }
        }
    }

    private var fieldOperationsContent: some View {
        List {
            operationsListSections
        }
        .listStyle(.insetGrouped)
        .searchable(text: $searchQuery, prompt: "Search jobs")
        .anchoringRefresh(isRefreshing: $isRefreshing) {
            _ = try? await jobsStore.fetch(forceRefresh: true)
        }
        .scrollContentBackground(.hidden)
        .overlay(alignment: .top) {
            VStack(spacing: 0) {
                if showCriticalBanner, let job = criticalJob {
                    CriticalRiskBanner(
                        jobName: job.clientName.isEmpty ? "this job" : job.clientName,
                        onAddProof: {
                            Analytics.shared.trackCriticalBannerClicked(jobId: job.id)
                            quickAction.presentEvidence(jobId: job.id)
                        },
                        onDismiss: {
                            showCriticalBanner = false
                            criticalJob = nil
                        }
                    )
                }
                if !showCriticalBanner {
                    LongPressHint(onDismiss: {})
                }
            }
        }
        .overlay(alignment: .bottomTrailing) {
            if !isAuditor {
                FloatingEvidenceFAB {
                    quickAction.presentEvidence(jobId: nil)
                }
                .padding(RMSystemTheme.Spacing.lg)
            }
        }
    }

    var body: some View {
        RMBackground()
            .overlay {
                if entitlements.entitlements?.role.lowercased() == "executive" {
                    executiveContent
                } else {
                    fieldOperationsContent
                }
            }
            .rmNavigationBar(title: "Operations")
            .toolbar {
                if !isAuditor {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button {
                            Haptics.tap()
                            print("[OperationsView] TODO: Navigate to Create Job")
                        } label: {
                            Image(systemName: "plus")
                                .foregroundStyle(RMSystemTheme.Colors.accent)
                        }
                    }
                }
            }
            .task {
                // Refresh entitlements on view load
                await entitlements.refresh()
            }
            .refreshable {
                // Refresh both jobs and entitlements on pull-to-refresh
                await jobsStore.refresh()
                await entitlements.refresh(force: true)
            }
            .task {
                if jobsStore.jobs.isEmpty {
                    _ = try? await jobsStore.fetch(forceRefresh: false)
                }
                checkForCriticalRisk()
            }
            .onChange(of: jobsStore.jobs) { _, _ in
                checkForCriticalRisk()
            }
            .onAppear {
                if userRole == "executive" && selectedView == .dashboard {
                    selectedView = .defensibility
                }
            }
    }
}

// MARK: - Operations helpers (split out to avoid type-checker timeout)

private struct OperationsLoadingSkeleton: View {
    var body: some View {
        ForEach(0..<3, id: \.self) { _ in
            HStack(spacing: RMSystemTheme.Spacing.md) {
                Circle()
                    .fill(RMSystemTheme.Colors.tertiaryBackground)
                    .frame(width: 8, height: 8)
                VStack(alignment: .leading, spacing: 4) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(RMSystemTheme.Colors.tertiaryBackground)
                        .frame(height: 16)
                        .frame(maxWidth: 200)
                    RoundedRectangle(cornerRadius: 4)
                        .fill(RMSystemTheme.Colors.tertiaryBackground)
                        .frame(height: 12)
                        .frame(maxWidth: 150)
                }
                Spacer()
            }
            .padding(.vertical, 4)
        }
    }
}

private struct OperationsJobRow: View {
    let job: Job
    let isAuditor: Bool
    let onAddEvidence: () -> Void
    let onMarkComplete: () -> Void
    let onViewLedger: () -> Void
    let onExportProof: () -> Void
    @EnvironmentObject var quickAction: QuickActionRouter

    var body: some View {
        NavigationLink {
            JobDetailView(jobId: job.id)
                .onAppear { Haptics.tap() }
        } label: {
            JobRow(
                job: job,
                onAddEvidence: isAuditor ? nil : onAddEvidence,
                onMarkComplete: isAuditor ? nil : onMarkComplete
            )
        }
        .jobCardLongPressActions(
            job: job,
            onAddEvidence: isAuditor ? nil : onAddEvidence,
            onViewLedger: onViewLedger,
            onExportProof: onExportProof
        )
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            if !isAuditor {
                Button {
                    Haptics.tap()
                    quickAction.presentEvidence(jobId: job.id)
                } label: {
                    Label("Add Evidence", systemImage: "camera.fill")
                }
                .tint(RMSystemTheme.Colors.accent)
                Button {
                    Haptics.tap()
                    ToastCenter.shared.show("Marked complete", systemImage: "checkmark.circle", style: .success)
                } label: {
                    Label("Complete", systemImage: "checkmark.circle.fill")
                }
                .tint(RMSystemTheme.Colors.success)
            }
        }
    }
}

private struct OperationsEmptySection: View {
    let searchQuery: String
    let jobsEmpty: Bool
    let onCreateJob: () -> Void

    var body: some View {
        VStack(spacing: RMSystemTheme.Spacing.lg) {
            RMEmptyState(
                icon: searchQuery.isEmpty ? "briefcase" : "magnifyingglass",
                title: searchQuery.isEmpty ? "No active jobs yet" : "No Results",
                message: searchQuery.isEmpty
                    ? "Create your first job to begin compliance tracking. Every action is recorded as a ledger event."
                    : "Try adjusting your search or filters. No ledger events match your criteria.",
                action: searchQuery.isEmpty ? RMEmptyStateAction(title: "Create Job", action: onCreateJob) : nil
            )
            if searchQuery.isEmpty && jobsEmpty {
                VStack(spacing: RMSystemTheme.Spacing.sm) {
                    Divider()
                        .background(RMSystemTheme.Colors.separator.opacity(0.3))
                    Text("RiskMate creates permanent proof so compliance is never questioned.")
                        .font(RMSystemTheme.Typography.footnote)
                        .foregroundColor(RMSystemTheme.Colors.textTertiary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, RMSystemTheme.Spacing.md)
                }
                .padding(.top, RMSystemTheme.Spacing.md)
            }
        }
        .listRowInsets(EdgeInsets())
        .listRowBackground(Color.clear)
    }
}

enum OperationsViewType {
    case dashboard
    case defensibility
}


#Preview {
    OperationsView()
}
