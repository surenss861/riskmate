import Combine
import SwiftUI

/// Routes riskmate:// URLs to the appropriate view (JobDetail, Report, Notifications, etc.).
/// Used when user taps a push notification or opens a riskmate:// link.
@MainActor
final class DeepLinkRouter: ObservableObject {
    static let shared = DeepLinkRouter()

    /// Pending navigation to apply when the main content is ready (e.g. after login).
    @Published var pendingURL: URL?
    /// Request to present job detail with optional tab and hazard.
    @Published var pendingJobId: String?
    @Published var pendingJobTab: String?
    @Published var pendingHazardId: String?
    /// Request to present report view.
    @Published var pendingReportRunId: String?
    /// Request to open notifications (e.g. NotificationCenterView).
    @Published var openNotifications: Bool = false
    /// Request to navigate to a comment (sign-off) context; app resolves to job and opens Signatures tab.
    @Published var pendingCommentId: String?

    private init() {}

    /// Handle a riskmate:// URL. Returns an optional view for immediate presentation; otherwise sets pending* for ContentView to observe.
    /// - Parameter url: e.g. riskmate://jobs/123, riskmate://jobs/123/signatures, riskmate://notifications
    func handle(_ url: URL) -> AnyView? {
        guard url.scheme?.lowercased() == "riskmate" else { return nil }
        let hostPart = url.host ?? ""
        let pathPart = url.path
        let combined = hostPart + pathPart
        let path = combined.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let pathComponents = path.split(separator: "/").map(String.init)

        if pathComponents.isEmpty { return nil }

        switch pathComponents[0].lowercased() {
        case "jobs":
            return handleJobRoute(pathComponents: pathComponents, url: url)
        case "reports":
            return handleReportRoute(pathComponents: pathComponents)
        case "notifications":
            openNotifications = true
            return nil
        case "comments":
            if pathComponents.count >= 2 {
                pendingCommentId = pathComponents[1]
            }
            return nil
        default:
            return nil
        }
    }

    private func handleJobRoute(pathComponents: [String], url: URL) -> AnyView? {
        guard pathComponents.count >= 2 else { return nil }
        let jobId = pathComponents[1]

        if pathComponents.count >= 4 && pathComponents[2].lowercased() == "hazards" {
            let hazardId = pathComponents[3]
            pendingJobId = jobId
            pendingJobTab = JobDetailTab.hazards.rawValue
            pendingHazardId = hazardId
            return nil
        }

        if pathComponents.count >= 3 {
            let sub = pathComponents[2].lowercased()
            if sub == "signatures" {
                pendingJobId = jobId
                pendingJobTab = JobDetailTab.signatures.rawValue
                return nil
            }
            if sub == "evidence" {
                pendingJobId = jobId
                pendingJobTab = JobDetailTab.evidence.rawValue
                return nil
            }
        }

        pendingJobId = jobId
        pendingJobTab = nil
        pendingHazardId = nil
        return nil
    }

    private func handleReportRoute(pathComponents: [String]) -> AnyView? {
        guard pathComponents.count >= 2 else { return nil }
        let runId = pathComponents[1]
        pendingReportRunId = runId
        return nil
    }

    /// Parse job ID from a riskmate URL (e.g. riskmate://jobs/123 -> "123").
    func parseJobId(from url: URL) -> String? {
        guard url.scheme?.lowercased() == "riskmate" else { return nil }
        let combined = (url.host ?? "") + url.path
        let path = combined.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let components = path.split(separator: "/").map(String.init)
        guard components.count >= 2, components[0].lowercased() == "jobs" else { return nil }
        return components[1]
    }

    /// Parse tab from URL (signatures, evidence, or nil for overview).
    func parseTab(from url: URL) -> String? {
        guard url.scheme?.lowercased() == "riskmate" else { return nil }
        let combined = (url.host ?? "") + url.path
        let path = combined.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let components = path.split(separator: "/").map(String.init)
        guard components.count >= 3, components[0].lowercased() == "jobs" else { return nil }
        let sub = components[2].lowercased()
        if sub == "signatures" { return JobDetailTab.signatures.rawValue }
        if sub == "evidence" { return JobDetailTab.evidence.rawValue }
        if sub == "hazards" { return JobDetailTab.hazards.rawValue }
        return nil
    }

    /// Programmatically open job detail (e.g. from Mentions list). ContentView observes pendingJobId and presents JobDetailView.
    func openJob(id: String, tab: JobDetailTab? = nil) {
        pendingJobId = id
        pendingJobTab = tab?.rawValue
        pendingHazardId = nil
    }

    /// Clear pending navigation after handling.
    func clearPending() {
        pendingURL = nil
        pendingJobId = nil
        pendingJobTab = nil
        pendingHazardId = nil
        pendingReportRunId = nil
        openNotifications = false
        pendingCommentId = nil
    }
}
