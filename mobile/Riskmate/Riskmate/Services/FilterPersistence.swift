import Foundation

/// Persists filter state per tab/view
struct FilterPersistence {
    private static let defaults = UserDefaults.standard
    
    // MARK: - Jobs Filters
    
    static func saveJobsFilters(status: String, riskLevel: String) {
        defaults.set(status, forKey: "jobs_filter_status")
        defaults.set(riskLevel, forKey: "jobs_filter_risk")
    }
    
    static func loadJobsFilters() -> (status: String, riskLevel: String) {
        let status = defaults.string(forKey: "jobs_filter_status") ?? "all"
        let riskLevel = defaults.string(forKey: "jobs_filter_risk") ?? "all"
        return (status, riskLevel)
    }
    
    // MARK: - Audit Filters
    
    static func saveAuditFilters(category: String?, severity: String?) {
        if let category = category {
            defaults.set(category, forKey: "audit_filter_category")
        } else {
            defaults.removeObject(forKey: "audit_filter_category")
        }
        
        if let severity = severity {
            defaults.set(severity, forKey: "audit_filter_severity")
        } else {
            defaults.removeObject(forKey: "audit_filter_severity")
        }
    }
    
    static func loadAuditFilters() -> (category: String?, severity: String?) {
        let category = defaults.string(forKey: "audit_filter_category")
        let severity = defaults.string(forKey: "audit_filter_severity")
        return (category, severity)
    }
    
    // MARK: - Clear Filters
    
    static func clearJobsFilters() {
        defaults.removeObject(forKey: "jobs_filter_status")
        defaults.removeObject(forKey: "jobs_filter_risk")
    }
    
    static func clearAuditFilters() {
        defaults.removeObject(forKey: "audit_filter_category")
        defaults.removeObject(forKey: "audit_filter_severity")
    }
}
