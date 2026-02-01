import Foundation

/// API client for Riskmate backend
class APIClient {
    static let shared = APIClient()
    
    private let baseURL: String
    private let authService: AuthService
    
    private init() {
        self.baseURL = AppConfig.shared.backendURL
        self.authService = AuthService.shared
    }
    
    /// Get stable device ID (Keychain-stored UUID, fallback to identifierForVendor)
    private func getStableDeviceID() -> String {
        let keychainKey = "com.riskmate.device_id"
        
        // Try to read from Keychain first
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: keychainKey,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        if status == errSecSuccess,
           let data = result as? Data,
           let deviceId = String(data: data, encoding: .utf8) {
            return deviceId
        }
        
        // Generate new UUID and store in Keychain
        let newDeviceId = UUID().uuidString
        let storeQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: keychainKey,
            kSecValueData as String: newDeviceId.data(using: .utf8)!
        ]
        
        // Delete any existing item first
        SecItemDelete(storeQuery as CFDictionary)
        // Store new device ID
        SecItemAdd(storeQuery as CFDictionary, nil)
        
        return newDeviceId
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
        
        // Set client metadata headers (consistent across all requests)
        request.setValue("ios", forHTTPHeaderField: "x-client")
        
        // Get app version from bundle
        if let shortVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String,
           let buildNumber = Bundle.main.infoDictionary?["CFBundleVersion"] as? String {
            request.setValue("\(shortVersion)(\(buildNumber))", forHTTPHeaderField: "x-app-version")
        }
        
        // Get stable device ID (use Keychain-stored UUID, fallback to identifierForVendor)
        let deviceId = getStableDeviceID()
        request.setValue(deviceId, forHTTPHeaderField: "x-device-id")
        
        // Set timeout based on operation type
        if endpoint.contains("export") {
            request.timeoutInterval = 120.0 // 2 minutes for exports
        } else {
            request.timeoutInterval = 30.0 // 30 seconds for normal requests
        }
        
        // Add auth token (required for all requests)
        // CRITICAL: Only use Supabase session.accessToken (JWT format: eyJ...xxx.yyy.zzz)
        // Always fetch fresh token right before request to avoid stale tokens
        do {
            guard let token = try await authService.getAccessToken() else {
                print("[APIClient] ❌ No authentication token available - user may need to log in")
                throw APIError.httpError(statusCode: 401, message: "No authentication token available - please log in")
            }
            
            // Double-check token format before attaching (should already be validated in AuthService)
            let parts = token.split(separator: ".")
            guard parts.count == 3 && token.hasPrefix("eyJ") else {
                print("[APIClient] ❌ CRITICAL: Token is not a valid JWT! Not attaching to request.")
                print("[APIClient] ❌ Token preview: \(String(token.prefix(30)))..., parts: \(parts.count)")
                print("[APIClient] ❌ Expected: 3 dot-separated parts starting with 'eyJ'")
                throw NSError(
                    domain: "APIClient",
                    code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "Token is not a valid JWT format (expected 3 parts starting with 'eyJ', got \(parts.count) parts)"]
                )
            }
            
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            
            // Logging (safe): only log in DEBUG builds, never full token
            #if DEBUG
            let preview = String(token.prefix(20))
            print("[APIClient] ✅ Auth token attached (length: \(token.count), preview: \(preview)…)")
            print("[APIClient] ✅ Token format verified: JWT (3 parts, starts with eyJ)")
            #endif
        } catch {
            print("[APIClient] ❌ Failed to get valid auth token: \(error.localizedDescription)")
            // Re-throw AuthService errors as-is (they have better messages)
            if let nsError = error as NSError? {
                throw APIError.httpError(statusCode: 401, message: nsError.localizedDescription)
            }
            throw APIError.httpError(statusCode: 401, message: "Failed to get authentication token: \(error.localizedDescription)")
        }
        
        if let body = body {
            request.httpBody = body
        }
        
        // Always log request details (production-ready logging)
        print("[APIClient] 🔵 \(method) \(fullURL)")
        print("[APIClient] Base URL: \(baseURL)")
        print("[APIClient] Path: \(path)")
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                print("[APIClient] ❌ Invalid response (not HTTPURLResponse)")
                throw APIError.invalidResponse
            }
            
            // Always log response status and content-type BEFORE attempting decode
            let statusCode = httpResponse.statusCode
            let contentType = httpResponse.value(forHTTPHeaderField: "Content-Type") ?? "nil"
            let finalURL = httpResponse.url?.absoluteString ?? "unknown"
            
            print("[APIClient] 📡 Response: \(statusCode) for \(method) \(path)")
            print("[APIClient] Final URL: \(finalURL)")
            print("[APIClient] Content-Type: \(contentType)")
            
            // Log raw response body BEFORE decoding (this is the truth serum)
            let rawBody = String(data: data, encoding: .utf8) ?? "<non-utf8 data>"
            let bodyPreview = String(rawBody.prefix(500))
            print("[APIClient] Raw response body (first 500 chars): \(bodyPreview)")
            
            // Detect HTML responses (common cause of decode failures)
            if contentType.contains("text/html") || rawBody.lowercased().hasPrefix("<!doctype html") || rawBody.lowercased().hasPrefix("<html") {
                print("[APIClient] ⚠️ WARNING: Received HTML instead of JSON! This usually means:")
                print("[APIClient]   1. Wrong base URL (using www.riskmate.dev instead of api.riskmate.dev)")
                print("[APIClient]   2. Redirect to web page")
                print("[APIClient]   3. Double-appended /api in URL")
                print("[APIClient]   Current base URL: \(baseURL)")
            }
            
            // Don't attempt to decode non-2xx responses (they're likely error pages or JSON errors)
            guard (200...299).contains(statusCode) else {
                // Special handling for 401: force logout and set auth state
                if statusCode == 401 {
                    print("[APIClient] ❌ 401 Unauthorized — forcing logout")
                    
                    // Force logout and clear auth state (this triggers UI to show login)
                    // SessionManager is @MainActor, so we need to call logout on main actor
                    Task { @MainActor in
                        await SessionManager.shared.logout()
                    }
                    
                    // Don't attempt to decode 401 body - just throw and let UI handle logout state
                    throw APIError.unauthorized
                }
                
                // For other errors, log and throw
                print("[APIClient] ❌ Error response (status \(statusCode))")
                
                // Try to decode error JSON
                if let errorMessage = try? JSONDecoder().decode(APIErrorResponse.self, from: data) {
                    let error = APIError.httpError(
                        statusCode: statusCode,
                        message: errorMessage.message ?? "Request failed with status \(statusCode)"
                    )
                    print("[APIClient] Error category: \(errorCategory(for: statusCode))")
                    throw error
                } else {
                    // If it's not JSON (could be HTML error page, etc.), throw with raw body
                    let error = APIError.httpError(
                        statusCode: statusCode,
                        message: "Request failed with status \(statusCode) - response was not JSON: \(bodyPreview.prefix(200))"
                    )
                    print("[APIClient] Error category: \(errorCategory(for: statusCode))")
                    throw error
                }
            }
            
            // Only attempt decode for 2xx responses
            let decoder = JSONDecoder()
            // Use default key decoding strategy (no automatic snake_case conversion)
            // We use explicit CodingKeys with snake_case mappings in all models
            decoder.keyDecodingStrategy = .useDefaultKeys
            
            // Custom date decoder to handle fractional seconds (Supabase/Node often returns these)
            decoder.dateDecodingStrategy = .custom { decoder in
                let container = try decoder.singleValueContainer()
                let dateString = try container.decode(String.self)
                
                // Try with fractional seconds first
                let fractionalFormatter = ISO8601DateFormatter()
                fractionalFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                if let date = fractionalFormatter.date(from: dateString) {
                    return date
                }
                
                // Fallback to standard ISO8601 (no fractional seconds)
                let standardFormatter = ISO8601DateFormatter()
                if let date = standardFormatter.date(from: dateString) {
                    return date
                }
                
                // Final fallback: try RFC3339
                let rfc3339Formatter = ISO8601DateFormatter()
                rfc3339Formatter.formatOptions = [.withInternetDateTime]
                if let date = rfc3339Formatter.date(from: dateString) {
                    return date
                }
                
                throw DecodingError.dataCorruptedError(
                    in: container,
                    debugDescription: "Invalid date format: \(dateString)"
                )
            }
            
            // Attempt decode - if it fails, log raw response for debugging
            do {
                return try decoder.decode(T.self, from: data)
            } catch let decodeError as DecodingError {
                // Log decoding error with raw response for debugging
                print("[APIClient] ❌ Decoding error: \(decodeError)")
                print("[APIClient] Raw response body (first 800 chars): \(bodyPreview)")
                
                // Build detailed error message
                let errorDescription: String
                switch decodeError {
                case .typeMismatch(let type, let context):
                    errorDescription = "Type mismatch: expected \(type) at \(context.codingPath.map { $0.stringValue }.joined(separator: "."))"
                case .valueNotFound(let type, let context):
                    errorDescription = "Value not found: expected \(type) at \(context.codingPath.map { $0.stringValue }.joined(separator: "."))"
                case .keyNotFound(let key, let context):
                    errorDescription = "Key not found: '\(key.stringValue)' at \(context.codingPath.map { $0.stringValue }.joined(separator: ".")). Available keys in JSON: check raw body above."
                case .dataCorrupted(let context):
                    errorDescription = "Data corrupted at \(context.codingPath.map { $0.stringValue }.joined(separator: ".")): \(context.debugDescription)"
                @unknown default:
                    errorDescription = "Unknown decoding error: \(decodeError)"
                }
                
                // Throw with detailed error message instead of generic .decodingError
                throw APIError.httpError(statusCode: 0, message: "Decoding failed: \(errorDescription)")
            }
        } catch let urlError as URLError {
            // Handle network-level errors (offline, timeout, DNS, etc.)
            let errorCategory: ErrorCategory
            let errorMessage: String
            
            switch urlError.code {
            case .timedOut:
                errorCategory = .timeout
                errorMessage = "Request timed out. Please check your connection and try again."
            case .notConnectedToInternet, .networkConnectionLost:
                errorCategory = .network
                errorMessage = "No internet connection. Please check your network settings."
            case .cannotFindHost, .cannotConnectToHost:
                errorCategory = .network
                errorMessage = "Cannot reach server. Please check your connection."
            case .dnsLookupFailed:
                errorCategory = .network
                errorMessage = "DNS lookup failed. Please check your connection."
            default:
                errorCategory = .network
                errorMessage = "Network error: \(urlError.localizedDescription)"
            }
            
            print("[APIClient] ❌ Network error: \(urlError.code.rawValue) - \(urlError.localizedDescription)")
            print("[APIClient] Error category: \(errorCategory)")
            
            throw APIError.networkError(category: errorCategory, message: errorMessage, underlyingError: urlError)
        } catch {
            // Re-throw APIError as-is
            if let apiError = error as? APIError {
                throw apiError
            }
            
            // Don't wrap unknown errors as decodingError - pass them through
            // This allows unauthorized/network errors to surface properly
            print("[APIClient] ❌ Unexpected error: \(error.localizedDescription)")
            throw error
        }
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
    
    /// Deactivate account (delete account)
    func deactivateAccount(confirmation: String, reason: String? = nil) async throws -> DeactivateAccountResponse {
        var bodyDict: [String: Any] = ["confirmation": confirmation]
        if let reason = reason {
            bodyDict["reason"] = reason
        }
        let body = try JSONSerialization.data(withJSONObject: bodyDict)
        let response: DeactivateAccountResponse = try await request(
            endpoint: "/api/account/deactivate",
            method: "POST",
            body: body
        )
        return response
    }
    
    /// Get entitlements (single source of truth for plan, limits, features)
    func getEntitlements() async throws -> EntitlementsResponse {
        return try await request(endpoint: "/api/account/entitlements")
    }
    
    /// Log event to backend (unified event logging for iOS ↔ web parity)
    /// Both iOS and web call this to ensure all actions are tracked in audit_logs
    func logEvent(
        eventType: String,
        entityType: String,
        entityId: String? = nil,
        metadata: [String: Any]? = nil
    ) async throws -> EventLogResponse {
        var bodyDict: [String: Any] = [
            "event_type": eventType,
            "entity_type": entityType,
            "client": "ios",
        ]
        
        if let entityId = entityId {
            bodyDict["entity_id"] = entityId
        }
        
        if let metadata = metadata {
            bodyDict["metadata"] = metadata
        }
        
        // Add app version if available
        if let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String {
            bodyDict["app_version"] = version
        }
        
        let body = try JSONSerialization.data(withJSONObject: bodyDict)
        return try await request(
            endpoint: "/api/audit/events",
            method: "POST",
            body: body
        )
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
        return response.data.events.map { $0.toAuditEvent() }
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

    /// Change a team member's role (Admin+). Logs user_role_changed to audit. Backend enforces only Owner can set Owner.
    func changeUserRole(userId: String, newRole: TeamRole, reason: String?) async throws {
        struct ChangeRoleRequest: Encodable {
            let new_role: String
            let reason: String?
        }
        struct ChangeRoleResponse: Codable {
            let message: String?
            let user_id: String?
            let old_role: String?
            let new_role: String?
        }
        let body = try JSONEncoder().encode(ChangeRoleRequest(new_role: newRole.rawValue, reason: reason))
        let _: ChangeRoleResponse = try await request(
            endpoint: "/api/team/member/\(userId)/role",
            method: "PATCH",
            body: body
        )
    }
    
    // MARK: - Dashboard API
    
    /// Get dashboard summary (KPIs, jobs at risk, missing evidence, chart data)
    /// Single endpoint to eliminate N+1 queries
    func getDashboardSummary() async throws -> DashboardSummaryResponse {
        return try await request(endpoint: "/api/dashboard/summary")
    }
    
    /// Get top hazards (aggregated, no per-job loops)
    func getTopHazards() async throws -> [Hazard] {
        let response: HazardsResponse = try await request(endpoint: "/api/dashboard/top-hazards")
        return response.data
    }
    
    // MARK: - Health Check API
    
    /// Check backend health (no auth required)
    func checkHealth() async throws -> BackendHealthResponse {
        let base = baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let fullURL = "\(base)/health"
        
        guard let url = URL(string: fullURL) else {
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 10.0
        
        print("[APIClient] 🔵 GET \(fullURL) (health check, no auth)")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        print("[APIClient] 📡 Health check response: \(httpResponse.statusCode)")
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(
                statusCode: httpResponse.statusCode,
                message: "Health check failed with status \(httpResponse.statusCode)"
            )
        }
        
        let decoder = JSONDecoder()
        return try decoder.decode(BackendHealthResponse.self, from: data)
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
        #if DEBUG
        // Debug: Print call stack to identify duplicate callers
        print("[APIClient] 🧭 getJobs() called from:")
        print(Thread.callStackSymbols.prefix(10).joined(separator: "\n"))
        #endif
        
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
        
        // Log event for iOS ↔ web parity
        Task {
            _ = try? await logEvent(
                eventType: "job.created",
                entityType: "job",
                entityId: response.data.id,
                metadata: ["job_id": response.data.id]
            )
            // Refresh entitlements after job creation (in case limits changed)
            await EntitlementsManager.shared.refresh()
        }
        
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
        
        // Log event for iOS ↔ web parity
        Task {
            _ = try? await logEvent(
                eventType: "job.updated",
                entityType: "job",
                entityId: response.data.id,
                metadata: ["job_id": response.data.id]
            )
            // Refresh entitlements after job update
            await EntitlementsManager.shared.refresh()
        }
        
        return response.data
    }
    
    /// Delete a job
    func deleteJob(_ jobId: String) async throws {
        let _: EmptyResponse = try await request(
            endpoint: "/api/jobs/\(jobId)",
            method: "DELETE"
        )
        
        // Log event for iOS ↔ web parity
        Task {
            _ = try? await logEvent(
                eventType: "job.deleted",
                entityType: "job",
                entityId: jobId
            )
            // Refresh entitlements after job deletion
            await EntitlementsManager.shared.refresh()
        }
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

    /// List exports for a job (export history)
    func getExports(jobId: String) async throws -> [Export] {
        let response: ExportsListResponse = try await request(
            endpoint: "/api/jobs/\(jobId)/exports"
        )
        return response.data
    }

    /// Create a new export (PDF or Proof Pack). Used for retry from export history.
    func createExport(jobId: String, type: ExportType) async throws {
        let path: String
        switch type {
        case .pdf: path = "/api/jobs/\(jobId)/export/pdf"
        case .proofPack: path = "/api/jobs/\(jobId)/export/proof-pack"
        }
        let _: CreateExportResponse = try await request(endpoint: path, method: "POST")
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
        
        // Use authenticated request for downloads (in case backend requires auth)
        var request = URLRequest(url: downloadURL)
        
        // Add auth token if available
        do {
            if let token = try await authService.getAccessToken() {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
        } catch {
            print("[APIClient] ⚠️ Could not get auth token for download, proceeding without it")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        // Check response status
        if let httpResponse = response as? HTTPURLResponse, !(200...299).contains(httpResponse.statusCode) {
            throw APIError.httpError(
                statusCode: httpResponse.statusCode,
                message: "Failed to download PDF: HTTP \(httpResponse.statusCode)"
            )
        }
        
        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("risk-snapshot-\(UUID().uuidString).pdf")
        try data.write(to: tempURL)
        return tempURL
    }
    
    private func downloadZIP(url: String) async throws -> URL {
        guard let downloadURL = URL(string: url) else {
            throw APIError.invalidURL
        }
        
        // Use authenticated request for downloads (in case backend requires auth)
        var request = URLRequest(url: downloadURL)
        
        // Add auth token if available
        do {
            if let token = try await authService.getAccessToken() {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
        } catch {
            print("[APIClient] ⚠️ Could not get auth token for download, proceeding without it")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        // Check response status
        if let httpResponse = response as? HTTPURLResponse, !(200...299).contains(httpResponse.statusCode) {
            throw APIError.httpError(
                statusCode: httpResponse.statusCode,
                message: "Failed to download ZIP: HTTP \(httpResponse.statusCode)"
            )
        }
        
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

struct Export: Codable, Identifiable, Equatable {
    let id: String
    let exportType: String
    let state: String
    let failureReason: String?
    let createdAt: Date
    let completedAt: Date?
    let downloadUrl: String?

    enum CodingKeys: String, CodingKey {
        case id
        case exportType = "export_type"
        case state
        case failureReason = "failure_reason"
        case createdAt = "created_at"
        case completedAt = "completed_at"
        case downloadUrl = "download_url"
    }
}

struct ExportsListResponse: Codable {
    let data: [Export]
}

struct CreateExportResponse: Codable {
    let data: CreateExportData
    struct CreateExportData: Codable {
        let id: String
    }
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

// MARK: - Dashboard API Response Models

struct DashboardSummaryResponse: Codable {
    let data: DashboardSummaryData
}

struct DashboardSummaryData: Codable {
    let kpis: DashboardKPIsAPI
    let jobsAtRisk: [Job]
    let missingEvidenceJobs: [Job]
    let chartData: [ChartDataPointAPI]
    
    enum CodingKeys: String, CodingKey {
        case kpis
        case jobsAtRisk = "jobs_at_risk"
        case missingEvidenceJobs = "missing_evidence_jobs"
        case chartData = "chart_data"
    }
}

struct DashboardKPIsAPI: Codable {
    let complianceScore: Int
    let complianceTrend: String
    let openRisks: Int
    let risksTrend: String
    let jobsThisWeek: Int
    let jobsTrend: String
    
    enum CodingKeys: String, CodingKey {
        case complianceScore = "compliance_score"
        case complianceTrend = "compliance_trend"
        case openRisks = "open_risks"
        case risksTrend = "risks_trend"
        case jobsThisWeek = "jobs_this_week"
        case jobsTrend = "jobs_trend"
    }
}

struct ChartDataPointAPI: Codable {
    let date: String
    let value: Int
}

struct JobResponse: Codable {
    let data: Job
}

struct AuditEventsResponse: Codable {
    let data: AuditEventsData
}

struct AuditEventsData: Codable {
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
    let metadata: [String: RMAnyCodable]  // Non-optional with default empty dict in custom decoder
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
    
    // Custom decoder to handle metadata defensively (can be null, missing, or malformed)
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        category = try container.decodeIfPresent(String.self, forKey: .category)
        eventName = try container.decodeIfPresent(String.self, forKey: .eventName)
        summary = try container.decodeIfPresent(String.self, forKey: .summary)
        createdAt = try container.decode(String.self, forKey: .createdAt)
        details = try container.decodeIfPresent(String.self, forKey: .details)
        actorName = try container.decodeIfPresent(String.self, forKey: .actorName)
        actorRole = try container.decodeIfPresent(String.self, forKey: .actorRole)
        // Defensive metadata decoding: default to empty dict if null/missing/malformed
        metadata = (try? container.decode([String: RMAnyCodable].self, forKey: .metadata)) ?? [:]
        outcome = try container.decodeIfPresent(String.self, forKey: .outcome)
        severity = try container.decodeIfPresent(String.self, forKey: .severity)
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
        
        // Convert metadata from [String: AnyCodable] to [String: String]
        // Handles nested objects, arrays, null values, and primitive values
        var finalMetadata: [String: String] = [:]
        for (key, anyCodable) in metadata {  // metadata is non-optional, no unwrapping needed
            // Handle null values
            if anyCodable.value is NSNull {
                finalMetadata[key] = "null"
                continue
            }
            
            // Handle nested objects (like "subject": {"id": "...", "type": "..."})
            if let nestedDict = anyCodable.value as? [String: Any] {
                // Flatten nested dictionary keys
                for (nestedKey, nestedValue) in nestedDict {
                    finalMetadata["\(key).\(nestedKey)"] = String(describing: nestedValue)
                }
                // Also keep the original key with a stringified version
                let dictString = nestedDict.map { "\($0.key)=\($0.value)" }.joined(separator: ", ")
                finalMetadata[key] = "{\(dictString)}"
            } else if let array = anyCodable.value as? [Any] {
                // Handle arrays
                finalMetadata[key] = "[\(array.map { String(describing: $0) }.joined(separator: ", "))]"
            } else {
                // Handle primitives (String, Int, Bool, Double, Float, Int64, etc.)
                finalMetadata[key] = String(describing: anyCodable.value)
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

// Backend health response (different from ServerStatusManager's HealthResponse)
struct BackendHealthResponse: Codable {
    let status: String
    let timestamp: String?
    let commit: String?
    let service: String?
    let version: String?
    let environment: String?
    let deployment: String?
    let db: String?
}

// MARK: - Error Types

enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case unauthorized
    case httpError(statusCode: Int, message: String)
    case networkError(category: ErrorCategory, message: String, underlyingError: URLError)
    case decodingError
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid API URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .unauthorized:
            return "Unauthorized - please log in"
        case .httpError(let statusCode, let message):
            return "\(message) (Status: \(statusCode))"
        case .networkError(_, let message, _):
            return message
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
        case .unauthorized:
            return .auth
        case .httpError(let statusCode, _):
            return errorCategory(for: statusCode)
        case .networkError(let category, _, _):
            return category
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
