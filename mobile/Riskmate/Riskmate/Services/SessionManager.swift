import Foundation
import Combine

/// Serializes logout so only one logout runs at a time (async-safe for Swift 6).
private actor LogoutGate {
    private var inProgress = false

    /// Returns true if this call should proceed with logout; false if another logout is in progress.
    func tryBegin() -> Bool {
        if inProgress { return false }
        inProgress = true
        return true
    }

    func end() {
        inProgress = false
    }
}

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
    private let logoutGate = LogoutGate()

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
            // Fetch a usable session (AuthService now returns nil for expired)
            let session = try await authService.getCurrentSession()

            guard session != nil else {
                print("[SessionManager] No existing session found")
                isAuthenticated = false
                return
            }

            // Belt-and-suspenders: validate token directly (in case SDK changes)
            if let token = try? await authService.getAccessToken(),
               JWTExpiry.isExpired(token) {
                print("[SessionManager] ⚠️ Session found but JWT is expired, clearing...")
                await logout()
                isAuthenticated = false
                return
            }

            // Only after validity is proven:
            print("[SessionManager] ✅ Found valid session")
            isAuthenticated = true

            await EntitlementsManager.shared.refresh(force: true)
            await loadUserData()

            if let orgId = currentOrganization?.id {
                await RealtimeEventService.shared.subscribe(organizationId: orgId)
            }
            await NotificationService.shared.registerStoredTokenIfNeeded()
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
            // Re-register device token after login (backend association is user-scoped; token is device-scoped).
            await NotificationService.shared.registerStoredTokenIfNeeded()
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
    
    /// Logout. Does not require a valid token — best effort: clears local session (Supabase signOut), unregisters push, clears state.
    /// De-duped: concurrent callers (e.g. multiple requests hitting expired token) only run logout once.
    func logout() async {
        guard await logoutGate.tryBegin() else { return }

        isLoading = true
        defer { isLoading = false }

        await RealtimeEventService.shared.unsubscribe()

        if let token = NotificationService.shared.lastDeviceToken {
            do {
                try await NotificationService.shared.unregisterDeviceToken(token)
                NotificationService.shared.clearStoredToken()
            } catch {
                // Benign: e.g. network, token already removed; don't fail logout
            }
        }

        await authService.signOut()
        isAuthenticated = false
        currentUser = nil
        currentOrganization = nil
        await logoutGate.end()
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
