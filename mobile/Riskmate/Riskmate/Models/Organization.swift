import Foundation

struct Organization: Codable, Identifiable {
    let id: String
    var name: String
    let updated_at: String?
    
    enum CodingKeys: String, CodingKey {
        case id
        case name
        case updated_at
    }
}

struct OrganizationResponse: Codable {
    let data: Organization
    let message: String?
}

struct DeactivateAccountResponse: Codable {
    let message: String
    let retention_days: Int
}

// MARK: - Entitlements (single source of truth for iOS ↔ web parity)

struct EntitlementsResponse: Codable {
    let ok: Bool
    let data: EntitlementsData
}

struct EntitlementsData: Codable {
    let organization_id: String
    let user_id: String
    let role: String
    let plan_code: String
    let status: String
    let limits: EntitlementsLimits
    let features: [String]
    let flags: EntitlementsFlags
}

struct EntitlementsLimits: Codable {
    let seats: EntitlementsSeatsInfo
    let jobs_monthly: JobsMonthlyInfo
}

struct EntitlementsSeatsInfo: Codable {
    let limit: Int?
    let used: Int
    let available: Int?
}

struct JobsMonthlyInfo: Codable {
    let limit: Int?
}

struct EntitlementsFlags: Codable {
    let cancel_at_period_end: Bool
    let current_period_end: String?
    let legal_accepted: Bool
    let must_reset_password: Bool
}

struct EventLogResponse: Codable {
    let success: Bool
    let event_id: String?
    let message: String?
}
