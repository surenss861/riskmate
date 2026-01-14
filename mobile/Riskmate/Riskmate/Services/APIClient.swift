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
        
        // Log request for debugging (remove in production)
        #if DEBUG
        print("[APIClient] \(method) \(fullURL)")
        #endif
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        // Log response for debugging
        #if DEBUG
        print("[APIClient] Response: \(httpResponse.statusCode)")
        if httpResponse.statusCode >= 400, let errorData = String(data: data, encoding: .utf8) {
            print("[APIClient] Error body: \(errorData)")
        }
        #endif
        
        guard (200...299).contains(httpResponse.statusCode) else {
            let errorMessage = try? JSONDecoder().decode(APIErrorResponse.self, from: data)
            throw APIError.httpError(
                statusCode: httpResponse.statusCode,
                message: errorMessage?.message ?? "Request failed with status \(httpResponse.statusCode)"
            )
        }
        
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(T.self, from: data)
    }
    
    // MARK: - Organization API
    
    /// Get organization info
    func getOrganization() async throws -> Organization {
        return try await request<OrganizationResponse>(endpoint: "/api/account/organization").data
    }
    
    /// Update organization name
    func updateOrganization(name: String) async throws -> Organization {
        let body = try JSONEncoder().encode(["name": name])
        return try await request<OrganizationResponse>(
            endpoint: "/api/account/organization",
            method: "PATCH",
            body: body
        ).data
    }
}

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
