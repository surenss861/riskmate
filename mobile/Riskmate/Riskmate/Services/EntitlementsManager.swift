import Foundation
import Combine

// Entitlements types are defined in Organization.swift (EntitlementsData, EntitlementsLimits, etc.)
// This file uses those types

/// Single source of truth for user entitlements (plan, limits, features)
/// Replaces UserDefaults/AuditorMode gating with server-driven truth
@MainActor
final class EntitlementsManager: ObservableObject {
    static let shared = EntitlementsManager()
    
    @Published private(set) var entitlements: EntitlementsData?
    @Published private(set) var isLoading: Bool = false
    @Published private(set) var lastError: String?
    
    private var lastFetchedAt: Date?
    private let throttleInterval: TimeInterval = 20 // Don't fetch more than once per 20 seconds
    
    private init() {}
    
    /// Refresh entitlements from backend
    /// - Parameter force: If true, bypasses throttle and forces refresh
    func refresh(force: Bool = false) async {
        // Throttle: don't fetch if we just fetched recently (unless forced)
        if !force, let last = lastFetchedAt, Date().timeIntervalSince(last) < throttleInterval {
            print("[EntitlementsManager] Throttled refresh (last fetched \(Int(Date().timeIntervalSince(last)))s ago)")
            return
        }
        
        isLoading = true
        lastError = nil
        defer { isLoading = false }
        
        do {
            let response = try await APIClient.shared.getEntitlements()
            entitlements = response.data
            lastFetchedAt = Date()
            print("[EntitlementsManager] ✅ Entitlements refreshed: plan=\(response.data.plan_code), role=\(response.data.role), features=\(response.data.features.count)")
        } catch {
            lastError = error.localizedDescription
            print("[EntitlementsManager] ❌ Failed to refresh entitlements: \(error.localizedDescription)")
        }
    }
    
    // MARK: - Feature Checks
    
    /// Check if user has a specific feature enabled
    func hasFeature(_ feature: String) -> Bool {
        entitlements?.features.contains(feature) ?? false
    }
    
    /// Check if a flag is enabled
    func flag(_ key: String) -> Bool {
        switch key {
        case "cancel_at_period_end":
            return entitlements?.flags.cancel_at_period_end ?? false
        case "legal_accepted":
            return entitlements?.flags.legal_accepted ?? false
        case "must_reset_password":
            return entitlements?.flags.must_reset_password ?? false
        default:
            return false
        }
    }
    
    /// Get a limit value
    func limit(_ key: String) -> Int? {
        switch key {
        case "seats":
            return entitlements?.limits.seats.limit
        case "jobs_monthly":
            return entitlements?.limits.jobs_monthly.limit
        default:
            return nil
        }
    }
    
    /// Get seats usage info
    func seatsInfo() -> (limit: Int?, used: Int, available: Int?) {
        guard let seats = entitlements?.limits.seats else {
            return (nil, 0, nil)
        }
        return (seats.limit, seats.used, seats.available)
    }
    
    /// Get current entitlements data (for debug views)
    func getEntitlements() -> EntitlementsData? {
        return entitlements
    }
    
    // MARK: - Status Checks
    
    /// Check if subscription is active
    func isActive() -> Bool {
        guard let status = entitlements?.status else { return false }
        return ["active", "trialing"].contains(status.lowercased())
    }
    
    /// Check if user is an auditor (read-only role)
    func isAuditor() -> Bool {
        entitlements?.role.lowercased() == "auditor"
    }
    
    /// Check if plan is "none" (no active subscription)
    func hasNoPlan() -> Bool {
        entitlements?.plan_code.lowercased() == "none" || !isActive()
    }
    
    // MARK: - Permission Checks
    
    /// Check if user can create jobs
    /// - Parameter currentJobCount: Current number of jobs this month (optional, for limit checking)
    func canCreateJob(currentJobCount: Int = 0) -> Bool {
        // Auditors are read-only
        if isAuditor() { return false }
        
        // Must have active subscription
        if !isActive() { return false }
        
        // Check job limit if set
        if let maxJobs = limit("jobs_monthly") {
            return currentJobCount < maxJobs
        }
        
        // No limit = unlimited
        return true
    }
    
    /// Check if user can export
    func canExport() -> Bool {
        // Auditors can view but not export
        if isAuditor() { return false }
        
        // Must have active subscription
        if !isActive() { return false }
        
        // Check if export feature is enabled
        return hasFeature("export") || hasFeature("permit_pack")
    }
    
    /// Check if user can capture evidence
    func canCaptureEvidence() -> Bool {
        // Auditors are read-only
        if isAuditor() { return false }
        
        // Must have active subscription
        if !isActive() { return false }
        
        return true
    }
    
    /// Check if user can manage team
    func canManageTeam() -> Bool {
        // Auditors are read-only
        if isAuditor() { return false }
        
        // Must have active subscription
        if !isActive() { return false }
        
        // Check role (only owners/admins can manage team)
        let role = entitlements?.role.lowercased() ?? ""
        return ["owner", "admin"].contains(role)
    }
    
    /// Check if user can anchor proofs
    func canAnchorProof() -> Bool {
        // Auditors are read-only
        if isAuditor() { return false }
        
        // Must have active subscription
        if !isActive() { return false }
        
        return true
    }
    
    // MARK: - Plan Info
    
    /// Get current plan code
    func currentPlan() -> String {
        entitlements?.plan_code ?? "none"
    }
    
    /// Get current status
    func currentStatus() -> String {
        entitlements?.status ?? "inactive"
    }
    
    /// Get cancellation info
    func cancellationInfo() -> (isScheduled: Bool, periodEnd: String?) {
        let isScheduled = flag("cancel_at_period_end")
        let periodEnd = entitlements?.flags.current_period_end
        return (isScheduled, periodEnd)
    }
}
