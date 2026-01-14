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
        guard let url = URL(string: "\(baseURL)\(endpoint)") else {
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Add auth token
        if let token = try await authService.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        if let body = body {
            request.httpBody = body
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            let errorMessage = try? JSONDecoder().decode(APIErrorResponse.self, from: data)
            throw APIError.httpError(
                statusCode: httpResponse.statusCode,
                message: errorMessage?.message ?? "Request failed"
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
