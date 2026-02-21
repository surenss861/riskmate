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

    // MARK: - Sync API (offline batch sync)

    /// POST /api/sync/batch - Upload pending operations
    func syncBatch(operations: [SyncOperation]) async throws -> BatchSyncResponse {
        let items = operations.map { $0.toBatchRequestItem() }
        let body = try JSONSerialization.data(withJSONObject: ["operations": items])
        let response: BatchSyncResponse = try await request(
            endpoint: "/api/sync/batch",
            method: "POST",
            body: body
        )
        return response
    }

    /// GET /api/sync/changes?since=... - Incremental sync with pagination
    /// Pages through jobs and mitigation_items (entity param) until has_more is false for each
    func getSyncChanges(since: Date) async throws -> SyncChangesResult {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        formatter.timeZone = TimeZone(identifier: "UTC")
        let sinceStr = formatter.string(from: since)
        let encoded = sinceStr.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? sinceStr
        let limit = 500
        var allJobs: [Job] = []
        var allDeletedJobIds: Set<String> = []
        var allMitigation: [SyncMitigationItem] = []
        var allDeletedMitigationIds: Set<String> = []
        var offset = 0
        repeat {
            let url = "/api/sync/changes?since=\(encoded)&limit=\(limit)&offset=\(offset)&entity=jobs"
            let response: SyncChangesResponse = try await request(endpoint: url)
            allJobs.append(contentsOf: response.data)
            if let ids = response.deletedJobIds {
                allDeletedJobIds.formUnion(ids)
            }
            guard let pag = response.pagination, pag.hasMore, let next = pag.nextOffset else { break }
            offset = next
        } while true
        offset = 0
        repeat {
            let url = "/api/sync/changes?since=\(encoded)&limit=\(limit)&offset=\(offset)&entity=mitigation_items"
            let response: SyncChangesResponse = try await request(endpoint: url)
            if let items = response.mitigationItems {
                allMitigation.append(contentsOf: items)
            }
            if let ids = response.deletedMitigationIds {
                allDeletedMitigationIds.formUnion(ids)
            }
            guard let pag = response.pagination, pag.hasMore, let next = pag.nextOffset else { break }
            offset = next
        } while true
        return SyncChangesResult(jobs: allJobs, mitigationItems: allMitigation, deletedMitigationIds: allDeletedMitigationIds, deletedJobIds: allDeletedJobIds)
    }

    /// POST /api/sync/resolve-conflict - Submit conflict resolution
    /// - Parameters:
    ///   - resolvedValue: Required for local_wins and merge - the entity payload to apply server-side
    ///   - entityType: Required for local_wins and merge - e.g. "job", "hazard", "control"
    ///   - entityId: Required for local_wins and merge - target entity id
    ///   - operationType: Required for local_wins and merge - e.g. "update_job", "update_hazard"
    func resolveSyncConflict(
        operationId: String,
        strategy: ConflictResolutionStrategy,
        resolvedValue: [String: Any]? = nil,
        entityType: String? = nil,
        entityId: String? = nil,
        operationType: String? = nil
    ) async throws -> ResolveConflictResponse {
        var body: [String: Any] = [
            "operation_id": operationId,
            "strategy": strategy.rawValue,
        ]
        if let resolvedValue = resolvedValue {
            body["resolved_value"] = resolvedValue
        }
        if let entityType = entityType {
            body["entity_type"] = entityType
        }
        if let entityId = entityId {
            body["entity_id"] = entityId
        }
        if let operationType = operationType {
            body["operation_type"] = operationType
        }
        let data = try JSONSerialization.data(withJSONObject: body)
        return try await request(
            endpoint: "/api/sync/resolve-conflict",
            method: "POST",
            body: data
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

    // MARK: - Notifications (push token)

    /// Register push token with backend (POST /api/notifications/register).
    func registerPushToken(token: String, platform: String = "ios") async throws {
        struct RegisterBody: Encodable {
            let token: String
            let platform: String
        }
        let body = try JSONEncoder().encode(RegisterBody(token: token, platform: platform))
        let _: EmptyResponse = try await request(
            endpoint: "/api/notifications/register",
            method: "POST",
            body: body
        )
    }

    /// Unregister push token (DELETE /api/notifications/register with body).
    func unregisterPushToken(token: String) async throws {
        struct UnregisterBody: Encodable {
            let token: String
        }
        let body = try JSONEncoder().encode(UnregisterBody(token: token))
        let _: EmptyResponse = try await request(
            endpoint: "/api/notifications/register",
            method: "DELETE",
            body: body
        )
    }

    /// Notification item from GET /api/notifications. deepLink is used for navigation on row tap.
    /// JSON keys: id, type, content, is_read, created_at, deep_link (maps to deepLink).
    struct NotificationItem: Codable, Identifiable {
        let id: String
        let type: String
        let content: String
        let is_read: Bool
        let created_at: String
        let deepLink: String?

        enum CodingKeys: String, CodingKey {
            case id
            case type
            case content
            case is_read
            case created_at
            case deepLink
            case deepLinkSnake = "deep_link"
        }

        init(id: String, type: String, content: String, is_read: Bool, created_at: String, deepLink: String?) {
            self.id = id
            self.type = type
            self.content = content
            self.is_read = is_read
            self.created_at = created_at
            self.deepLink = deepLink
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id = try c.decode(String.self, forKey: .id)
            type = try c.decode(String.self, forKey: .type)
            content = try c.decode(String.self, forKey: .content)
            is_read = try c.decode(Bool.self, forKey: .is_read)
            created_at = try c.decode(String.self, forKey: .created_at)
            deepLink = try c.decodeIfPresent(String.self, forKey: .deepLink)
                ?? (try? c.decodeIfPresent(String.self, forKey: .deepLinkSnake))
        }

        func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: CodingKeys.self)
            try c.encode(id, forKey: .id)
            try c.encode(type, forKey: .type)
            try c.encode(content, forKey: .content)
            try c.encode(is_read, forKey: .is_read)
            try c.encode(created_at, forKey: .created_at)
            try c.encodeIfPresent(deepLink, forKey: .deepLink)
        }
    }

    /// List notifications (GET /api/notifications). Supports pagination and optional since (ISO8601 date string, e.g. last 30 days).
    func getNotifications(limit: Int = 50, offset: Int = 0, since: String? = nil) async throws -> [NotificationItem] {
        struct ListResponse: Decodable {
            let data: [NotificationItem]
        }
        var query = "limit=\(limit)&offset=\(offset)"
        if let since = since, !since.isEmpty {
            query += "&since=\(since.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? since)"
        }
        let response: ListResponse = try await request(
            endpoint: "/api/notifications?\(query)"
        )
        return response.data
    }

    /// Unread notification count for badge (GET /api/notifications/unread-count).
    func getUnreadNotificationCount() async throws -> Int {
        struct UnreadCountResponse: Decodable {
            let count: Int
        }
        let response: UnreadCountResponse = try await request(
            endpoint: "/api/notifications/unread-count"
        )
        return response.count
    }

    /// Set notifications read state (PATCH /api/notifications/read). Pass read: true to mark read, read: false to mark unread. Pass nil or empty ids to apply to all.
    func setNotificationsReadState(ids: [String]? = nil, read: Bool) async throws {
        struct MarkReadBody: Encodable {
            let ids: [String]?
            let read: Bool
        }
        let body = try JSONEncoder().encode(MarkReadBody(ids: ids, read: read))
        let _: EmptyResponse = try await request(
            endpoint: "/api/notifications/read",
            method: "PATCH",
            body: body
        )
    }

    /// Mark notifications as read (PATCH /api/notifications/read). Pass nil or empty to mark all for current user.
    func markNotificationsAsRead(ids: [String]? = nil) async throws {
        try await setNotificationsReadState(ids: ids, read: true)
    }

    /// Mark notifications as unread (PATCH /api/notifications/read with read: false).
    func markNotificationsAsUnread(ids: [String]) async throws {
        try await setNotificationsReadState(ids: ids.isEmpty ? nil : ids, read: false)
    }

    /// Notification preferences (GET /api/notifications/preferences). Contract keys: job_assigned, signature_requested, deadline_approaching, mention, etc.
    /// All JSON keys use snake_case (push_enabled, email_enabled, job_assigned, mention, etc.).
    struct NotificationPreferences: Codable, Equatable {
        var push_enabled: Bool
        var email_enabled: Bool
        var mention: Bool
        var job_assigned: Bool
        var signature_requested: Bool
        var evidence_uploaded: Bool
        var hazard_added: Bool
        var deadline_approaching: Bool
        var weekly_summary: Bool
        var high_risk_job: Bool
        var report_ready: Bool

        enum CodingKeys: String, CodingKey {
            case push_enabled
            case email_enabled
            case mention
            case job_assigned
            case signature_requested
            case evidence_uploaded
            case hazard_added
            case deadline_approaching
            case weekly_summary
            case high_risk_job
            case report_ready
        }
    }

    /// Get current user's notification preferences (GET /api/notifications/preferences).
    func getNotificationPreferences() async throws -> NotificationPreferences {
        try await request(endpoint: "/api/notifications/preferences")
    }

    /// Update current user's notification preferences (PATCH /api/notifications/preferences).
    func patchNotificationPreferences(_ prefs: NotificationPreferences) async throws -> NotificationPreferences {
        let body = try JSONEncoder().encode(prefs)
        return try await request(
            endpoint: "/api/notifications/preferences",
            method: "PATCH",
            body: body
        )
    }

    /// Update photo category (before/during/after) for a document or evidence item.
    /// docId may be a document id or evidence id (PATCH /api/jobs/:id/documents/:docId).
    func updateDocumentCategory(jobId: String, docId: String, category: String) async throws {
        struct UpdateCategoryBody: Encodable {
            let category: String
        }
        let body = UpdateCategoryBody(category: category)
        let data = try JSONEncoder().encode(body)
        let _: EmptyResponse = try await request(
            endpoint: "/api/jobs/\(jobId)/documents/\(docId)",
            method: "PATCH",
            body: data
        )
    }
    
    /// Get hazards for a job
    func getHazards(jobId: String) async throws -> [Hazard] {
        let response: HazardsResponse = try await request(
            endpoint: "/api/jobs/\(jobId)/hazards"
        )
        return response.data
    }

    /// Get tasks for a job
    func getTasks(jobId: String) async throws -> [APIClientTask] {
        let response: TasksResponse = try await request(
            endpoint: "/api/jobs/\(jobId)/tasks"
        )
        return response.data
    }

    /// Create task for a job
    func createTask(jobId: String, payload: CreateTaskRequest) async throws -> APIClientTask {
        let body = try JSONEncoder().encode(payload)
        let response: TaskResponse = try await request(
            endpoint: "/api/jobs/\(jobId)/tasks",
            method: "POST",
            body: body
        )
        return response.data
    }

    /// Get comments for a job
    func getComments(jobId: String, limit: Int = 50, offset: Int = 0, includeReplies: Bool = false) async throws -> [JobComment] {
        var query = "limit=\(limit)&offset=\(offset)"
        if includeReplies { query += "&include_replies=true" }
        let response: CommentsListResponse = try await request(
            endpoint: "/api/jobs/\(jobId)/comments?\(query)"
        )
        return response.data
    }

    /// Create a comment on a job
    func createComment(jobId: String, content: String, parentId: String? = nil) async throws -> JobComment {
        struct CreateCommentBody: Encodable {
            let content: String
            let parentId: String?

            enum CodingKeys: String, CodingKey {
                case content
                case parentId = "parent_id"
            }
        }
        let body = CreateCommentBody(content: content, parentId: parentId)
        let data = try JSONEncoder().encode(body)
        let response: CreateCommentResponse = try await request(
            endpoint: "/api/jobs/\(jobId)/comments",
            method: "POST",
            body: data
        )
        return response.data
    }

    /// Get replies for a comment (GET /api/comments/:id/replies)
    func getReplies(commentId: String, limit: Int = 50, offset: Int = 0) async throws -> [JobComment] {
        var query = "limit=\(limit)&offset=\(offset)"
        let response: CommentsListResponse = try await request(
            endpoint: "/api/comments/\(commentId)/replies?\(query)"
        )
        return response.data
    }

    /// Create a reply to a comment (POST /api/comments/:id/replies)
    func createReply(commentId: String, content: String) async throws -> JobComment {
        struct CreateReplyBody: Encodable {
            let content: String
        }
        let body = CreateReplyBody(content: content)
        let data = try JSONEncoder().encode(body)
        let response: CreateCommentResponse = try await request(
            endpoint: "/api/comments/\(commentId)/replies",
            method: "POST",
            body: data
        )
        return response.data
    }

    /// Complete a task
    func completeTask(id: String) async throws {
        let _: EmptyResponse = try await request(
            endpoint: "/api/tasks/\(id)/complete",
            method: "POST"
        )
    }

    /// Delete a task
    func deleteTask(id: String) async throws {
        let _: EmptyResponse = try await request(
            endpoint: "/api/tasks/\(id)",
            method: "DELETE"
        )
    }
    
    /// Get controls for a job
    func getControls(jobId: String) async throws -> [Control] {
        let response: ControlsResponse = try await request(
            endpoint: "/api/jobs/\(jobId)/controls"
        )
        return response.data
    }

    /// Create a hazard for a job (online only)
    func createHazard(jobId: String, title: String, description: String = "") async throws -> Hazard {
        struct CreateHazardBody: Encodable {
            let title: String
            let description: String
        }
        let body = CreateHazardBody(title: title, description: description)
        let data = try JSONEncoder().encode(body)
        let response: HazardResponse = try await request(
            endpoint: "/api/jobs/\(jobId)/hazards",
            method: "POST",
            body: data
        )
        return response.data
    }

    /// Create a control for a job linked to a hazard (online only)
    func createControl(jobId: String, hazardId: String, title: String, description: String = "") async throws -> Control {
        struct CreateControlBody: Encodable {
            let hazard_id: String
            let title: String
            let description: String
        }
        let body = CreateControlBody(hazard_id: hazardId, title: title, description: description)
        let data = try JSONEncoder().encode(body)
        let response: ControlResponse = try await request(
            endpoint: "/api/jobs/\(jobId)/controls",
            method: "POST",
            body: data
        )
        return response.data
    }

    /// Update mitigation (control) completion status - PATCH /api/jobs/:id/mitigations/:mitigationId
    func updateMitigation(jobId: String, mitigationId: String, done: Bool) async throws {
        struct UpdateMitigationBody: Encodable {
            let done: Bool
        }
        let body = UpdateMitigationBody(done: done)
        let data = try JSONEncoder().encode(body)
        let _: EmptyResponse = try await request(
            endpoint: "/api/jobs/\(jobId)/mitigations/\(mitigationId)",
            method: "PATCH",
            body: data
        )
    }

    /// POST /api/jobs/[id]/activity/subscribe — returns channelId and organizationId for Supabase Realtime.
    /// Use the returned channelId as the Realtime channel name and filter audit_logs with the same org/job.
    func subscribeToJobActivity(jobId: String) async throws -> (channelId: String, organizationId: String) {
        // API returns { ok: true, data: { channelId, organizationId, requestId } }
        struct Wrapper: Codable {
            let data: SubscribeData?
            struct SubscribeData: Codable {
                let channelId: String
                let organizationId: String
            }
        }
        let response: Wrapper = try await request(
            endpoint: "/api/jobs/\(jobId)/activity/subscribe",
            method: "POST"
        )
        guard let data = response.data, !data.channelId.isEmpty, !data.organizationId.isEmpty else {
            throw APIError.invalidResponse
        }
        return (channelId: data.channelId, organizationId: data.organizationId)
    }

    /// GET /api/actors/[id] — lightweight actor lookup (actor_name, actor_role) for activity feed enrichment.
    func getActor(id actorId: String) async throws -> (name: String, role: String?)? {
        struct ActorResponse: Codable {
            let data: ActorData?
            struct ActorData: Codable {
                let actorName: String?
                let actorRole: String?
                enum CodingKeys: String, CodingKey {
                    case actorName = "actor_name"
                    case actorRole = "actor_role"
                }
            }
        }
        let response: ActorResponse = try await request(endpoint: "/api/actors/\(actorId)")
        guard let data = response.data, let name = data.actorName, !name.isEmpty else { return nil }
        return (name: name, role: data.actorRole)
    }

    /// Get job activity events with optional filtering and pagination.
    /// Query params: limit, offset, actor_id, event_type (comma-separated for multiple), category, start_date, end_date (ISO).
    func getJobActivity(
        jobId: String,
        limit: Int = 50,
        offset: Int = 0,
        actorId: String? = nil,
        eventTypes: [String]? = nil,
        category: String? = nil,
        startDate: String? = nil,
        endDate: String? = nil
    ) async throws -> (events: [ActivityEvent], hasMore: Bool) {
        var queryItems: [String] = []
        queryItems.append("limit=\(min(max(1, limit), 100))")
        queryItems.append("offset=\(max(0, offset))")
        if let actorId = actorId, !actorId.isEmpty {
            queryItems.append("actor_id=\(actorId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? actorId)")
        }
        if let eventTypes = eventTypes, !eventTypes.isEmpty {
            let value = eventTypes.joined(separator: ",")
            let encoded = value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? value
            if eventTypes.count == 1 {
                queryItems.append("event_type=\(encoded)")
            } else {
                queryItems.append("event_types=\(encoded)")
            }
        }
        if let category = category, !category.isEmpty {
            queryItems.append("category=\(category.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? category)")
        }
        if let startDate = startDate, !startDate.isEmpty {
            queryItems.append("start_date=\(startDate.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? startDate)")
        }
        if let endDate = endDate, !endDate.isEmpty {
            queryItems.append("end_date=\(endDate.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? endDate)")
        }
        let query = "?\(queryItems.joined(separator: "&"))"
        let response: JobActivityResponse = try await request(
            endpoint: "/api/jobs/\(jobId)/activity\(query)"
        )
        return (response.data.events, response.data.hasMore)
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

    // MARK: - Report Runs / Signatures API

    /// Create a signature for a report run (team signatures flow).
    /// Requires signer name, title, role, SVG signature, and attestation text/acceptance.
    func createSignature(
        reportRunId: String,
        signerName: String,
        signerTitle: String,
        signatureRole: SignatureRole,
        signatureSvg: String,
        attestationText: String
    ) async throws -> ReportSignature {
        struct CreateSignatureRequest: Encodable {
            let signer_name: String
            let signer_title: String
            let signature_role: String
            let signature_svg: String
            let attestation_text: String
            let attestationAccepted: Bool

            enum CodingKeys: String, CodingKey {
                case signer_name
                case signer_title
                case signature_role
                case signature_svg
                case attestation_text
                case attestationAccepted = "attestation_accepted"
            }
        }
        let body = try JSONEncoder().encode(CreateSignatureRequest(
            signer_name: signerName.trimmingCharacters(in: .whitespacesAndNewlines),
            signer_title: signerTitle.trimmingCharacters(in: .whitespacesAndNewlines),
            signature_role: signatureRole.rawValue,
            signature_svg: signatureSvg,
            attestation_text: attestationText,
            attestationAccepted: true
        ))
        let response: ReportSignatureResponse = try await request(
            endpoint: "/api/reports/runs/\(reportRunId)/signatures",
            method: "POST",
            body: body
        )
        return response.data
    }

    /// Fetch all signatures for a report run.
    func getSignatures(reportRunId: String) async throws -> [ReportSignature] {
        let response: ReportSignaturesListResponse = try await request(
            endpoint: "/api/reports/runs/\(reportRunId)/signatures"
        )
        return response.data
    }

    /// Fetch report runs for a job (optional packet_type; default insurance).
    func getReportRuns(jobId: String, packetType: String = "insurance", limit: Int = 20, offset: Int = 0, status: String? = nil) async throws -> [ReportRun] {
        var query = "job_id=\(jobId)&packet_type=\(packetType)&limit=\(limit)&offset=\(offset)"
        if let status = status, !status.isEmpty {
            query += "&status=\(status)"
        }
        let response: ReportRunsListResponse = try await request(
            endpoint: "/api/reports/runs?\(query)"
        )
        return response.data
    }

    /// Fetch a single report run by ID.
    func getReportRun(reportRunId: String) async throws -> ReportRun {
        let response: ReportRunResponse = try await request(
            endpoint: "/api/reports/runs/\(reportRunId)"
        )
        return response.data
    }

    /// Resolve a sign-off (comment) ID to its job ID for deep link navigation (e.g. riskmate://comments/:signoffId).
    func getJobIdForSignoff(signoffId: String) async throws -> String {
        let response: SignoffJobRefResponse = try await request(
            endpoint: "/api/jobs/by-signoff/\(signoffId)"
        )
        return response.data.job_id
    }

    /// Get or create an active (non-superseded, signable) report run for a job.
    /// With forceNew: false, returns existing active run if any; otherwise creates one. With forceNew: true, supersedes prior and creates new.
    func getActiveReportRun(jobId: String, packetType: String = "insurance", forceNew: Bool = false) async throws -> (run: ReportRun, created: Bool) {
        var query = "job_id=\(jobId)&packet_type=\(packetType)"
        if forceNew { query += "&force_new=true" }
        let response: ReportRunActiveResponse = try await request(
            endpoint: "/api/reports/runs/active?\(query)"
        )
        return (response.data, response.created)
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

// MARK: - Report Runs

struct ReportRun: Codable, Identifiable {
    let id: String
    let jobId: String
    let organizationId: String
    let status: String
    let dataHash: String
    let generatedAt: Date
    let packetType: String?
    let pdfGeneratedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case jobId = "job_id"
        case organizationId = "organization_id"
        case status
        case dataHash = "data_hash"
        case generatedAt = "generated_at"
        case packetType = "packet_type"
        case pdfGeneratedAt = "pdf_generated_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        jobId = try c.decode(String.self, forKey: .jobId)
        organizationId = try c.decode(String.self, forKey: .organizationId)
        status = try c.decode(String.self, forKey: .status)
        dataHash = try c.decode(String.self, forKey: .dataHash)
        if let dateString = try c.decodeIfPresent(String.self, forKey: .generatedAt) {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            generatedAt = formatter.date(from: dateString) ?? ISO8601DateFormatter().date(from: dateString) ?? Date()
        } else {
            generatedAt = Date()
        }
        packetType = try c.decodeIfPresent(String.self, forKey: .packetType)
        if let dateString = try c.decodeIfPresent(String.self, forKey: .pdfGeneratedAt) {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            pdfGeneratedAt = formatter.date(from: dateString) ?? ISO8601DateFormatter().date(from: dateString)
        } else {
            pdfGeneratedAt = nil
        }
    }
}

struct ReportRunResponse: Codable {
    let data: ReportRun
}

struct ReportRunActiveResponse: Codable {
    let data: ReportRun
    let created: Bool
}

struct ReportRunsListResponse: Codable {
    let data: [ReportRun]
}

// MARK: - Report Signatures

/// Signature role for team report signing (matches API: prepared_by, reviewed_by, approved_by, other).
enum SignatureRole: String, CaseIterable, Codable {
    case preparedBy = "prepared_by"
    case reviewedBy = "reviewed_by"
    case approvedBy = "approved_by"
    case other = "other"

    var displayTitle: String {
        switch self {
        case .preparedBy: return "Prepared By"
        case .reviewedBy: return "Reviewed By"
        case .approvedBy: return "Approved By"
        case .other: return "Signature"
        }
    }
}

struct ReportSignature: Codable, Identifiable {
    let id: String
    let reportRunId: String
    let signerName: String
    let signerTitle: String
    let signatureRole: String
    let signatureSvg: String?
    let signedAt: Date?
    let attestationText: String?
    /// Signer's user id when present (from API signer_user_id). Used so reviewer cannot be the preparer.
    let signerUserId: String?

    enum CodingKeys: String, CodingKey {
        case id
        case reportRunId = "report_run_id"
        case signerName = "signer_name"
        case signerTitle = "signer_title"
        case signatureRole = "signature_role"
        case signatureSvg = "signature_svg"
        case signedAt = "signed_at"
        case attestationText = "attestation_text"
        case signerUserId = "signer_user_id"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        reportRunId = try c.decode(String.self, forKey: .reportRunId)
        signerName = try c.decode(String.self, forKey: .signerName)
        signerTitle = try c.decode(String.self, forKey: .signerTitle)
        signatureRole = try c.decode(String.self, forKey: .signatureRole)
        signatureSvg = try c.decodeIfPresent(String.self, forKey: .signatureSvg)
        attestationText = try c.decodeIfPresent(String.self, forKey: .attestationText)
        signerUserId = try c.decodeIfPresent(String.self, forKey: .signerUserId)
        if let dateString = try c.decodeIfPresent(String.self, forKey: .signedAt) {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            signedAt = formatter.date(from: dateString) ?? ISO8601DateFormatter().date(from: dateString)
        } else {
            signedAt = nil
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(reportRunId, forKey: .reportRunId)
        try c.encode(signerName, forKey: .signerName)
        try c.encode(signerTitle, forKey: .signerTitle)
        try c.encode(signatureRole, forKey: .signatureRole)
        try c.encodeIfPresent(signatureSvg, forKey: .signatureSvg)
        try c.encodeIfPresent(attestationText, forKey: .attestationText)
        if let signedAt = signedAt {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            try c.encode(formatter.string(from: signedAt), forKey: .signedAt)
        }
        try c.encodeIfPresent(signerUserId, forKey: .signerUserId)
    }
}

struct ReportSignatureResponse: Codable {
    let data: ReportSignature
}

struct ReportSignaturesListResponse: Codable {
    let data: [ReportSignature]
}

struct HazardsResponse: Codable {
    let data: [Hazard]
}

struct TasksResponse: Codable {
    let data: [APIClientTask]
}

struct TaskResponse: Codable {
    let data: APIClientTask
}

// MARK: - Comments API

struct CommentAuthor: Codable {
    let id: String
    let fullName: String?
    let email: String?

    enum CodingKeys: String, CodingKey {
        case id
        case fullName = "full_name"
        case email
    }
}

struct JobComment: Codable, Identifiable {
    let id: String
    let entityType: String
    let entityId: String
    let parentId: String?
    let authorId: String
    let content: String
    let isResolved: Bool?
    let resolvedBy: String?
    let resolvedAt: String?
    let editedAt: String?
    let deletedAt: String?
    let createdAt: String
    let updatedAt: String
    let author: CommentAuthor?
    let replyCount: Int?

    enum CodingKeys: String, CodingKey {
        case id
        case entityType = "entity_type"
        case entityId = "entity_id"
        case parentId = "parent_id"
        case authorId = "author_id"
        case content
        case isResolved = "is_resolved"
        case resolvedBy = "resolved_by"
        case resolvedAt = "resolved_at"
        case editedAt = "edited_at"
        case deletedAt = "deleted_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case author
        case replyCount = "reply_count"
    }
}

struct CommentsListResponse: Codable {
    let data: [JobComment]
    let count: Int?
    let hasMore: Bool?

    enum CodingKeys: String, CodingKey {
        case data
        case count
        case hasMore = "has_more"
    }
}

struct CreateCommentResponse: Codable {
    let data: JobComment
}

struct HazardResponse: Codable {
    let data: Hazard
}

struct ControlsResponse: Codable {
    let data: [Control]
}

struct ControlResponse: Codable {
    let data: Control
}

struct CreateTaskRequest: Codable {
    let title: String
    let description: String?
    let assigned_to: String?
    let priority: String
    let due_date: String?
    let status: String?
    let sort_order: Int?
}

struct APIClientTask: Codable, Identifiable {
    let id: String
    let title: String
    let status: String
    let priority: String
    let dueDate: String?
    let completedAt: String?
    let sortOrder: Int
    let assignedUser: APIClientTaskUser?

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case status
        case priority
        case dueDate = "due_date"
        case completedAt = "completed_at"
        case sortOrder = "sort_order"
        case assignedUser = "assigned_user"
    }
}

struct APIClientTaskUser: Codable {
    let id: String?
    let fullName: String?
    let email: String?

    enum CodingKeys: String, CodingKey {
        case id
        case fullName = "full_name"
        case email
    }
}

// MARK: - Job Activity API

struct JobActivityResponse: Codable {
    let data: JobActivityData
}

struct JobActivityData: Codable {
    let events: [ActivityEvent]
    let total: Int
    let hasMore: Bool

    enum CodingKeys: String, CodingKey {
        case events
        case total
        case hasMore = "has_more"
    }
}

/// Job activity event from GET /api/jobs/:id/activity (audit log row + enriched actor).
struct ActivityEvent: Identifiable, Codable, Equatable {
    let id: String
    let actorId: String?
    let eventName: String?
    let eventType: String?
    let actorName: String?
    let actorRole: String?
    let createdAt: Date
    let category: String?
    let severity: String?
    let outcome: String?
    let summary: String?
    let metadata: [String: RMAnyCodable]?

    enum CodingKeys: String, CodingKey {
        case id
        case actorId = "actor_id"
        case eventName = "event_name"
        case eventType = "event_type"
        case actorName = "actor_name"
        case actorRole = "actor_role"
        case createdAt = "created_at"
        case category
        case severity
        case outcome
        case summary
        case metadata
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        actorId = try container.decodeIfPresent(String.self, forKey: .actorId)
        eventName = try container.decodeIfPresent(String.self, forKey: .eventName)
        eventType = try container.decodeIfPresent(String.self, forKey: .eventType)
        actorName = try container.decodeIfPresent(String.self, forKey: .actorName)
        actorRole = try container.decodeIfPresent(String.self, forKey: .actorRole)
        category = try container.decodeIfPresent(String.self, forKey: .category)
        severity = try container.decodeIfPresent(String.self, forKey: .severity)
        outcome = try container.decodeIfPresent(String.self, forKey: .outcome)
        summary = try container.decodeIfPresent(String.self, forKey: .summary)
        metadata = try container.decodeIfPresent([String: RMAnyCodable].self, forKey: .metadata)
        let createdAtString = try container.decode(String.self, forKey: .createdAt)
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: createdAtString) {
            createdAt = date
        } else {
            let standardFormatter = ISO8601DateFormatter()
            createdAt = standardFormatter.date(from: createdAtString) ?? Date()
        }
    }

    /// Build from a realtime postgres payload (e.g. audit_logs INSERT) for in-app prepend.
    init?(realtimeRecord: [String: Any]) {
        guard let id = realtimeRecord["id"] as? String else { return nil }
        let createdAtString = realtimeRecord["created_at"] as? String ?? ""
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let createdAt = formatter.date(from: createdAtString)
            ?? ISO8601DateFormatter().date(from: createdAtString) ?? Date()
        self.id = id
        self.actorId = realtimeRecord["actor_id"] as? String
        self.eventName = realtimeRecord["event_name"] as? String
        self.eventType = realtimeRecord["event_type"] as? String ?? realtimeRecord["event_name"] as? String
        self.actorName = realtimeRecord["actor_name"] as? String
        self.actorRole = realtimeRecord["actor_role"] as? String
        self.createdAt = createdAt
        self.category = realtimeRecord["category"] as? String
        self.severity = realtimeRecord["severity"] as? String
        self.outcome = realtimeRecord["outcome"] as? String
        self.summary = realtimeRecord["summary"] as? String
        self.metadata = nil
    }

    /// Copy of an event with overridden actor name/role (for realtime enrichment when actor_name is missing).
    init(from other: ActivityEvent, actorName: String?, actorRole: String?) {
        id = other.id
        actorId = other.actorId
        eventName = other.eventName
        eventType = other.eventType
        self.actorName = actorName ?? other.actorName
        self.actorRole = actorRole ?? other.actorRole
        createdAt = other.createdAt
        category = other.category
        severity = other.severity
        outcome = other.outcome
        summary = other.summary
        metadata = other.metadata
    }

    static func == (lhs: ActivityEvent, rhs: ActivityEvent) -> Bool {
        lhs.id == rhs.id
    }
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

// MARK: - Sync API Response Models

struct BatchSyncResponse: Codable {
    let results: [BatchOperationResult]
}

struct BatchOperationResult: Codable {
    let operationId: String
    let status: String
    let serverId: String?
    let error: String?
    let conflict: BatchConflictDetail?

    enum CodingKeys: String, CodingKey {
        case operationId = "operation_id"
        case status
        case serverId = "server_id"
        case error
        case conflict
    }
}

struct BatchConflictDetail: Codable {
    let entityType: String?
    let entityId: String?
    let field: String?
    let serverValue: AnyCodable?
    let localValue: AnyCodable?
    let serverTimestampStr: String?
    let localTimestampStr: String?
    let serverActor: String?
    let localActor: String?

    enum CodingKeys: String, CodingKey {
        case entityType = "entity_type"
        case entityId = "entity_id"
        case field
        case serverValue = "server_value"
        case localValue = "local_value"
        case serverTimestampStr = "server_timestamp"
        case localTimestampStr = "local_timestamp"
        case serverActor = "server_actor"
        case localActor = "local_actor"
    }

    var serverTimestamp: Date? {
        guard let s = serverTimestampStr else { return nil }
        return ISO8601DateFormatter().date(from: s)
    }
    var localTimestamp: Date? {
        guard let s = localTimestampStr else { return nil }
        return ISO8601DateFormatter().date(from: s)
    }
}

struct SyncChangesResponse: Codable {
    let data: [Job]
    let mitigationItems: [SyncMitigationItem]?
    let deletedMitigationIds: [String]?
    let deletedJobIds: [String]?
    let pagination: SyncChangesPagination?

    enum CodingKeys: String, CodingKey {
        case data
        case mitigationItems = "mitigation_items"
        case deletedMitigationIds = "deleted_mitigation_ids"
        case deletedJobIds = "deleted_job_ids"
        case pagination
    }
}

/// Hazard or control from sync changes
struct SyncMitigationItem: Codable {
    let entityType: String
    let jobId: String
    let data: SyncMitigationData

    enum CodingKeys: String, CodingKey {
        case entityType = "entity_type"
        case jobId = "job_id"
        case data
    }
}

/// Polymorphic data: Hazard-like (name, code) or Control-like (title, hazardId, done)
struct SyncMitigationData: Codable {
    let id: String
    let title: String?
    let name: String?
    let description: String?
    let status: String?
    let done: Bool?
    let isCompleted: Bool?
    let hazardId: String?
    let jobId: String?
    let code: String?
    let severity: String?
    let createdAt: String?
    let updatedAt: String?
    let created_at: String?
    let updated_at: String?

    enum CodingKeys: String, CodingKey {
        case id, title, name, description, status, done, code, severity
        case isCompleted = "isCompleted"
        case is_completed = "is_completed"
        case hazardId = "hazardId"
        case hazard_id = "hazard_id"
        case jobId = "jobId"
        case job_id = "job_id"
        case createdAt = "createdAt"
        case updatedAt = "updatedAt"
        case created_at
        case updated_at
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = try c.decodeIfPresent(String.self, forKey: .title)
        name = try c.decodeIfPresent(String.self, forKey: .name)
        description = try c.decodeIfPresent(String.self, forKey: .description)
        status = try c.decodeIfPresent(String.self, forKey: .status)
        done = try c.decodeIfPresent(Bool.self, forKey: .done)
        let isCompletedCamel = try c.decodeIfPresent(Bool.self, forKey: .isCompleted)
        let isCompletedSnake = try? c.decode(Bool.self, forKey: .is_completed)
        isCompleted = isCompletedCamel ?? isCompletedSnake
        let hazardIdCamel = try c.decodeIfPresent(String.self, forKey: .hazardId)
        let hazardIdSnake = try? c.decode(String.self, forKey: .hazard_id)
        hazardId = hazardIdCamel ?? hazardIdSnake
        let jobIdCamel = try c.decodeIfPresent(String.self, forKey: .jobId)
        let jobIdSnake = try? c.decode(String.self, forKey: .job_id)
        jobId = jobIdCamel ?? jobIdSnake
        code = try c.decodeIfPresent(String.self, forKey: .code)
        severity = try c.decodeIfPresent(String.self, forKey: .severity)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try c.decodeIfPresent(String.self, forKey: .updatedAt)
        created_at = try c.decodeIfPresent(String.self, forKey: .created_at)
        updated_at = try c.decodeIfPresent(String.self, forKey: .updated_at)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encodeIfPresent(title, forKey: .title)
        try c.encodeIfPresent(name, forKey: .name)
        try c.encodeIfPresent(description, forKey: .description)
        try c.encodeIfPresent(status, forKey: .status)
        try c.encodeIfPresent(done, forKey: .done)
        try c.encodeIfPresent(isCompleted, forKey: .isCompleted)
        try c.encodeIfPresent(hazardId, forKey: .hazardId)
        try c.encodeIfPresent(jobId, forKey: .jobId)
        try c.encodeIfPresent(code, forKey: .code)
        try c.encodeIfPresent(severity, forKey: .severity)
        try c.encodeIfPresent(createdAt, forKey: .createdAt)
        try c.encodeIfPresent(updatedAt, forKey: .updatedAt)
        try c.encodeIfPresent(created_at, forKey: .created_at)
        try c.encodeIfPresent(updated_at, forKey: .updated_at)
    }

    var jobIdFromData: String? { jobId }

    var asHazard: Hazard? {
        guard let n = name ?? title, !n.isEmpty else { return nil }
        return Hazard(
            id: id,
            code: code ?? "UNKNOWN",
            name: n,
            description: description ?? "",
            severity: severity ?? "medium",
            status: status ?? "open",
            createdAt: createdAt ?? created_at ?? ISO8601DateFormatter().string(from: Date()),
            updatedAt: updatedAt ?? updated_at ?? ISO8601DateFormatter().string(from: Date())
        )
    }

    var asControl: Control? {
        Control(
            id: id,
            title: title ?? name,
            description: description ?? "",
            status: status ?? "Pending",
            done: done ?? isCompleted,
            isCompleted: isCompleted ?? done,
            hazardId: hazardId,
            createdAt: createdAt ?? created_at,
            updatedAt: updatedAt ?? updated_at
        )
    }
}

/// Result of getSyncChanges - jobs and mitigation items (hazards + controls) for offline merge
struct SyncChangesResult {
    let jobs: [Job]
    let mitigationItems: [SyncMitigationItem]
    /// IDs of hazards/controls deleted on server since last sync; offline cache should drop these
    let deletedMitigationIds: Set<String>
    /// IDs of jobs deleted on server since last sync; offline cache should drop these
    let deletedJobIds: Set<String>
}

struct SyncChangesPagination: Codable {
    let limit: Int
    let offset: Int
    let hasMore: Bool
    let nextOffset: Int?

    enum CodingKeys: String, CodingKey {
        case limit, offset
        case hasMore = "has_more"
        case nextOffset = "next_offset"
    }
}

/// Type-erased Codable for conflict values (server_value, local_value can be any JSON type)
struct AnyCodable: Codable {
    let value: Any
    init(_ value: Any) { self.value = value }
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { value = NSNull(); return }
        if let b = try? container.decode(Bool.self) { value = b; return }
        if let i = try? container.decode(Int.self) { value = i; return }
        if let d = try? container.decode(Double.self) { value = d; return }
        if let s = try? container.decode(String.self) { value = s; return }
        if let a = try? container.decode([AnyCodable].self) { value = a.map { $0.value }; return }
        if let o = try? container.decode([String: AnyCodable].self) { value = Dictionary(uniqueKeysWithValues: o.map { ($0.key, $0.value.value) }); return }
        value = NSNull()
    }
    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch value {
        case is NSNull: try container.encodeNil()
        case let b as Bool: try container.encode(b)
        case let i as Int: try container.encode(i)
        case let d as Double: try container.encode(d)
        case let s as String: try container.encode(s)
        default: try container.encodeNil()
        }
    }
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

/// Response from GET /api/jobs/by-signoff/:signoffId (for comment deep link resolution).
struct SignoffJobRefResponse: Codable {
    let data: SignoffJobRef
}

struct SignoffJobRef: Codable {
    let job_id: String
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

/// Response from POST /api/sync/resolve-conflict
struct ResolveConflictResponse: Codable {
    let ok: Bool?
    let operationId: String?
    let strategy: String?
    /// Updated entity for server_wins (client refreshes from this) or local_wins/merge
    let updatedJob: Job?
    let updatedMitigationItem: SyncMitigationData?

    enum CodingKeys: String, CodingKey {
        case ok
        case operationId = "operation_id"
        case strategy
        case updatedJob = "updated_job"
        case updatedMitigationItem = "updated_mitigation_item"
    }
}

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

    /// HTTP status code when error is .httpError(statusCode:message:); nil otherwise.
    var statusCode: Int? {
        if case .httpError(let code, _) = self { return code }
        return nil
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
