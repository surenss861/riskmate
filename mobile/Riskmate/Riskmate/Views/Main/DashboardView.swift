import SwiftUI
import Charts
import SwiftDate

/// Dashboard with KPIs, charts, and recent activity
struct DashboardView: View {
    @StateObject private var sessionManager = SessionManager.shared
    @StateObject private var viewModel = DashboardViewModel()
    
    var body: some View {
        RMBackground()
            .overlay {
                ScrollView(showsIndicators: false) {
                    RMOfflineBanner()
                    VStack(spacing: RMTheme.Spacing.lg) {
                        // Setup Checklist (if not dismissed)
                        SetupChecklistView(isDismissed: .constant(UserDefaults.standard.bool(forKey: "setup_checklist_dismissed")))
                        
                        // Subtitle (navigationTitle handles main title)
                        Text("Overview of your compliance status")
                            .font(RMTheme.Typography.bodySmall)
                            .foregroundColor(RMTheme.Colors.textSecondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, RMTheme.Spacing.pagePadding)
                            .padding(.top, RMTheme.Spacing.sm)
                        
                        if viewModel.isLoading {
                            // Premium skeleton loading
                            VStack(spacing: RMTheme.Spacing.lg) {
                                RMSkeletonKPIGrid()
                                
                                RMSkeletonCard()
                                    .frame(height: 200)
                                
                                RMSkeletonList(count: 3)
                            }
                        } else if let errorMessage = viewModel.errorMessage {
                            // Error state - show error with retry
                            RMEmptyState(
                                icon: "exclamationmark.triangle.fill",
                                title: "Failed to Load Dashboard",
                                message: errorMessage,
                                action: RMEmptyStateAction(
                                    title: "Retry",
                                    action: {
                                        viewModel.load()
                                    }
                                )
                            )
                            .padding(.vertical, RMTheme.Spacing.xxl)
                        } else if let kpis = viewModel.kpis {
                            // KPI Cards
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: RMTheme.Spacing.md) {
                                    RMKpiCard(
                                        title: "Compliance",
                                        value: "\(kpis.complianceScore)%",
                                        trend: kpis.complianceTrend,
                                        icon: "checkmark.shield.fill",
                                        color: RMTheme.Colors.categoryGovernance
                                    )
                                    .accessibilityLabel("Compliance: \(kpis.complianceScore) percent")
                                    
                                    RMKpiCard(
                                        title: "Open Risks",
                                        value: "\(kpis.openRisks)",
                                        trend: kpis.risksTrend,
                                        icon: "exclamationmark.triangle.fill",
                                        color: RMTheme.Colors.error
                                    )
                                    .accessibilityLabel("Open risks: \(kpis.openRisks)")
                                    
                                    RMKpiCard(
                                        title: "Jobs This Week",
                                        value: "\(kpis.jobsThisWeek)",
                                        trend: kpis.jobsTrend,
                                        icon: "briefcase.fill",
                                        color: RMTheme.Colors.accent
                                    )
                                    .accessibilityLabel("Jobs this week: \(kpis.jobsThisWeek)")
                                }
                                .padding(.horizontal, RMTheme.Spacing.pagePadding)
                            }
                            
                            // Chart Card
                            if !viewModel.chartData.isEmpty {
                                RMChartCard(data: viewModel.chartData)
                                    .padding(.horizontal, RMTheme.Spacing.pagePadding)
                            }
                            
                            // Top Hazards Section (using ViewModel data)
                            TopHazardsSection(hazards: viewModel.topHazards)
                                .padding(.horizontal, RMTheme.Spacing.pagePadding)
                            
                            // Jobs at Risk Section (using ViewModel data)
                            JobsAtRiskSection(jobs: viewModel.jobsAtRisk)
                                .padding(.horizontal, RMTheme.Spacing.pagePadding)
                            
                            // Missing Evidence CTA
                            MissingEvidenceCTACard()
                                .padding(.horizontal, RMTheme.Spacing.pagePadding)
                            
                            // Recent Activity
                            if !recentActivity.isEmpty {
                                VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                                    HStack {
                                        Text("Recent Activity")
                                            .font(RMTheme.Typography.title3)
                                            .foregroundColor(RMTheme.Colors.textPrimary)
                                        
                                        Spacer()
                                        
                                        Button {
                                            let generator = UIImpactFeedbackGenerator(style: .light)
                                            generator.impactOccurred()
                                            // Navigate to full audit feed
                                        } label: {
                                            Text("View All")
                                                .font(RMTheme.Typography.bodySmallBold)
                                                .foregroundColor(RMTheme.Colors.accent)
                                        }
                                    }
                                    .padding(.horizontal, RMTheme.Spacing.pagePadding)
                                    
                                    VStack(spacing: RMTheme.Spacing.sm) {
                                        ForEach(viewModel.recentActivity.prefix(5)) { event in
                                            RMActivityRow(event: event)
                                        }
                                    }
                                    .padding(.horizontal, RMTheme.Spacing.pagePadding)
                                }
                            } else {
                                RMEmptyState(
                                    icon: "tray",
                                    title: "No Recent Activity",
                                    message: "Activity will appear here as events occur"
                                )
                                .padding(.vertical, RMTheme.Spacing.xxl)
                            }
                        } else {
                            RMEmptyState(
                                icon: "chart.line.uptrend.xyaxis",
                                title: "No Data Available",
                                message: "Complete your first job to see dashboard metrics"
                            )
                            .padding(.vertical, RMTheme.Spacing.xxl)
                        }
                    }
                    .padding(.bottom, RMTheme.Spacing.xl)
                }
            }
            .rmNavigationBar(title: "Dashboard")
            .syncStatusChip()
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        let generator = UIImpactFeedbackGenerator(style: .light)
                        generator.impactOccurred()
                        // TODO: Add filter/export action
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .foregroundColor(RMTheme.Colors.textSecondary)
                    }
                }
            }
            .task {
                viewModel.load()
            }
            .refreshable {
                viewModel.load()
            }
            .onDisappear {
                viewModel.cancel()
            }
    }
    
    private func generateChartDataFromJobs(_ jobs: [Job]) -> [ChartDataPoint] {
        let calendar = Calendar.current
        let now = Date()
        var dataByDate: [Date: [Job]] = [:]
        
        // Group jobs by date
        for job in jobs {
            if let createdAt = ISO8601DateFormatter().date(from: job.createdAt) {
                let dayStart = calendar.startOfDay(for: createdAt)
                if dataByDate[dayStart] == nil {
                    dataByDate[dayStart] = []
                }
                dataByDate[dayStart]?.append(job)
            }
        }
        
        // Generate last 7 days
        return (0..<7).map { daysAgo in
            let date = calendar.date(byAdding: .day, value: -daysAgo, to: now) ?? now
            let dayStart = calendar.startOfDay(for: date)
            let jobsForDay = dataByDate[dayStart] ?? []
            
            // Calculate compliance for this day (completed / total)
            let completed = jobsForDay.filter { $0.status.lowercased() == "completed" }
            let compliance = jobsForDay.isEmpty ? 0.0 : (Double(completed.count) / Double(jobsForDay.count)) * 100.0
            
            return ChartDataPoint(date: date, value: compliance)
        }.reversed()
    }
}

// MARK: - Data Models

struct DashboardKPIs {
    let complianceScore: Int
    let complianceTrend: Trend
    let openRisks: Int
    let risksTrend: Trend
    let jobsThisWeek: Int
    let jobsTrend: Trend
}

enum Trend {
    case up(Int)
    case down(Int)
    case neutral
}

// AuditEvent is defined in OfflineCache.swift

// MARK: - KPI Card Component

struct RMKpiCard: View {
    let title: String
    let value: String
    let trend: Trend
    let icon: String
    let color: Color
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                HStack {
                    Image(systemName: icon)
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundColor(color)
                    
                    Spacer()
                    
                    trendIndicator
                }
                
                Text(value)
                    .font(RMTheme.Typography.title)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                
                Text(title)
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(RMTheme.Colors.textSecondary)
            }
        }
        .frame(width: 160)
    }
    
    @ViewBuilder
    private var trendIndicator: some View {
        switch trend {
        case .up(let amount):
            HStack(spacing: 4) {
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 10, weight: .bold))
                Text("\(amount)")
                    .font(RMTheme.Typography.captionSmall)
            }
            .foregroundColor(RMTheme.Colors.success)
        case .down(let amount):
            HStack(spacing: 4) {
                Image(systemName: "arrow.down.right")
                    .font(.system(size: 10, weight: .bold))
                Text("\(amount)")
                    .font(RMTheme.Typography.captionSmall)
            }
            .foregroundColor(RMTheme.Colors.error)
        case .neutral:
            EmptyView()
        }
    }
}

// MARK: - Activity Row Component

struct RMActivityRow: View {
    let event: AuditEvent
    
    var body: some View {
        HStack(spacing: RMTheme.Spacing.md) {
            // Category pill
            Text(event.category.prefix(3).uppercased())
                .font(RMTheme.Typography.captionBold)
                .foregroundColor(.white)
                .padding(.horizontal, RMTheme.Spacing.sm)
                .padding(.vertical, RMTheme.Spacing.xs)
                .background(categoryColor(event.category))
                .clipShape(Capsule())
            
            // Summary
            Text(event.summary)
                .font(RMTheme.Typography.bodySmall)
                .foregroundColor(RMTheme.Colors.textPrimary)
                .lineLimit(1)
            
            Spacer()
            
            // Time
            Text(relativeTime(event.timestamp))
                .font(RMTheme.Typography.caption)
                .foregroundColor(RMTheme.Colors.textTertiary)
        }
        .padding(.vertical, RMTheme.Spacing.sm)
        .padding(.horizontal, RMTheme.Spacing.md)
        .background(RMTheme.Colors.inputFill)
        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
    }
    
    private func categoryColor(_ category: String) -> Color {
        switch category.lowercased() {
        case "access": return RMTheme.Colors.categoryAccess
        case "operations", "ops": return RMTheme.Colors.categoryOperations
        case "governance", "gov": return RMTheme.Colors.categoryGovernance
        default: return RMTheme.Colors.textTertiary
        }
    }
    
    private func relativeTime(_ date: Date) -> String {
        return date.toRelative(since: nil, dateTimeStyle: .named, unitsStyle: .short)
    }
}

// MARK: - Dashboard Sections

struct TopHazardsSection: View {
    let hazards: [Hazard]  // Pass hazards from ViewModel
    
    var body: some View {
        VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
            HStack {
                Text("Top Hazards (Last 30d)")
                    .rmSectionHeader()
                Spacer()
            }
            
            if hazards.isEmpty {
                Text("No hazards recorded")
                    .rmSecondary()
                    .padding(.vertical, RMTheme.Spacing.sm)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: RMTheme.Spacing.sm) {
                        ForEach(hazards) { hazard in
                            HazardPillView(hazard: HazardPill(id: hazard.id, code: hazard.code, count: 1))
                        }
                    }
                }
            }
        }
    }
}

struct HazardPill: Identifiable {
    let id: String
    let code: String
    let count: Int
}

struct HazardPillView: View {
    let hazard: HazardPill
    
    var body: some View {
        HStack(spacing: RMTheme.Spacing.xs) {
            Text(hazard.code)
                .font(RMTheme.Typography.captionBold)
                .foregroundColor(.white)
            
            Text("\(hazard.count)")
                .font(RMTheme.Typography.caption)
                .foregroundColor(RMTheme.Colors.textSecondary)
                .padding(.horizontal, RMTheme.Spacing.xs)
                .padding(.vertical, 2)
                .background(RMTheme.Colors.textTertiary.opacity(0.3))
                .clipShape(Capsule())
        }
        .padding(.horizontal, RMTheme.Spacing.sm)
        .padding(.vertical, RMTheme.Spacing.xs)
        .background(RMTheme.Colors.categoryOperations.opacity(0.2))
        .overlay {
            RoundedRectangle(cornerRadius: RMTheme.Radius.sm)
                .stroke(RMTheme.Colors.categoryOperations.opacity(0.4), lineWidth: 1)
        }
        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
    }
}

struct JobsAtRiskSection: View {
    let jobs: [Job]  // Pass jobs from ViewModel
    
    var body: some View {
        VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
            HStack {
                Text("Jobs at Risk")
                    .rmSectionHeader()
                Spacer()
                if !jobs.isEmpty {
                    Button {
                        // TODO: Navigate to filtered jobs list
                    } label: {
                        Text("View All")
                            .font(RMTheme.Typography.bodySmallBold)
                            .foregroundColor(RMTheme.Colors.accent)
                    }
                }
            }
            
            if jobs.isEmpty {
                Text("No high-risk jobs")
                    .rmSecondary()
                    .padding(.vertical, RMTheme.Spacing.sm)
            } else {
                VStack(spacing: RMTheme.Spacing.sm) {
                    ForEach(jobs.prefix(3)) { job in
                        AtRiskJobRow(job: AtRiskJob(
                            id: job.id,
                            title: job.clientName,
                            riskScore: job.riskScore ?? 75,
                            status: job.status
                        ))
                    }
                }
            }
        }
    }
}

struct AtRiskJob: Identifiable {
    let id: String
    let title: String
    let riskScore: Int
    let status: String
}

struct AtRiskJobRow: View {
    let job: AtRiskJob
    
    var body: some View {
        HStack(spacing: RMTheme.Spacing.md) {
            // Risk indicator
            Circle()
                .fill(riskColor)
                .frame(width: 8, height: 8)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(job.title)
                    .font(RMTheme.Typography.bodySmallBold)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                
                Text("Risk: \(job.riskScore) • \(job.status)")
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(RMTheme.Colors.textSecondary)
            }
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(RMTheme.Colors.textTertiary)
        }
        .padding(RMTheme.Spacing.md)
        .background(RMTheme.Colors.inputFill)
        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
    }
    
    private var riskColor: Color {
        if job.riskScore >= 90 { return RMTheme.Colors.error }
        if job.riskScore >= 70 { return RMTheme.Colors.warning }
        return RMTheme.Colors.success
    }
}

struct MissingEvidenceCTACard: View {
    @State private var missingEvidenceCount: Int = 0
    @State private var isLoading = true
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundColor(RMTheme.Colors.warning)
                    
                    Spacer()
                }
                
                Text("Missing Evidence")
                    .font(RMTheme.Typography.title3)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                
                if isLoading {
                    Text("Loading...")
                        .font(RMTheme.Typography.bodySmall)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                } else if missingEvidenceCount > 0 {
                    Text("\(missingEvidenceCount) job\(missingEvidenceCount == 1 ? "" : "s") need evidence uploads to complete readiness")
                        .font(RMTheme.Typography.bodySmall)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                } else {
                    Text("All jobs have required evidence")
                        .font(RMTheme.Typography.bodySmall)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                }
                
                Button {
                    // TODO: Navigate to Readiness view
                } label: {
                    Text("Review Readiness")
                        .font(RMTheme.Typography.bodySmallBold)
                        .foregroundColor(.black)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, RMTheme.Spacing.sm)
                        .background(RMTheme.Colors.accent)
                        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
                }
            }
        }
        .task {
            await loadMissingEvidenceCount()
        }
    }
    
    private func loadMissingEvidenceCount() async {
        // Load jobs and check for missing evidence
        // TODO: Replace with dedicated /api/dashboard/missing-evidence endpoint when available
        do {
            let jobsResponse = try await APIClient.shared.getJobs(page: 1, limit: 100)
            let allJobs = jobsResponse.data
            
            var count = 0
            for job in allJobs {
                let evidence = try? await APIClient.shared.getEvidence(jobId: job.id)
                // Assume jobs need at least 3 evidence items (this should come from job requirements)
                if (evidence?.count ?? 0) < 3 {
                    count += 1
                }
            }
            
            missingEvidenceCount = count
            isLoading = false
        } catch {
            print("[MissingEvidenceCTACard] ❌ Failed to load missing evidence count: \(error.localizedDescription)")
            // Show 0 - no demo data
            missingEvidenceCount = 0
            isLoading = false
        }
    }
}

#Preview {
    DashboardView()
}
