import Foundation

/// Job/Work Record model
struct Job: Identifiable, Codable, Hashable {
    let id: String
    let clientName: String
    let jobType: String
    let location: String
    let status: String
    let riskScore: Int?
    let riskLevel: String?
    let createdAt: String
    let updatedAt: String?
    
    // Explicit CodingKeys to map snake_case JSON to camelCase Swift properties
    enum CodingKeys: String, CodingKey {
        case id
        case clientName = "client_name"
        case jobType = "job_type"
        case location
        case status
        case riskScore = "risk_score"
        case riskLevel = "risk_level"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
    
    // Custom decoder to ensure snake_case mapping works correctly
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        clientName = try container.decode(String.self, forKey: .clientName)
        jobType = try container.decode(String.self, forKey: .jobType)
        location = try container.decode(String.self, forKey: .location)
        status = try container.decode(String.self, forKey: .status)
        riskScore = try container.decodeIfPresent(Int.self, forKey: .riskScore)
        riskLevel = try container.decodeIfPresent(String.self, forKey: .riskLevel)
        createdAt = try container.decode(String.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)
    }
}

struct JobsResponse: Codable {
    let data: [Job]
    let pagination: Pagination?
}

struct Pagination: Codable {
    let page: Int
    let pageSize: Int
    let total: Int
    let totalPages: Int
    
    enum CodingKeys: String, CodingKey {
        case page
        case pageSize = "page_size"
        case total
        case totalPages = "total_pages"
    }
}
