import Foundation

/// In-app notification model for the notification center.
/// Maps from API response (APIClient.NotificationItem); supports display and deep link navigation.
struct AppNotification: Identifiable {
    let id: String
    let type: NotificationType
    let title: String
    let body: String
    let deepLink: String?
    let isRead: Bool
    let createdAt: Date

    /// Raw type string from API (for filtering and persistence).
    var typeRaw: String { type.rawValue }
}

/// Notification type for display and filtering. Aligns with backend notification types.
enum NotificationType: String, CaseIterable, Identifiable {
    case jobAssigned = "job_assigned"
    case signatureRequest = "signature_request"
    case evidenceUploaded = "evidence_uploaded"
    case hazardAdded = "hazard_added"
    case deadline = "deadline"
    case mention = "mention"
    case reportReady = "report_ready"
    case weeklySummary = "weekly_summary"
    case highRiskJob = "high_risk_job"
    case riskAlert = "risk_alert"
    case jobReminder = "job_reminder"
    case mitigationDue = "mitigation_due"
    case reportGenerated = "report_generated"
    case subscriptionUpdate = "subscription_update"
    case push = "push"

    /// Display label for filter picker and list.
    var displayName: String {
        switch self {
        case .jobAssigned: return "Job assigned"
        case .signatureRequest: return "Signature request"
        case .evidenceUploaded: return "Evidence uploaded"
        case .hazardAdded: return "Hazard added"
        case .deadline: return "Deadline"
        case .mention: return "Mention"
        case .reportReady: return "Report ready"
        case .weeklySummary: return "Weekly summary"
        case .highRiskJob: return "High-risk job"
        case .riskAlert: return "Risk alert"
        case .jobReminder: return "Job reminder"
        case .mitigationDue: return "Mitigation due"
        case .reportGenerated: return "Report generated"
        case .subscriptionUpdate: return "Subscription"
        case .push: return "Push"
        }
    }

    /// Default title when notification has no custom title (e.g. from type-only payload).
    var defaultTitle: String {
        switch self {
        case .jobAssigned: return "Job Assigned"
        case .signatureRequest: return "Signature Requested"
        case .evidenceUploaded: return "Evidence Uploaded"
        case .hazardAdded: return "Hazard Added"
        case .deadline: return "Deadline Approaching"
        case .mention: return "You were mentioned"
        case .reportReady: return "Report Ready"
        case .weeklySummary: return "Weekly Summary"
        case .highRiskJob: return "High-risk job"
        case .riskAlert: return "Risk Alert"
        case .jobReminder: return "Job Reminder"
        case .mitigationDue: return "Mitigation Due"
        case .reportGenerated: return "Report Generated"
        case .subscriptionUpdate: return "Subscription Update"
        case .push: return "Notification"
        }
    }

    /// Parse API type string; returns .push for unknown values.
    static func from(apiType: String) -> NotificationType {
        NotificationType(rawValue: apiType) ?? .push
    }
}

// MARK: - Map from API

extension AppNotification {
    /// Build from API notification item; uses first line as title if content has newlines, else body only.
    init(from item: APIClient.NotificationItem) {
        self.id = item.id
        self.type = NotificationType.from(apiType: item.type)
        let (title, body) = Self.splitTitleAndBody(item.content)
        self.title = title.isEmpty ? self.type.defaultTitle : title
        self.body = body
        self.deepLink = item.deepLink
        self.isRead = item.is_read
        self.createdAt = Self.parseDate(item.created_at) ?? Date()
    }

    private static func splitTitleAndBody(_ content: String) -> (String, String) {
        let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let idx = trimmed.firstIndex(of: "\n") else {
            return ("", trimmed)
        }
        let t = String(trimmed[..<idx]).trimmingCharacters(in: .whitespaces)
        let b = String(trimmed[trimmed.index(after: idx)...]).trimmingCharacters(in: .whitespaces)
        return (t, b)
    }

    private static func parseDate(_ iso: String) -> Date? {
        let withFractional = ISO8601DateFormatter()
        withFractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let withoutFractional = ISO8601DateFormatter()
        withoutFractional.formatOptions = [.withInternetDateTime]
        return withFractional.date(from: iso) ?? withoutFractional.date(from: iso)
    }
}
