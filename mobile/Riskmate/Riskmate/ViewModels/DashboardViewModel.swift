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
                // Load jobs ONCE and cache for all dashboard calculations
                let allJobs = try await loadJobsOnce()
                
                // Load all data in parallel using cached jobs
                async let kpisTask = Task { @MainActor in loadKPIs(jobs: allJobs) }.value
                async let chartTask = Task { @MainActor in loadChartData(jobs: allJobs) }.value
                async let activityTask = loadRecentActivity()
                async let hazardsTask = loadTopHazards(jobs: allJobs)
                async let atRiskTask = Task { @MainActor in loadJobsAtRisk(jobs: allJobs) }.value
                async let missingEvidenceTask = loadMissingEvidenceJobs(jobs: allJobs)
                
                // Wait for all tasks (ignore cancellation errors)
                kpis = await kpisTask
                chartData = await chartTask
                recentActivity = try await activityTask
                topHazards = try await hazardsTask
                jobsAtRisk = await atRiskTask
                missingEvidenceJobs = try await missingEvidenceTask
                
                // Mark as loaded only on success
                hasLoadedOnce = true
                
                // If we have a general error and no data loaded, set error message
                if kpis == nil && chartData.isEmpty && recentActivity.isEmpty {
                    errorMessage = "Failed to load dashboard data. Please try again."
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
        return try await JobsStore.shared.fetch(page: 1, limit: 100, forceRefresh: false)
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
    
    private func loadTopHazards(jobs: [Job]) async throws -> [Hazard] {
        // TODO: Replace with dedicated /api/dashboard/top-hazards endpoint when available
        // For now, load from jobs and aggregate
        let allJobs = jobs
        
        // Get hazards from all jobs and count occurrences
        var hazardCounts: [String: Int] = [:]
        for job in allJobs.prefix(10) { // Limit to first 10 jobs for performance
            do {
                let jobHazards = try await APIClient.shared.getHazards(jobId: job.id)
                for hazard in jobHazards {
                    hazardCounts[hazard.code, default: 0] += 1
                }
            } catch {
                // Skip jobs that fail to load hazards
                continue
            }
        }
        
        // Convert to Hazard array, sorted by count
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
