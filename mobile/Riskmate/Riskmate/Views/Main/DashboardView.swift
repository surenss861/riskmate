import SwiftUI
import Charts

/// Dashboard with KPIs, charts, and recent activity
struct DashboardView: View {
    @StateObject private var sessionManager = SessionManager.shared
    @State private var isLoading = true
    @State private var kpis: DashboardKPIs?
    @State private var chartData: [ChartDataPoint] = []
    @State private var recentActivity: [AuditEvent] = []
    
    var body: some View {
        RMBackground()
            .overlay {
                ScrollView(showsIndicators: false) {
                    VStack(spacing: RMTheme.Spacing.lg) {
                        // Header
                        VStack(alignment: .leading, spacing: RMTheme.Spacing.xs) {
                            Text("Dashboard")
                                .font(RMTheme.Typography.largeTitle)
                                .foregroundColor(RMTheme.Colors.textPrimary)
                            
                            Text("Overview of your compliance status")
                                .font(RMTheme.Typography.bodySmall)
                                .foregroundColor(RMTheme.Colors.textSecondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, RMTheme.Spacing.md)
                        .padding(.top, RMTheme.Spacing.md)
                        
                        if isLoading {
                            ProgressView()
                                .tint(RMTheme.Colors.accent)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, RMTheme.Spacing.xxl)
                        } else if let kpis = kpis {
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
                                    
                                    RMKpiCard(
                                        title: "Open Risks",
                                        value: "\(kpis.openRisks)",
                                        trend: kpis.risksTrend,
                                        icon: "exclamationmark.triangle.fill",
                                        color: RMTheme.Colors.error
                                    )
                                    
                                    RMKpiCard(
                                        title: "Jobs This Week",
                                        value: "\(kpis.jobsThisWeek)",
                                        trend: kpis.jobsTrend,
                                        icon: "briefcase.fill",
                                        color: RMTheme.Colors.accent
                                    )
                                }
                                .padding(.horizontal, RMTheme.Spacing.md)
                            }
                            
                            // Chart Card
                            if !chartData.isEmpty {
                                RMChartCard(data: chartData)
                                    .padding(.horizontal, RMTheme.Spacing.md)
                            }
                            
                            // Recent Activity
                            if !recentActivity.isEmpty {
                                VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                                    HStack {
                                        Text("Recent Activity")
                                            .font(RMTheme.Typography.title3)
                                            .foregroundColor(RMTheme.Colors.textPrimary)
                                        
                                        Spacer()
                                        
                                        Button("View All") {
                                            // Navigate to full audit feed
                                        }
                                        .font(RMTheme.Typography.bodySmallBold)
                                        .foregroundColor(RMTheme.Colors.accent)
                                    }
                                    .padding(.horizontal, RMTheme.Spacing.md)
                                    
                                    VStack(spacing: RMTheme.Spacing.sm) {
                                        ForEach(recentActivity.prefix(5)) { event in
                                            RMActivityRow(event: event)
                                        }
                                    }
                                    .padding(.horizontal, RMTheme.Spacing.md)
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
            .task {
                await loadDashboardData()
            }
            .refreshable {
                await loadDashboardData()
            }
    }
    
    private func loadDashboardData() async {
        isLoading = true
        defer { isLoading = false }
        
        // TODO: Replace with real API calls
        try? await Task.sleep(nanoseconds: 500_000_000) // Simulate loading
        
        // Mock data for now
        kpis = DashboardKPIs(
            complianceScore: 87,
            complianceTrend: .up(5),
            openRisks: 12,
            risksTrend: .down(3),
            jobsThisWeek: 24,
            jobsTrend: .up(8)
        )
        
        chartData = generateMockChartData()
        recentActivity = generateMockActivity()
    }
    
    private func generateMockChartData() -> [ChartDataPoint] {
        let calendar = Calendar.current
        let now = Date()
        return (0..<7).map { daysAgo in
            let date = calendar.date(byAdding: .day, value: -daysAgo, to: now) ?? now
            return ChartDataPoint(
                date: date,
                value: Double.random(in: 70...95)
            )
        }.reversed()
    }
    
    private func generateMockActivity() -> [AuditEvent] {
        // Mock audit events
        return []
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

struct ChartDataPoint: Identifiable {
    let id = UUID()
    let date: Date
    let value: Double
}

struct AuditEvent: Identifiable {
    let id: String
    let category: String
    let summary: String
    let timestamp: Date
}

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

// MARK: - Chart Card Component

struct RMChartCard: View {
    let data: [ChartDataPoint]
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                Text("Compliance Trend")
                    .font(RMTheme.Typography.title3)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                
                Chart(data) { point in
                    LineMark(
                        x: .value("Date", point.date, unit: .day),
                        y: .value("Score", point.value)
                    )
                    .foregroundStyle(
                        LinearGradient(
                            colors: [
                                RMTheme.Colors.accent.opacity(0.8),
                                RMTheme.Colors.accent.opacity(0.2)
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .interpolationMethod(.catmullRom)
                    .lineStyle(StrokeStyle(lineWidth: 3))
                    
                    AreaMark(
                        x: .value("Date", point.date, unit: .day),
                        y: .value("Score", point.value)
                    )
                    .foregroundStyle(
                        LinearGradient(
                            colors: [
                                RMTheme.Colors.accent.opacity(0.15),
                                RMTheme.Colors.accent.opacity(0.0)
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .interpolationMethod(.catmullRom)
                }
                .frame(height: 160)
                .chartXAxis(.hidden)
                .chartYAxis(.hidden)
            }
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
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

// MARK: - Empty State Component

struct RMEmptyState: View {
    let icon: String
    let title: String
    let message: String
    
    var body: some View {
        VStack(spacing: RMTheme.Spacing.md) {
            Image(systemName: icon)
                .font(.system(size: 48, weight: .light))
                .foregroundColor(RMTheme.Colors.textTertiary)
            
            Text(title)
                .font(RMTheme.Typography.title3)
                .foregroundColor(RMTheme.Colors.textPrimary)
            
            Text(message)
                .font(RMTheme.Typography.bodySmall)
                .foregroundColor(RMTheme.Colors.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(RMTheme.Spacing.xl)
    }
}

#Preview {
    DashboardView()
}
