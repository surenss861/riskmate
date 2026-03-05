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
    @State private var showExportProofSheet = false
    @State private var exportProofJobId: String? = nil
    @State private var showJobPickerSheet = false
    
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
    
    var blockerCount: Int {
        filteredJobs.filter { job in (job.riskScore ?? 0) >= 80 }.count
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
    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 13, weight: .semibold))
            .foregroundColor(RMTheme.Colors.textSecondary)
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
        
        Section {
            OperationsTodayPanel(
                blockerCount: blockerCount,
                highRiskCount: highRiskJobs.count,
                overdueTasksCount: 0,
                lastUpdated: jobsStore.lastSyncDate,
                onTapBlockers: { onKPINavigate?("blockers") },
                onTapHighRisk: { onKPINavigate?("highRisk") }
            )
            .listRowInsets(EdgeInsets(top: RMTheme.Spacing.sm, leading: RMTheme.Spacing.pagePadding, bottom: RMTheme.Spacing.sm, trailing: RMTheme.Spacing.pagePadding))
            .listRowBackground(Color.clear)
        } header: {
            sectionHeader("Today")
        }
        .listSectionSpacing(6)

        Section {
            QuickActionsStrip(
                onAddEvidence: { Haptics.tap(); quickAction.presentEvidence(jobId: nil) },
                onCreateJob: { Haptics.tap(); quickAction.requestSwitchToWorkRecords(filter: nil) },
                onExport: { Haptics.tap(); quickAction.requestSwitchToLedger() }
            )
            .listRowInsets(EdgeInsets(top: 6, leading: RMTheme.Spacing.pagePadding, bottom: 6, trailing: RMTheme.Spacing.pagePadding))
            .listRowBackground(Color.clear)
        } header: {
            sectionHeader("Quick actions")
        }
        .listSectionSpacing(6)

        Section {
            OpenIssuesPlaceholder(onCreateJob: { Haptics.tap(); quickAction.requestSwitchToWorkRecords(filter: nil) })
                .listRowInsets(EdgeInsets(top: RMTheme.Spacing.sm, leading: RMTheme.Spacing.pagePadding, bottom: RMTheme.Spacing.sm, trailing: RMTheme.Spacing.pagePadding))
                .listRowBackground(Color.clear)
        } header: {
            sectionHeader("This week")
        }
        .listSectionSpacing(6)

        Section {
            RecentActivityRow(hasActivity: false)
                .listRowInsets(EdgeInsets(top: RMTheme.Spacing.sm, leading: RMTheme.Spacing.pagePadding, bottom: RMTheme.Spacing.sm, trailing: RMTheme.Spacing.pagePadding))
                .listRowBackground(Color.clear)
        } header: {
            sectionHeader("Recent activity")
        }
        .listSectionSpacing(6)

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
                        onViewLedger: { quickAction.requestSwitchToLedger() },
                        onExportProof: {
                            exportProofJobId = job.id
                            showExportProofSheet = true
                        }
                    )
                }
            } header: {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Jobs")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    OperationsHeaderView(
                    activeCount: activeJobs.count,
                    highRiskCount: highRiskJobs.count,
                    missingEvidenceCount: missingEvidenceJobs.count,
                    lastSync: jobsStore.lastSyncDate,
                    onKPITap: handleKPITap
                )
                }
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
                    jobsEmpty: jobsStore.jobs.isEmpty
                )
            } header: {
                Text("Jobs")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(RMTheme.Colors.textPrimary)
            }
        }
    }

    private var fieldOperationsContent: some View {
        List {
            operationsListSections
        }
        .listStyle(.insetGrouped)
        .listSectionSpacing(6)
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
                FloatingEvidenceFAB(
                    action: { showJobPickerSheet = true },
                    onTask: { quickAction.requestSwitchToWorkRecords(filter: nil) },
                    onComment: { quickAction.requestSwitchToWorkRecords(filter: nil) },
                    onIncident: { quickAction.requestSwitchToWorkRecords(filter: nil) }
                )
                .padding(RMSystemTheme.Spacing.lg)
            }
        }
        .sheet(isPresented: $showJobPickerSheet) {
            JobPickerSheet(jobs: activeJobs, onSelect: { job in
                showJobPickerSheet = false
                quickAction.presentEvidence(jobId: job.id)
            }, onCancel: {
                showJobPickerSheet = false
            })
            .presentationDetents([.medium])
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
            // System nav bar hidden so RMTopBar is the only top chrome (avoids double bar).
            .toolbar(.hidden, for: .navigationBar)
            .safeAreaInset(edge: .top, spacing: 0) {
                RMTopBar(title: "Operations", notificationBadge: 0)
            }
            .task {
                // Refresh entitlements on view load
                await entitlements.refresh()
            }
            .refreshable {
                // Refresh both jobs and entitlements on pull-to-refresh
                _ = try? await jobsStore.fetch(forceRefresh: true)
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
                if entitlements.entitlements?.role.lowercased() == "executive" && selectedView == .dashboard {
                    selectedView = .defensibility
                }
                if entitlements.entitlements?.role.lowercased() != "executive" {
                    UserDefaultsManager.CoachMarks.incrementOperationsVisitCount()
                }
            }
            .sheet(isPresented: $showExportProofSheet, onDismiss: { exportProofJobId = nil }) {
                if let id = exportProofJobId {
                    ExportProofSheet(jobId: id, isPresented: $showExportProofSheet)
                }
            }
    }
}

// MARK: - Operations helpers (split out to avoid type-checker timeout)

private struct QuickActionsStrip: View {
    var onAddEvidence: () -> Void
    var onCreateJob: () -> Void
    var onExport: () -> Void

    var body: some View {
        HStack(spacing: 6) {
            QuickActionChip(title: "Add Evidence", icon: "camera.fill", action: onAddEvidence)
            QuickActionChip(title: "Create Job", icon: "doc.badge.plus", action: onCreateJob)
            QuickActionChip(title: "Export", icon: "square.and.arrow.up", action: onExport)
        }
    }
}

private struct QuickActionChip: View {
    let title: String
    let icon: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 12, weight: .medium))
                Text(title)
                    .font(.system(size: 12, weight: .medium))
            }
            .foregroundColor(RMTheme.Colors.textPrimary)
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .frame(height: 32)
            .background(.ultraThinMaterial, in: Capsule())
            .overlay(Capsule().stroke(Color.white.opacity(0.06), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

private struct OpenIssuesPlaceholder: View {
    var onCreateJob: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            HStack(spacing: 10) {
                Image(systemName: "exclamationmark.circle")
                    .font(.system(size: 18))
                    .foregroundColor(RMTheme.Colors.textTertiary)
                Text("Open issues")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(RMTheme.Colors.textPrimary)
                Spacer(minLength: 0)
            }
            Text("No open issues this week. Add evidence or create a job to stay on track.")
                .font(.system(size: 13))
                .foregroundColor(RMTheme.Colors.textTertiary)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button(action: onCreateJob) {
                Text("Create your first job")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(RMTheme.Colors.accent)
            }
            .frame(maxWidth: .infinity)
        }
        .padding(.vertical, 4)
    }
}

private struct RecentActivityRow: View {
    var hasActivity: Bool

    var body: some View {
        HStack(spacing: RMTheme.Spacing.md) {
            Image(systemName: "clock.arrow.circlepath")
                .font(.system(size: 18))
                .foregroundColor(RMTheme.Colors.textTertiary)
            if hasActivity {
                Text("Recent activity items will appear here")
                    .font(.system(size: 15, weight: .regular))
                    .foregroundColor(RMTheme.Colors.textSecondary)
            } else {
                VStack(alignment: .leading, spacing: 2) {
                    Text("No recent activity yet")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    Text("Evidence, comments, and updates will show here")
                        .font(.system(size: 13))
                        .foregroundColor(RMTheme.Colors.textTertiary)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 4)
    }
}

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

    var body: some View {
        VStack(spacing: RMSystemTheme.Spacing.lg) {
            RMEmptyState(
                icon: searchQuery.isEmpty ? "briefcase" : "magnifyingglass",
                title: searchQuery.isEmpty ? "No active jobs yet" : "No Results",
                message: searchQuery.isEmpty
                    ? "Job creation is available on the web app. Use the Ledger and Work Records tabs to view and add evidence to existing jobs."
                    : "Try adjusting your search or filters. No jobs match your criteria.",
                action: nil
            )
            if searchQuery.isEmpty && jobsEmpty {
                VStack(spacing: RMSystemTheme.Spacing.md) {
                    // Open Web App link button
                    Button {
                        Haptics.tap()
                        WebAppURL.openWebApp()
                    } label: {
                        Label("Open Web App", systemImage: "globe")
                            .font(RMSystemTheme.Typography.bodyBold)
                            .foregroundStyle(RMSystemTheme.Colors.accent)
                    }
                    
                    Divider()
                        .background(RMSystemTheme.Colors.separator.opacity(0.3))
                    Text("Riskmate creates permanent proof so compliance is never questioned.")
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

/// Mini sheet to pick a job for evidence capture (shown when FAB is tapped from list)
private struct JobPickerSheet: View {
    let jobs: [Job]
    let onSelect: (Job) -> Void
    let onCancel: () -> Void
    
    var body: some View {
        NavigationStack {
            List {
                if jobs.isEmpty {
                    Text("No active jobs available.")
                        .font(RMSystemTheme.Typography.body)
                        .foregroundStyle(RMSystemTheme.Colors.textSecondary)
                        .listRowBackground(Color.clear)
                } else {
                    ForEach(jobs) { job in
                        Button {
                            Haptics.tap()
                            onSelect(job)
                        } label: {
                            HStack(spacing: RMSystemTheme.Spacing.md) {
                                Circle()
                                    .fill(riskColor(for: job))
                                    .frame(width: 8, height: 8)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(job.clientName.isEmpty ? "Untitled Job" : job.clientName)
                                        .font(RMSystemTheme.Typography.headline)
                                        .foregroundStyle(RMSystemTheme.Colors.textPrimary)
                                    Text(job.location)
                                        .font(RMSystemTheme.Typography.subheadline)
                                        .foregroundStyle(RMSystemTheme.Colors.textSecondary)
                                }
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundStyle(RMSystemTheme.Colors.textTertiary)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Pick a Job")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        Haptics.tap()
                        onCancel()
                    }
                }
            }
        }
    }
    
    private func riskColor(for job: Job) -> Color {
        let level = (job.riskLevel ?? "").lowercased()
        if level.contains("critical") { return RMSystemTheme.Colors.critical }
        if level.contains("high") { return RMSystemTheme.Colors.high }
        if level.contains("medium") { return RMSystemTheme.Colors.medium }
        return RMSystemTheme.Colors.low
    }
}

#Preview {
    OperationsView()
        .environmentObject(QuickActionRouter.shared)
}
