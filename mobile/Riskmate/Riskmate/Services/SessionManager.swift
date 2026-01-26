import Foundation
import Combine

/// Manages app session state (auth, user, organization)
@MainActor
class SessionManager: ObservableObject {
    static let shared = SessionManager()
    
    @Published var isAuthenticated = false
    @Published var isBootstrapped = false // Auth state has been checked
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
        print("[SessionManager] Starting session check...")
        isLoading = true
        isBootstrapped = false
        defer { 
            isLoading = false
            isBootstrapped = true // Mark as bootstrapped regardless of auth state
            print("[SessionManager] Session check complete. isAuthenticated=\(isAuthenticated), isBootstrapped=\(isBootstrapped), isLoading=\(isLoading)")
        }
        
        do {
            if try await authService.getCurrentSession() != nil {
                // Refresh entitlements after successful session check
                await EntitlementsManager.shared.refresh(force: true)
                // Check JWT expiration (SDK-independent)
                if let token = try? await authService.getAccessToken(),
                   JWTExpiry.isExpired(token) {
                    print("[SessionManager] ⚠️ Session found but JWT is expired, clearing...")
                    await logout()
                    isAuthenticated = false
                } else {
                    print("[SessionManager] ✅ Found valid session")
                    isAuthenticated = true
                    await loadUserData()
                    
                    // Subscribe to realtime events after session restore
                    if let orgId = currentOrganization?.id {
                        await RealtimeEventService.shared.subscribe(organizationId: orgId)
                    }
                }
            } else {
                print("[SessionManager] No existing session found")
                isAuthenticated = false
            }
        } catch {
            print("[SessionManager] ❌ Error checking session: \(error)")
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
            
            // Refresh entitlements after login
            await EntitlementsManager.shared.refresh(force: true)
            
            // Subscribe to realtime events after login
            if let orgId = currentOrganization?.id {
                await RealtimeEventService.shared.subscribe(organizationId: orgId)
            }
        } catch {
            errorMessage = error.localizedDescription
            throw error
        }
    }
    
    /// Signup with email/password
    func signup(email: String, password: String) async throws {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        
        do {
            // First create user via backend API (creates user + organization)
            let signupURL = URL(string: "\(AppConfig.shared.backendURL)/api/auth/signup")!
            var request = URLRequest(url: signupURL)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(["email": email, "password": password])
            
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                throw NSError(domain: "AuthError", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid response"])
            }
            
            if !(200...299).contains(httpResponse.statusCode) {
                let errorData = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
                let errorMsg = errorData?["error"] as? String ?? "Signup failed"
                throw NSError(domain: "AuthError", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: errorMsg])
            }
            
            // Then sign in with Supabase
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
        
        // Unsubscribe from realtime events
        await RealtimeEventService.shared.unsubscribe()
        
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
            
            // Subscribe to realtime events after org is loaded
            await RealtimeEventService.shared.subscribe(organizationId: org.id)
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
