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
