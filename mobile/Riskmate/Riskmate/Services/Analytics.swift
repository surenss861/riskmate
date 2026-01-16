import Foundation

/// Minimal analytics tracking for business-critical events
/// Privacy-safe: counts + timestamps, not content
@MainActor
class Analytics {
    static let shared = Analytics()
    
    private init() {}
    
    // MARK: - Auth Events
    
    func trackLoginSuccess() {
        trackEvent("auth_login_success")
    }
    
    func trackLoginFailed(reason: String? = nil) {
        trackEvent("auth_login_failed", metadata: reason.map { ["reason": $0] })
    }
    
    // MARK: - Job Events
    
    func trackJobOpened(jobId: String) {
        trackEvent("job_opened", metadata: ["job_id": jobId])
    }
    
    // MARK: - Control Events
    
    func trackControlCompleted(controlId: String, wasOffline: Bool) {
        trackEvent("control_completed", metadata: [
            "control_id": controlId,
            "offline": String(wasOffline)
        ])
    }
    
    // MARK: - Evidence Events
    
    func trackEvidenceUploadStarted(evidenceId: String) {
        trackEvent("evidence_upload_started", metadata: ["evidence_id": evidenceId])
    }
    
    func trackEvidenceUploadSucceeded(evidenceId: String) {
        trackEvent("evidence_upload_succeeded", metadata: ["evidence_id": evidenceId])
    }
    
    func trackEvidenceUploadFailed(evidenceId: String, error: String) {
        trackEvent("evidence_upload_failed", metadata: [
            "evidence_id": evidenceId,
            "error": error
        ])
    }
    
    // MARK: - Export Events
    
    func trackExportStarted(jobId: String, type: String) {
        trackEvent("export_started", metadata: [
            "job_id": jobId,
            "type": type
        ])
    }
    
    func trackExportSucceeded(jobId: String, type: String) {
        trackEvent("export_succeeded", metadata: [
            "job_id": jobId,
            "type": type
        ])
    }
    
    func trackExportFailed(jobId: String, type: String, error: String) {
        trackEvent("export_failed", metadata: [
            "job_id": jobId,
            "type": type,
            "error": error
        ])
    }
    
    // MARK: - Sync Events
    
    func trackOfflineQueueDepth(depth: Int) {
        // Sample every 10th call to avoid spam
        if depth % 10 == 0 {
            trackEvent("offline_queue_depth", metadata: ["depth": String(depth)])
        }
    }
    
    func trackTimeToFirstSync(seconds: TimeInterval) {
        trackEvent("time_to_first_successful_sync", metadata: [
            "seconds": String(Int(seconds))
        ])
    }
    
    // MARK: - Private
    
    private func trackEvent(_ name: String, metadata: [String: String]? = nil) {
        let _: [String: Any] = [
            "name": name,
            "timestamp": ISO8601DateFormatter().string(from: Date()),
            "metadata": metadata ?? [:]
        ]
        
        // Log for now (replace with actual analytics service)
        #if DEBUG
        print("[Analytics] \(name)", metadata ?? "")
        #endif
        
        // TODO: Send to analytics service (PostHog, Mixpanel, etc.)
        // For now, events are logged only
    }
}
