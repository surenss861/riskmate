import Foundation
import SwiftUI
import Combine

/// ViewModel for Dashboard - consolidates all API calls to prevent cancellation errors
@MainActor
final class DashboardViewModel: ObservableObject {
    @Published var kpis: DashboardKPIs?
    @Published var chartData: [ChartDataPoint] = []
    @Published var recentActivity: [AuditEvent] = []
    @Published var topHazards: [Hazard] = []
    @Published var jobsAtRisk: [Job] = []
    @Published var missingEvidenceJobs: [Job] = []
    
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private var loadTask: Task<Void, Never>?
    private var hasLoadedOnce = false
    
    // Use shared JobsStore for single source of truth
    
    /// Load all dashboard data in parallel (single-flight with deduplication)
    func load() {
        // Skip if already loaded
        guard !hasLoadedOnce else { return }
        
        // If already loading, don't start another load (single-flight)
        if loadTask != nil { return }
        
        loadTask = Task {
            defer { loadTask = nil }
            
            isLoading = true
            errorMessage = nil
            defer { isLoading = false }
            
            do {
                // Try new aggregated dashboard endpoint first (eliminates N+1 queries)
                do {
                    let summary = try await APIClient.shared.getDashboardSummary()
                    let summaryData = summary.data
                    
                    // Convert API models to view models
                    kpis = DashboardKPIs(
                        complianceScore: summaryData.kpis.complianceScore,
                        complianceTrend: parseTrend(summaryData.kpis.complianceTrend),
                        openRisks: summaryData.kpis.openRisks,
                        risksTrend: parseTrend(summaryData.kpis.risksTrend),
                        jobsThisWeek: summaryData.kpis.jobsThisWeek,
                        jobsTrend: parseTrend(summaryData.kpis.jobsTrend)
                    )
                    
                    // Convert chart data (date strings to Date objects)
                    // ChartDataPoint is defined in RMChartCard.swift
                    chartData = summaryData.chartData.compactMap { point in
                        // Try parsing as ISO8601 date first
                        let formatter = ISO8601DateFormatter()
                        formatter.formatOptions = [.withFullDate]
                        if let date = formatter.date(from: point.date) {
                            return ChartDataPoint(date: date, value: Double(point.value))
                        }
                        // Fallback: try with time component
                        if let date = ISO8601DateFormatter().date(from: point.date + "T00:00:00Z") {
                            return ChartDataPoint(date: date, value: Double(point.value))
                        }
                        return nil
                    }
                    
                    jobsAtRisk = summaryData.jobsAtRisk
                    missingEvidenceJobs = summaryData.missingEvidenceJobs
                    
                    // Load remaining data in parallel
                    async let activityTask = loadRecentActivity()
                    async let hazardsTask = loadTopHazards()
                    
                    recentActivity = try await activityTask
                    topHazards = try await hazardsTask
                    
                    hasLoadedOnce = true
                    return
                } catch {
                    // Fallback to old fan-out approach if dashboard endpoint doesn't exist (backwards compatibility)
                    print("[DashboardViewModel] ⚠️ Dashboard summary endpoint failed, falling back to fan-out: \(error.localizedDescription)")
                    
                    // Load jobs ONCE and cache for all dashboard calculations
                    let allJobs = try await loadJobsOnce()
                    
                    // Load all data in parallel using cached jobs
                    async let kpisTask = Task { @MainActor in loadKPIs(jobs: allJobs) }.value
                    async let chartTask = Task { @MainActor in loadChartData(jobs: allJobs) }.value
                    async let activityTask = loadRecentActivity()
                    async let hazardsTask = loadTopHazards(jobs: allJobs)
                    async let atRiskTask = Task { @MainActor in loadJobsAtRisk(jobs: allJobs) }.value
                    async let missingEvidenceTask = loadMissingEvidenceJobs(jobs: allJobs)
                    
                    // Wait for all tasks
                    kpis = await kpisTask
                    chartData = await chartTask
                    recentActivity = try await activityTask
                    topHazards = try await hazardsTask
                    jobsAtRisk = await atRiskTask
                    missingEvidenceJobs = try await missingEvidenceTask
                    
                    hasLoadedOnce = true
                }
                
            } catch is CancellationError {
                // Task was cancelled, ignore
                print("[DashboardViewModel] ℹ️ Load task was cancelled")
            } catch {
                errorMessage = error.localizedDescription
                print("[DashboardViewModel] ❌ Failed to load dashboard: \(error.localizedDescription)")
            }
        }
    }
    
    /// Load if not already loaded (call this from .task modifier)
    func loadIfNeeded() {
        guard !hasLoadedOnce else { return }
        load()
    }
    
    /// Force reload (resets hasLoadedOnce flag)
    func reload() {
        hasLoadedOnce = false
        load()
    }
    
    /// Cancel any ongoing load task
    func cancel() {
        loadTask?.cancel()
        loadTask = nil
    }
    
    // MARK: - Private Load Methods
    
    /// Load jobs once using shared store (prevents duplicate API calls)
    private func loadJobsOnce() async throws -> [Job] {
        return try await JobsStore.shared.fetch(forceRefresh: false)
    }
    
    private func loadKPIs(jobs: [Job]) -> DashboardKPIs {
        let allJobs = jobs
        
        // Calculate jobs this week
        let calendar = Calendar.current
        let now = Date()
        let weekAgo = calendar.date(byAdding: .day, value: -7, to: now) ?? now
        let jobsThisWeek = allJobs.filter { job in
            if let createdAt = ISO8601DateFormatter().date(from: job.createdAt) {
                return createdAt >= weekAgo
            }
            return false
        }.count
        
        // Calculate open risks (high risk jobs)
        let highRiskJobs = allJobs.filter { job in
            if let score = job.riskScore {
                return score > 75
            }
            return job.riskLevel?.lowercased() == "high" || job.riskLevel?.lowercased() == "critical"
        }
        
        // Calculate compliance score from completed jobs
        let completedJobs = allJobs.filter { $0.status.lowercased() == "completed" }
        let complianceScore = allJobs.isEmpty ? 0 : Int((Double(completedJobs.count) / Double(allJobs.count)) * 100)
        
        return DashboardKPIs(
            complianceScore: complianceScore,
            complianceTrend: .neutral, // Would need historical data
            openRisks: highRiskJobs.count,
            risksTrend: .neutral, // Would need historical data
            jobsThisWeek: jobsThisWeek,
            jobsTrend: .neutral // Would need historical data
        )
    }
    
    private func loadChartData(jobs: [Job]) -> [ChartDataPoint] {
        // Generate chart data from jobs (compliance over time)
        return generateChartDataFromJobs(jobs)
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
    
    private func loadRecentActivity() async throws -> [AuditEvent] {
        return try await APIClient.shared.getAuditEvents(timeRange: "30d", limit: 10)
    }
    
    private func loadTopHazards(jobs: [Job]? = nil) async throws -> [Hazard] {
        // Try new aggregated endpoint first
        do {
            return try await APIClient.shared.getTopHazards()
        } catch {
            // Fallback to per-job aggregation if endpoint doesn't exist
            guard let allJobs = jobs else {
                return []
            }
            
            var hazardCounts: [String: Int] = [:]
            for job in allJobs.prefix(10) {
                do {
                    let jobHazards = try await APIClient.shared.getHazards(jobId: job.id)
                    for hazard in jobHazards {
                        hazardCounts[hazard.code, default: 0] += 1
                    }
                } catch {
                    continue
                }
            }
            
            return hazardCounts
                .sorted { $0.value > $1.value }
                .prefix(5)
                .enumerated()
                .map { index, element in
                    Hazard(
                        id: "\(index)",
                        code: element.key,
                        name: element.key,
                        description: "",
                        severity: "medium",
                        status: "open",
                        createdAt: "",
                        updatedAt: ""
                    )
                }
        }
    }
    
    /// Parse trend string to Trend enum
    private func parseTrend(_ trend: String) -> Trend {
        switch trend.lowercased() {
        case "up", "increasing", "positive":
            return .neutral // Would need amount from API
        case "down", "decreasing", "negative":
            return .neutral // Would need amount from API
        default:
            return .neutral
        }
    }
    
    private func loadJobsAtRisk(jobs: [Job]) -> [Job] {
        // Filter high-risk jobs from cached jobs
        return jobs.filter { job in
            if let score = job.riskScore {
                return score >= 70
            }
            return job.riskLevel?.lowercased() == "high" || job.riskLevel?.lowercased() == "critical"
        }
    }
    
    private func loadMissingEvidenceJobs(jobs: [Job]) async throws -> [Job] {
        // TODO: Replace with dedicated /api/dashboard/missing-evidence endpoint when available
        // For now, check for missing evidence from cached jobs
        let allJobs = jobs
        
        var missingEvidenceJobs: [Job] = []
        for job in allJobs.prefix(20) { // Limit for performance
            let evidence = try? await APIClient.shared.getEvidence(jobId: job.id)
            // Assume jobs need at least 3 evidence items (this should come from job requirements)
            if (evidence?.count ?? 0) < 3 {
                missingEvidenceJobs.append(job)
            }
        }
        
        return missingEvidenceJobs
    }
}
