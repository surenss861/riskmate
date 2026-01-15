import Foundation

/// Team management models
struct TeamResponse: Codable {
    let members: [TeamMember]
    let invites: [TeamInvite]
    let seats: SeatsInfo
    let riskCoverage: RiskCoverage?
    let currentUserRole: String
    let plan: String
    
    enum CodingKeys: String, CodingKey {
        case members
        case invites
        case seats
        case riskCoverage = "risk_coverage"
        case currentUserRole = "current_user_role"
        case plan
    }
}

struct TeamMember: Identifiable, Codable {
    let id: String
    let email: String
    let fullName: String?
    let role: TeamRole
    let createdAt: String
    let mustResetPassword: Bool
    
    enum CodingKeys: String, CodingKey {
        case id
        case email
        case fullName = "full_name"
        case role
        case createdAt = "created_at"
        case mustResetPassword = "must_reset_password"
    }
}

struct TeamInvite: Identifiable, Codable {
    let id: String
    let email: String
    let role: TeamRole
    let createdAt: String
    let invitedBy: String?
    let userId: String?
    
    enum CodingKeys: String, CodingKey {
        case id
        case email
        case role
        case createdAt = "created_at"
        case invitedBy = "invited_by"
        case userId = "user_id"
    }
}

enum TeamRole: String, Codable, CaseIterable {
    case owner = "owner"
    case admin = "admin"
    case safetyLead = "safety_lead"
    case executive = "executive"
    case member = "member"
    
    var displayName: String {
        switch self {
        case .owner: return "Owner"
        case .admin: return "Admin"
        case .safetyLead: return "Safety Lead"
        case .executive: return "Executive"
        case .member: return "Member"
        }
    }
}

struct SeatsInfo: Codable {
    let limit: Int?
    let used: Int
    let pending: Int
    let available: Int?
}

struct RiskCoverage: Codable {
    let owner: Int
    let admin: Int
    let safetyLead: Int
    let executive: Int
    let member: Int
    
    enum CodingKeys: String, CodingKey {
        case owner
        case admin
        case safetyLead = "safety_lead"
        case executive
        case member
    }
}

struct InviteRequest: Codable {
    let email: String
    let role: String
}
