import Foundation
import Network
import UIKit

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

    func trackJobCreated(jobId: String, wasOffline: Bool) {
        trackEvent("job_created", metadata: [
            "job_id": jobId,
            "offline": String(wasOffline)
        ])
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
    
    func trackOfflineSyncFailed(itemType: String, error: String) {
        trackEvent("offline_sync_failed", metadata: [
            "item_type": itemType,
            "error": error
        ])
    }
    
    // MARK: - Onboarding Events
    
    func trackOnboardingCompleted() {
        trackEvent("onboarding_completed")
    }
    
    // MARK: - Evidence Capture Events
    
    func trackEvidenceCaptureStarted() {
        trackEvent("evidence_capture_started")
    }
    
    func trackEvidenceCaptureCompleted() {
        trackEvent("evidence_capture_completed")
    }
    
    // MARK: - Banner Events
    
    func trackCriticalBannerShown(jobId: String) {
        trackEvent("critical_banner_shown", metadata: ["job_id": jobId])
    }
    
    func trackCriticalBannerClicked(jobId: String) {
        trackEvent("critical_banner_clicked", metadata: ["job_id": jobId])
    }
    
    // MARK: - Long-Press Actions
    
    func trackLongPressActionsUsed(action: String, jobId: String) {
        trackEvent("long_press_actions_used", metadata: [
            "action": action,
            "job_id": jobId
        ])
    }
    
    // MARK: - Refresh Events
    
    func trackRefreshTriggered() {
        trackEvent("refresh_triggered")
    }
    
    func trackRefreshDuration(ms: Int) {
        trackEvent("refresh_duration_ms", metadata: ["duration_ms": String(ms)])
    }
    
    // MARK: - Verification Events
    
    func trackVerificationExplainerOpened() {
        trackEvent("verification_explainer_opened")
    }
    
    // MARK: - Evidence Actions
    
    func trackAddEvidenceTapped() {
        trackEvent("add_evidence_tapped")
    }
    
    func trackCapturePhotoSuccess() {
        trackEvent("capture_photo_success")
    }
    
    // MARK: - Private
    
    private func trackEvent(_ name: String, metadata: [String: String]? = nil) {
        var eventMetadata = metadata ?? [:]
        
        // Add diagnostics if enabled
        if UserDefaultsManager.Production.sendDiagnostics {
            eventMetadata["device_model"] = UIDevice.current.model
            eventMetadata["ios_version"] = UIDevice.current.systemVersion
            if let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String {
                eventMetadata["app_version"] = version
            }
            if let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String {
                eventMetadata["app_build"] = build
            }
            
            // Network type (simplified - check current path)
            let monitor = NWPathMonitor()
            let path = monitor.currentPath
            if path.status == .satisfied {
                if path.usesInterfaceType(.wifi) {
                    eventMetadata["network_type"] = "wifi"
                } else if path.usesInterfaceType(.cellular) {
                    eventMetadata["network_type"] = "cellular"
                } else {
                    eventMetadata["network_type"] = "other"
                }
            } else {
                eventMetadata["network_type"] = "none"
            }
        }
        
        let _: [String: Any] = [
            "name": name,
            "timestamp": ISO8601DateFormatter().string(from: Date()),
            "metadata": eventMetadata
        ]
        
        // Log for now (replace with actual analytics service)
        #if DEBUG
        print("[Analytics] \(name)", eventMetadata)
        #endif
        
        // TODO: Send to analytics service (PostHog, Mixpanel, etc.)
        // For now, events are logged only
    }
}
