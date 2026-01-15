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
        self.healthCheckURL = "\(AppConfig.shared.backendURL)/health"
        startPeriodicChecks()
    }
    
    /// Check server health
    func checkHealth() async {
        guard let url = URL(string: healthCheckURL) else {
            backendDown = true
            isOnline = false
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 5.0 // Fast timeout for health check
        
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse {
                backendDown = !(200...299).contains(httpResponse.statusCode)
                isOnline = !backendDown
            } else {
                backendDown = true
                isOnline = false
            }
        } catch {
            backendDown = true
            isOnline = false
        }
        
        lastCheck = Date()
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
