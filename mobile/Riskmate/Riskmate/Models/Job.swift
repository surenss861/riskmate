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
    /// "Evidence 0/5 • Controls 3/5" when API provides counts; nil otherwise. Hide Controls 0/0 and Evidence when required is 0. Clamp display so we never show 6/5 or negatives.
    var metaString: String? {
        var parts: [String] = []
        if let er = evidenceRequired, er > 0 {
            let safeRequired = max(0, er)
            let safeCount = min(max(0, evidenceCount ?? 0), safeRequired)
            parts.append("Evidence \(safeCount)/\(safeRequired)")
        }
        if let ct = controlsTotal, ct > 0 {
            let safeTotal = max(0, ct)
            let safeCompleted = min(max(0, controlsCompleted ?? 0), safeTotal)
            parts.append("Controls \(safeCompleted)/\(safeTotal)")
        }
        return parts.isEmpty ? nil : parts.joined(separator: " • ")
    }

    /// True when all shown meta dimensions are complete (evidence and controls if present). Used for meta row color: orange when incomplete, secondary when complete.
    var isMetaComplete: Bool {
        let evidenceComplete: Bool = {
            guard let er = evidenceRequired, er > 0 else { return true }
            return (evidenceCount ?? 0) >= er
        }()
        let controlsComplete: Bool = {
            guard let ct = controlsTotal, ct > 0 else { return true }
            return (controlsCompleted ?? 0) >= ct
        }()
        return evidenceComplete && controlsComplete
    }

    /// Compliance status for Work Records (external view). Compliant = evidence + controls met; Attention = some progress; Non-Compliant = none. When readiness fields are nil (no API data), treated as compliant; nil counts treated as 0.
    var complianceStatus: ComplianceStatus {
        complianceStatusOptional ?? .compliant
    }

    /// Nil when readiness data is missing (no badge). Use this to avoid showing "Non-Compliant" for jobs with no evidence/control data.
    var complianceStatusOptional: ComplianceStatus? {
        guard evidenceRequired != nil || controlsTotal != nil else {
            return nil
        }
        let evidenceComplete = (evidenceRequired ?? 0) <= 0 || (evidenceCount ?? 0) >= (evidenceRequired ?? 0)
        let controlsComplete = (controlsTotal ?? 0) <= 0 || (controlsCompleted ?? 0) >= (controlsTotal ?? 0)
        if evidenceComplete && controlsComplete {
            return .compliant
        }
        if (evidenceCount ?? 0) > 0 || (controlsCompleted ?? 0) > 0 {
            return .attention
        }
        return .nonCompliant
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
