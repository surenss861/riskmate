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
    /// Optional: from list API when backend includes readiness summary
    let evidenceCount: Int?
    let evidenceRequired: Int?
    let controlsCompleted: Int?
    let controlsTotal: Int?
    
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
        case evidenceCount = "evidence_count"
        case evidenceRequired = "evidence_required"
        case controlsCompleted = "controls_completed"
        case controlsTotal = "controls_total"
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
        evidenceCount = try container.decodeIfPresent(Int.self, forKey: .evidenceCount)
        evidenceRequired = try container.decodeIfPresent(Int.self, forKey: .evidenceRequired)
        controlsCompleted = try container.decodeIfPresent(Int.self, forKey: .controlsCompleted)
        controlsTotal = try container.decodeIfPresent(Int.self, forKey: .controlsTotal)
    }
}

extension Job {
    /// "Evidence 0/5 • Controls 3/5" when API provides counts; nil otherwise. Use in Operations list for at-a-glance status.
    var metaString: String? {
        var parts: [String] = []
        if let ec = evidenceCount, let er = evidenceRequired {
            parts.append("Evidence \(ec)/\(er)")
        }
        if let cc = controlsCompleted, let ct = controlsTotal {
            parts.append("Controls \(cc)/\(ct)")
        }
        return parts.isEmpty ? nil : parts.joined(separator: " • ")
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
