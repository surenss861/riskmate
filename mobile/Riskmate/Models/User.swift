import Foundation

struct User: Codable {
    let id: String
    let email: String?
    let full_name: String?
    let role: String?
    let organization_id: String?
}
