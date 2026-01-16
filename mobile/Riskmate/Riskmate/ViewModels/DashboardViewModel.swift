import Foundation
import SwiftUI

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
    
    /// Load all dashboard data in parallel
    func load() {
        // Cancel any existing load task
        loadTask?.cancel()
        
        loadTask = Task {
            isLoading = true
            errorMessage = nil
            
            defer { isLoading = false }
            
            do {
                // Load all data in parallel for better performance
                async let kpisTask = loadKPIs()
                async let chartTask = loadChartData()
                async let activityTask = loadRecentActivity()
                async let hazardsTask = loadTopHazards()
                async let atRiskTask = loadJobsAtRisk()
                async let missingEvidenceTask = loadMissingEvidenceJobs()
                
                // Wait for all tasks (ignore cancellation errors)
                do {
                    kpis = try await kpisTask
                } catch is CancellationError {
                    // Ignore cancellation
                } catch {
                    print("[DashboardViewModel] ⚠️ Failed to load KPIs: \(error.localizedDescription)")
                }
                
                do {
                    chartData = try await chartTask
                } catch is CancellationError {
                    // Ignore cancellation
                } catch {
                    print("[DashboardViewModel] ⚠️ Failed to load chart data: \(error.localizedDescription)")
                }
                
                do {
                    recentActivity = try await activityTask
                } catch is CancellationError {
                    // Ignore cancellation
                } catch {
                    print("[DashboardViewModel] ⚠️ Failed to load recent activity: \(error.localizedDescription)")
                }
                
                do {
                    topHazards = try await hazardsTask
                } catch is CancellationError {
                    // Ignore cancellation
                } catch {
                    print("[DashboardViewModel] ⚠️ Failed to load top hazards: \(error.localizedDescription)")
                }
                
                do {
                    jobsAtRisk = try await atRiskTask
                } catch is CancellationError {
                    // Ignore cancellation
                } catch {
                    print("[DashboardViewModel] ⚠️ Failed to load jobs at risk: \(error.localizedDescription)")
                }
                
                do {
                    missingEvidenceJobs = try await missingEvidenceTask
                } catch is CancellationError {
                    // Ignore cancellation
                } catch {
                    print("[DashboardViewModel] ⚠️ Failed to load missing evidence jobs: \(error.localizedDescription)")
                }
                
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
    
    /// Cancel any ongoing load task
    func cancel() {
        loadTask?.cancel()
        loadTask = nil
    }
    
    // MARK: - Private Load Methods
    
    private func loadKPIs() async throws -> DashboardKPIs {
        // Load jobs to calculate KPIs
        let jobsResponse = try await APIClient.shared.getJobs(page: 1, limit: 100)
        let allJobs = jobsResponse.data
        
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
    
    private func loadChartData() async throws -> [ChartDataPoint] {
        // Load jobs to generate chart data
        let jobsResponse = try await APIClient.shared.getJobs(page: 1, limit: 100)
        let allJobs = jobsResponse.data
        
        // Generate chart data from jobs (compliance over time)
        return generateChartDataFromJobs(allJobs)
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
    
    private func loadTopHazards() async throws -> [Hazard] {
        // TODO: Replace with dedicated /api/dashboard/top-hazards endpoint when available
        // For now, load from jobs and aggregate
        let jobsResponse = try await APIClient.shared.getJobs(page: 1, limit: 100)
        let allJobs = jobsResponse.data
        
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
    
    private func loadJobsAtRisk() async throws -> [Job] {
        // Load high-risk jobs
        let jobsResponse = try await APIClient.shared.getJobs(page: 1, limit: 100, riskLevel: "high")
        return jobsResponse.data.filter { job in
            if let score = job.riskScore {
                return score >= 70
            }
            return job.riskLevel?.lowercased() == "high" || job.riskLevel?.lowercased() == "critical"
        }
    }
    
    private func loadMissingEvidenceJobs() async throws -> [Job] {
        // TODO: Replace with dedicated /api/dashboard/missing-evidence endpoint when available
        // For now, load jobs and check for missing evidence
        let jobsResponse = try await APIClient.shared.getJobs(page: 1, limit: 100)
        let allJobs = jobsResponse.data
        
        var missingEvidenceJobs: [Job] = []
        for job in allJobs.prefix(20) { // Limit for performance
            do {
                let evidence = try? await APIClient.shared.getEvidence(jobId: job.id)
                // Assume jobs need at least 3 evidence items (this should come from job requirements)
                if (evidence?.count ?? 0) < 3 {
                    missingEvidenceJobs.append(job)
                }
            } catch {
                // Skip if evidence check fails
                continue
            }
        }
        
        return missingEvidenceJobs
    }
}
