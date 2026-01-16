import Foundation
// Try: import Supabase
// If that fails, the package isn't added correctly
import Supabase

/// Wraps Supabase authentication
class AuthService {
    static let shared = AuthService()
    
    private let supabase: SupabaseClient
    
    private init() {
        let config = AppConfig.shared
        supabase = SupabaseClient(
            supabaseURL: URL(string: config.supabaseURL)!,
            supabaseKey: config.supabaseAnonKey
        )
    }
    
    /// Get current session (if logged in)
    func getCurrentSession() async throws -> Session? {
        do {
            let session = try await supabase.auth.session
            return session
        } catch {
            // No session exists
            return nil
        }
    }
    
    /// Sign in with email/password
    func signIn(email: String, password: String) async throws {
        do {
            _ = try await supabase.auth.signIn(email: email, password: password)
            Analytics.shared.trackLoginSuccess()
        } catch {
            Analytics.shared.trackLoginFailed(reason: error.localizedDescription)
            throw error
        }
    }
    
    /// Sign out
    func signOut() async {
        try? await supabase.auth.signOut()
    }
    
    /// Get access token for API requests
    /// Always fetches fresh session to avoid stale tokens
    func getAccessToken() async throws -> String? {
        do {
            let session = try await supabase.auth.session
            
            // accessToken is non-optional String in Supabase Swift
            let token = session.accessToken
            
            // Validate token is not empty
            guard !token.isEmpty else {
                print("[AuthService] ⚠️ Session exists but accessToken is empty")
                return nil
            }
            
            // Log token info (first 20 chars only for security)
            print("[AuthService] ✅ Session loaded, token length: \(token.count), preview: \(token.prefix(20))...")
            
            return token
        } catch {
            print("[AuthService] ❌ Failed to get session: \(error.localizedDescription)")
            return nil
        }
    }
    
    /// Check if user is currently authenticated
    func isAuthenticated() async -> Bool {
        do {
            let session = try await supabase.auth.session
            // accessToken is non-optional String, just check if not empty
            return !session.accessToken.isEmpty
        } catch {
            return false
        }
    }
}
