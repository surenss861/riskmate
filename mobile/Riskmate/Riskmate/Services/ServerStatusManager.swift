import Foundation
import Combine

/// Manages server health status and offline mode detection
@MainActor
class ServerStatusManager: ObservableObject {
    static let shared = ServerStatusManager()
    
    @Published var isOnline: Bool = true
    @Published var lastCheck: Date?
    @Published var backendDown: Bool = false
    
    private let healthCheckURL: String
    private var checkTimer: Timer?
    
    private init() {
        // Use /v1/health for versioned health check with build metadata
        self.healthCheckURL = "\(AppConfig.shared.backendURL)/v1/health"
        startPeriodicChecks()
    }
    
    /// Check server health (returns health info or nil if failed)
    func checkHealth() async -> HealthResponse? {
        guard let url = URL(string: healthCheckURL) else {
            backendDown = true
            isOnline = false
            return nil
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 5.0 // Fast timeout for health check
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse {
                let isHealthy = (200...299).contains(httpResponse.statusCode)
                backendDown = !isHealthy
                isOnline = isHealthy
                
                if isHealthy {
                    // Try to decode health response
                    if let healthData = try? JSONDecoder().decode(HealthResponse.self, from: data) {
                        lastCheck = Date()
                        return healthData
                    }
                }
            } else {
                backendDown = true
                isOnline = false
            }
        } catch {
            backendDown = true
            isOnline = false
            print("[ServerStatusManager] ❌ Health check failed: \(error.localizedDescription)")
        }
        
        lastCheck = Date()
        return nil
    }
    
    /// Check health and throw if backend is unavailable (for startup gate)
    func requireHealthyBackend() async throws {
        let health = await checkHealth()
        if health == nil {
            throw HealthCheckError.backendUnavailable
        }
    }
    
    private func startPeriodicChecks() {
        // Check every 30 seconds
        checkTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.checkHealth()
            }
        }
    }
    
    deinit {
        checkTimer?.invalidate()
    }
}

// MARK: - Health Response Model

struct HealthResponse: Codable {
    let status: String
    let timestamp: String
    let commit: String?
    let service: String?
    let version: String?
    let environment: String?
    let deployment: String?
    let db: String?
}

enum HealthCheckError: LocalizedError {
    case backendUnavailable
    
    var errorDescription: String? {
        switch self {
        case .backendUnavailable:
            return "Backend service is unavailable. Please check your connection and try again."
        }
    }
}
