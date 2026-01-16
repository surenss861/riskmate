import Foundation

/// API client for RiskMate backend
class APIClient {
    static let shared = APIClient()
    
    private let baseURL: String
    private let authService: AuthService
    
    private init() {
        self.baseURL = AppConfig.shared.backendURL
        self.authService = AuthService.shared
    }
    
    /// Make authenticated API request
    private func request<T: Decodable>(
        endpoint: String,
        method: String = "GET",
        body: Data? = nil
    ) async throws -> T {
        // Ensure baseURL doesn't end with / and endpoint doesn't start with /
        let base = baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let path = endpoint.hasPrefix("/") ? endpoint : "/\(endpoint)"
        let fullURL = "\(base)\(path)"
        
        guard let url = URL(string: fullURL) else {
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Set timeout based on operation type
        if endpoint.contains("export") {
            request.timeoutInterval = 120.0 // 2 minutes for exports
        } else {
            request.timeoutInterval = 30.0 // 30 seconds for normal requests
        }
        
        // Add auth token (required for all requests)
        do {
            guard let token = try await authService.getAccessToken() else {
                throw APIError.httpError(statusCode: 401, message: "No authentication token available")
            }
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        } catch {
            throw APIError.httpError(statusCode: 401, message: "Failed to get authentication token: \(error.localizedDescription)")
        }
        
        if let body = body {
            request.httpBody = body
        }
        
        // Always log request details (production-ready logging)
        print("[APIClient] 🔵 \(method) \(fullURL)")
        print("[APIClient] Base URL: \(baseURL)")
        print("[APIClient] Path: \(path)")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            print("[APIClient] ❌ Invalid response (not HTTPURLResponse)")
            throw APIError.invalidResponse
        }
        
        // Always log response status
        print("[APIClient] 📡 Response: \(httpResponse.statusCode) for \(method) \(path)")
        
        if httpResponse.statusCode >= 400 {
            let errorPreview = String(data: data, encoding: .utf8)?.prefix(200) ?? "No error body"
            print("[APIClient] ❌ Error response body (first 200 chars): \(errorPreview)")
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            let errorMessage = try? JSONDecoder().decode(APIErrorResponse.self, from: data)
            let error = APIError.httpError(
                statusCode: httpResponse.statusCode,
                message: errorMessage?.message ?? "Request failed with status \(httpResponse.statusCode)"
            )
            
            // Tag error with category for better handling
            #if DEBUG
            print("[APIClient] Error category: \(errorCategory(for: httpResponse.statusCode))")
            #endif
            
            throw error
        }
        
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(T.self, from: data)
    }
    
    // MARK: - Organization API
    
    /// Get organization info
    func getOrganization() async throws -> Organization {
        let response: OrganizationResponse = try await request(
            endpoint: "/api/account/organization"
        )
        return response.data
    }
    
    /// Update organization name
    func updateOrganization(name: String) async throws -> Organization {
        let body = try JSONEncoder().encode(["name": name])
        let response: OrganizationResponse = try await request(
            endpoint: "/api/account/organization",
            method: "PATCH",
            body: body
        )
        return response.data
    }
    
    // MARK: - Readiness API
    
    /// Get audit readiness data
    func getReadiness(
        timeRange: String? = nil,
        category: String? = nil,
        severity: String? = nil
    ) async throws -> ReadinessResponse {
        var queryItems: [String] = []
        if let timeRange = timeRange { queryItems.append("time_range=\(timeRange)") }
        if let category = category { queryItems.append("category=\(category)") }
        if let severity = severity { queryItems.append("severity=\(severity)") }
        
        let query = queryItems.isEmpty ? "" : "?\(queryItems.joined(separator: "&"))"
        return try await request(endpoint: "/api/audit/readiness\(query)")
    }
    
    // MARK: - Audit API
    
    /// Get audit events
    func getAuditEvents(
        timeRange: String = "30d",
        category: String? = nil,
        limit: Int = 50
    ) async throws -> [AuditEvent] {
        var queryItems: [String] = []
        queryItems.append("time_range=\(timeRange)")
        queryItems.append("limit=\(limit)")
        if let category = category {
            queryItems.append("category=\(category)")
        }
        
        let query = "?\(queryItems.joined(separator: "&"))"
        let response: AuditEventsResponse = try await request(endpoint: "/api/audit/events\(query)")
        return response.events.map { $0.toAuditEvent() }
    }
    
    // MARK: - Executive API
    
    /// Get executive risk posture
    func getExecutivePosture(timeRange: String = "30d") async throws -> ExecutivePostureResponse {
        let response: ExecutivePostureWrapper = try await request(endpoint: "/api/executive/risk-posture?time_range=\(timeRange)")
        return response.data
    }
    
    /// Get executive brief data
    func getExecutiveBrief() async throws -> ExecutiveBriefResponse {
        return try await request(endpoint: "/api/executive/brief")
    }
    
    // MARK: - Team API
    
    /// Get team members and invites
    func getTeam() async throws -> TeamResponse {
        return try await request(endpoint: "/api/team")
    }
    
    /// Send team invite
    func inviteTeamMember(email: String, role: String) async throws {
        let body = try JSONEncoder().encode(InviteRequest(email: email, role: role))
        let _: EmptyResponse = try await request(
            endpoint: "/api/team/invite",
            method: "POST",
            body: body
        )
    }
    
    // MARK: - Job API
    
    /// Get list of jobs with filters
    func getJobs(
        page: Int = 1,
        limit: Int = 20,
        status: String? = nil,
        riskLevel: String? = nil,
        search: String? = nil
    ) async throws -> JobsListResponse {
        var queryItems: [String] = []
        queryItems.append("page=\(page)")
        queryItems.append("limit=\(limit)")
        if let status = status, status != "all" {
            queryItems.append("status=\(status)")
        }
        if let riskLevel = riskLevel, riskLevel != "all" {
            queryItems.append("risk_level=\(riskLevel)")
        }
        if let search = search, !search.isEmpty {
            queryItems.append("q=\(search.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? search)")
        }
        
        let query = queryItems.isEmpty ? "" : "?\(queryItems.joined(separator: "&"))"
        return try await request(endpoint: "/api/jobs\(query)")
    }
    
    /// Get single job by ID
    func getJob(_ jobId: String) async throws -> Job {
        let response: JobResponse = try await request(endpoint: "/api/jobs/\(jobId)")
        return response.data
    }
    
    /// Create a new job
    func createJob(_ job: Job) async throws -> Job {
        let body = try JSONEncoder().encode(job)
        let response: JobResponse = try await request(
            endpoint: "/api/jobs",
            method: "POST",
            body: body
        )
        return response.data
    }
    
    /// Update an existing job
    func updateJob(_ job: Job) async throws -> Job {
        let body = try JSONEncoder().encode(job)
        let response: JobResponse = try await request(
            endpoint: "/api/jobs/\(job.id)",
            method: "PATCH",
            body: body
        )
        return response.data
    }
    
    /// Delete a job
    func deleteJob(_ jobId: String) async throws {
        let _: EmptyResponse = try await request(
            endpoint: "/api/jobs/\(jobId)",
            method: "DELETE"
        )
    }
    
    // MARK: - Evidence API
    
    /// Upload evidence (photo/document)
    func uploadEvidence(_ evidence: EvidenceUpload) async throws -> EvidenceUpload {
        // TODO: Implement multipart form data upload
        let body = try JSONEncoder().encode(evidence)
        let response: EvidenceResponse = try await request(
            endpoint: "/api/jobs/\(evidence.jobId)/evidence",
            method: "POST",
            body: body
        )
        return response.data
    }
    
    /// Update evidence
    func updateEvidence(_ evidence: EvidenceUpload) async throws -> EvidenceUpload {
        let body = try JSONEncoder().encode(evidence)
        let response: EvidenceResponse = try await request(
            endpoint: "/api/evidence/\(evidence.id)",
            method: "PATCH",
            body: body
        )
        return response.data
    }
    
    /// Delete evidence
    func deleteEvidence(_ evidenceId: String) async throws {
        let _: EmptyResponse = try await request(
            endpoint: "/api/evidence/\(evidenceId)",
            method: "DELETE"
        )
    }
    
    /// Get evidence for a job
    func getEvidence(jobId: String) async throws -> [EvidenceItem] {
        let response: EvidenceListResponse = try await request(
            endpoint: "/api/jobs/\(jobId)/evidence"
        )
        return response.data
    }
    
    /// Get hazards for a job
    func getHazards(jobId: String) async throws -> [Hazard] {
        let response: HazardsResponse = try await request(
            endpoint: "/api/jobs/\(jobId)/hazards"
        )
        return response.data
    }
    
    /// Get controls for a job
    func getControls(jobId: String) async throws -> [Control] {
        let response: ControlsResponse = try await request(
            endpoint: "/api/jobs/\(jobId)/controls"
        )
        return response.data
    }
    
    /// Generate Risk Snapshot PDF
    func generateRiskSnapshot(jobId: String) async throws -> URL {
        // Check if backend returns URL or base64
        let response: PDFResponse = try await request(
            endpoint: "/api/jobs/\(jobId)/export/pdf",
            method: "POST"
        )
        
        // If response has URL, download it
        if let url = response.url, !url.isEmpty {
            return try await downloadPDF(url: url)
        }
        
        // If response has base64, decode it
        if let base64 = response.base64, !base64.isEmpty {
            return try await decodeBase64PDF(base64: base64)
        }
        
        throw APIError.invalidResponse
    }
    
    /// Generate Proof Pack ZIP
    func generateProofPack(jobId: String) async throws -> URL {
        let response: ZIPResponse = try await request(
            endpoint: "/api/jobs/\(jobId)/export/proof-pack",
            method: "POST"
        )
        
        if let url = response.url, !url.isEmpty {
            return try await downloadZIP(url: url)
        }
        
        if let base64 = response.base64, !base64.isEmpty {
            return try await decodeBase64ZIP(base64: base64)
        }
        
        throw APIError.invalidResponse
    }
    
    private func downloadPDF(url: String) async throws -> URL {
        guard let downloadURL = URL(string: url) else {
            throw APIError.invalidURL
        }
        
        let (data, _) = try await URLSession.shared.data(from: downloadURL)
        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("risk-snapshot-\(UUID().uuidString).pdf")
        try data.write(to: tempURL)
        return tempURL
    }
    
    private func downloadZIP(url: String) async throws -> URL {
        guard let downloadURL = URL(string: url) else {
            throw APIError.invalidURL
        }
        
        let (data, _) = try await URLSession.shared.data(from: downloadURL)
        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("proof-pack-\(UUID().uuidString).zip")
        try data.write(to: tempURL)
        return tempURL
    }
    
    private func decodeBase64PDF(base64: String) async throws -> URL {
        guard let data = Data(base64Encoded: base64) else {
            throw APIError.decodingError
        }
        
        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("risk-snapshot-\(UUID().uuidString).pdf")
        try data.write(to: tempURL)
        return tempURL
    }
    
    private func decodeBase64ZIP(base64: String) async throws -> URL {
        guard let data = Data(base64Encoded: base64) else {
            throw APIError.decodingError
        }
        
        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("proof-pack-\(UUID().uuidString).zip")
        try data.write(to: tempURL)
        return tempURL
    }
}

struct EvidenceListResponse: Codable {
    let data: [EvidenceItem]
}

struct HazardsResponse: Codable {
    let data: [Hazard]
}

struct ControlsResponse: Codable {
    let data: [Control]
}

struct PDFResponse: Codable {
    let url: String?
    let base64: String?
    let hash: String?
    let generatedAt: String?
    
    enum CodingKeys: String, CodingKey {
        case url = "pdf_url"
        case base64 = "pdf_base64"
        case hash
        case generatedAt = "generated_at"
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        url = try? container.decode(String.self, forKey: .url)
        base64 = try? container.decode(String.self, forKey: .base64)
        hash = try? container.decode(String.self, forKey: .hash)
        generatedAt = try? container.decode(String.self, forKey: .generatedAt)
    }
}

struct ZIPResponse: Codable {
    let url: String?
    let base64: String?
    let hash: String?
    let generatedAt: String?
    
    enum CodingKeys: String, CodingKey {
        case url = "zip_url"
        case base64 = "zip_base64"
        case hash
        case generatedAt = "generated_at"
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        url = try? container.decode(String.self, forKey: .url)
        base64 = try? container.decode(String.self, forKey: .base64)
        hash = try? container.decode(String.self, forKey: .hash)
        generatedAt = try? container.decode(String.self, forKey: .generatedAt)
    }
}

struct JobsListResponse: Codable {
    let data: [Job]
    let pagination: JobsPagination?
}

struct JobsPagination: Codable {
    let page: Int?
    let pageSize: Int?
    let total: Int?
    let totalPages: Int?
    let hasMore: Bool?
    
    enum CodingKeys: String, CodingKey {
        case page
        case pageSize = "page_size"
        case total
        case totalPages = "total_pages"
        case hasMore = "has_more"
    }
}

struct JobResponse: Codable {
    let data: Job
}

struct AuditEventsResponse: Codable {
    let events: [AuditEventAPI]
    let stats: AuditStats?
    let pagination: AuditPagination?
}

// API response structure for audit events
struct AuditEventAPI: Codable {
    let id: String
    let category: String?
    let eventName: String?
    let summary: String?
    let createdAt: String
    let details: String?
    let actorName: String?
    let actorRole: String?
    let metadata: [String: String]?
    let outcome: String?
    let severity: String?
    
    enum CodingKeys: String, CodingKey {
        case id
        case category
        case eventName = "event_name"
        case summary
        case createdAt = "created_at"
        case details
        case actorName = "actor_name"
        case actorRole = "actor_role"
        case metadata
        case outcome
        case severity
    }
    
    func toAuditEvent() -> AuditEvent {
        // Parse ISO8601 date string
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var date = formatter.date(from: createdAt)
        
        // Fallback to standard ISO8601 if fractional seconds fail
        if date == nil {
            let standardFormatter = ISO8601DateFormatter()
            date = standardFormatter.date(from: createdAt)
        }
        
        // Final fallback to current date
        let finalDate = date ?? Date()
        
        // Convert metadata to [String: String] if needed
        var finalMetadata: [String: String] = [:]
        if let metadata = metadata {
            for (key, value) in metadata {
                finalMetadata[key] = String(describing: value)
            }
        }
        
        return AuditEvent(
            id: id,
            category: category?.uppercased() ?? "OPS",
            summary: summary ?? eventName ?? "Unknown event",
            timestamp: finalDate,
            details: details ?? "",
            actor: actorName ?? "System",
            metadata: finalMetadata
        )
    }
}

struct AuditStats: Codable {
    let total: Int?
    let violations: Int?
    let jobsTouched: Int?
    
    enum CodingKeys: String, CodingKey {
        case total
        case violations
        case jobsTouched = "jobs_touched"
    }
}

struct AuditPagination: Codable {
    let nextCursor: String?
    let limit: Int?
    let hasMore: Bool?
    
    enum CodingKeys: String, CodingKey {
        case nextCursor = "next_cursor"
        case limit
        case hasMore = "has_more"
    }
}

struct ExecutivePostureWrapper: Codable {
    let data: ExecutivePostureResponse
}

struct ExecutiveBriefResponse: Codable {
    let data: ExecutiveBriefData
}

struct ExecutiveBriefData: Codable {
    let generatedAt: String
    let timeRange: String
    let summary: ExecutiveSummary
    let riskScore: Int
    let totalJobs: Int
    let highRiskJobs: Int
    let controlsCompleted: Int
    let controlsTotal: Int
    let evidenceCount: Int
    let lastExportDate: String?
    
    enum CodingKeys: String, CodingKey {
        case generatedAt = "generated_at"
        case timeRange = "time_range"
        case summary
        case riskScore = "risk_score"
        case totalJobs = "total_jobs"
        case highRiskJobs = "high_risk_jobs"
        case controlsCompleted = "controls_completed"
        case controlsTotal = "controls_total"
        case evidenceCount = "evidence_count"
        case lastExportDate = "last_export_date"
    }
}

struct ExecutiveSummary: Codable {
    let exposureLevel: String
    let confidenceStatement: String
    let counts: ExecutiveCounts
    
    enum CodingKeys: String, CodingKey {
        case exposureLevel = "exposure_level"
        case confidenceStatement = "confidence_statement"
        case counts
    }
}

struct ExecutiveCounts: Codable {
    let highRiskJobs: Int
    let openIncidents: Int
    let violations: Int
    let flagged: Int
    let pendingAttestations: Int
    let signedAttestations: Int
    let proofPacks: Int
    
    enum CodingKeys: String, CodingKey {
        case highRiskJobs = "high_risk_jobs"
        case openIncidents = "open_incidents"
        case violations
        case flagged
        case pendingAttestations = "pending_attestations"
        case signedAttestations = "signed_attestations"
        case proofPacks = "proof_packs"
    }
}

struct EvidenceResponse: Codable {
    let data: EvidenceUpload
}

struct EmptyResponse: Codable {}

// MARK: - Error Types

enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case httpError(statusCode: Int, message: String)
    case decodingError
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid API URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .httpError(let statusCode, let message):
            return "\(message) (Status: \(statusCode))"
        case .decodingError:
            return "Failed to decode response"
        }
    }
}

struct APIErrorResponse: Codable {
    let message: String?
    let code: String?
}

// MARK: - Error Categorization

extension APIError {
    var category: ErrorCategory {
        switch self {
        case .invalidURL, .invalidResponse:
            return .client
        case .httpError(let statusCode, _):
            return errorCategory(for: statusCode)
        case .decodingError:
            return .client
        }
    }
}

enum ErrorCategory {
    case auth // 401/403
    case client // 4xx (except auth)
    case server // 5xx
    case timeout
    case network
}

func errorCategory(for statusCode: Int) -> ErrorCategory {
    switch statusCode {
    case 401, 403:
        return .auth
    case 408, 504:
        return .timeout
    case 400...499:
        return .client
    case 500...599:
        return .server
    default:
        return .client
    }
}

// InviteRequest is defined in Team.swift
