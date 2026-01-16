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
