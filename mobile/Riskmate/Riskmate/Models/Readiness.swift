import Foundation

/// Audit Readiness models
struct ReadinessResponse: Codable {
    let score: Int
    let totalItems: Int
    let criticalBlockers: Int
    let materialItems: Int
    let timeToClear: String?
    let oldestOverdue: String?
    let items: [ReadinessItem]
    
    enum CodingKeys: String, CodingKey {
        case score
        case totalItems = "total_items"
        case criticalBlockers = "critical_blockers"
        case materialItems = "material_items"
        case timeToClear = "time_to_clear"
        case oldestOverdue = "oldest_overdue"
        case items
    }
}

struct ReadinessItem: Identifiable, Codable {
    let id: String
    let category: ReadinessCategory
    let severity: ReadinessSeverity
    let ruleCode: String
    let ruleName: String
    let whyItMatters: String
    let workRecordId: String?
    let workRecordName: String?
    let ownerId: String?
    let ownerName: String?
    let dueDate: String?
    let fixActionType: FixActionType
    let status: ReadinessStatus
    
    enum CodingKeys: String, CodingKey {
        case id
        case category
        case severity
        case ruleCode = "rule_code"
        case ruleName = "rule_name"
        case whyItMatters = "why_it_matters"
        case workRecordId = "work_record_id"
        case workRecordName = "work_record_name"
        case ownerId = "owner_id"
        case ownerName = "owner_name"
        case dueDate = "due_date"
        case fixActionType = "fix_action_type"
        case status
    }
}

enum ReadinessCategory: String, Codable, CaseIterable {
    case evidence = "Evidence"
    case controls = "Controls"
    case attestations = "Attestations"
    case incidents = "Incidents"
    case access = "Access"
}

enum ReadinessSeverity: String, Codable {
    case critical
    case material
    case info
}

enum FixActionType: String, Codable {
    case uploadEvidence = "upload_evidence"
    case requestAttestation = "request_attestation"
    case completeControls = "complete_controls"
    case resolveIncident = "resolve_incident"
    case reviewItem = "review_item"
}

enum ReadinessStatus: String, Codable {
    case open
    case inProgress = "in_progress"
    case waived
    case resolved
}
