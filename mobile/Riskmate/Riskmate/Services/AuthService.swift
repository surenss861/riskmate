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
        _ = try await supabase.auth.signIn(email: email, password: password)
    }
    
    /// Sign out
    func signOut() async {
        try? await supabase.auth.signOut()
    }
    
    /// Get access token for API requests
    func getAccessToken() async throws -> String? {
        do {
            let session = try await supabase.auth.session
            // Session is non-optional, but accessToken might be optional
            return session.accessToken
        } catch {
            return nil
        }
    }
}
