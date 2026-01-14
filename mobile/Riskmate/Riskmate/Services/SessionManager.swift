import Foundation
import Combine

/// Manages app session state (auth, user, organization)
@MainActor
class SessionManager: ObservableObject {
    static let shared = SessionManager()
    
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var currentOrganization: Organization?
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private let authService: AuthService
    private let apiClient: APIClient
    
    private init() {
        self.authService = AuthService.shared
        self.apiClient = APIClient.shared
    }
    
    /// Check if user is already logged in (on app launch)
    func checkSession() async {
        isLoading = true
        defer { isLoading = false }
        
        do {
            if let session = try await authService.getCurrentSession() {
                isAuthenticated = true
                await loadUserData()
            } else {
                isAuthenticated = false
            }
        } catch {
            print("[SessionManager] No existing session: \(error)")
            isAuthenticated = false
        }
    }
    
    /// Login with email/password
    func login(email: String, password: String) async throws {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        
        do {
            try await authService.signIn(email: email, password: password)
            isAuthenticated = true
            await loadUserData()
        } catch {
            errorMessage = error.localizedDescription
            throw error
        }
    }
    
    /// Logout
    func logout() async {
        isLoading = true
        defer { isLoading = false }
        
        await authService.signOut()
        isAuthenticated = false
        currentUser = nil
        currentOrganization = nil
    }
    
    /// Load user and organization data
    private func loadUserData() async {
        // Load organization (this will be our first API call)
        do {
            let org = try await apiClient.getOrganization()
            currentOrganization = org
        } catch {
            print("[SessionManager] Failed to load organization: \(error)")
            // Don't fail login if org load fails - user can still use app
        }
    }
    
    /// Refresh organization data (after updates)
    func refreshOrganization() async {
        do {
            let org = try await apiClient.getOrganization()
            currentOrganization = org
        } catch {
            errorMessage = "Failed to refresh organization: \(error.localizedDescription)"
        }
    }
}
