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
    
    /// Check if token is likely a valid JWT (3 parts, reasonable length)
    private func isLikelyJWT(_ token: String) -> Bool {
        let parts = token.split(separator: ".")
        return parts.count == 3 && token.count > 50
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
                throw NSError(
                    domain: "AuthService",
                    code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "Session exists but accessToken is empty"]
                )
            }
            
            // Validate JWT format
            guard isLikelyJWT(token) else {
                #if DEBUG
                let preview = String(token.prefix(20))
                print("[AuthService] ❌ Token format invalid (not JWT) - preview: \(preview)..., length: \(token.count)")
                #endif
                throw NSError(
                    domain: "AuthService",
                    code: 2,
                    userInfo: [NSLocalizedDescriptionKey: "Token format invalid (not JWT - expected 3 dot-separated parts)"]
                )
            }
            
            // Logging (safe): only log in DEBUG builds
            #if DEBUG
            let preview = String(token.prefix(20))
            print("[AuthService] ✅ Session loaded, token length: \(token.count), preview: \(preview)…")
            #endif
            
            return token
        } catch {
            print("[AuthService] ❌ Failed to get session/token: \(error.localizedDescription)")
            throw error
        }
    }
    
    /// Check if user is currently authenticated
    func isAuthenticated() async -> Bool {
        do {
            _ = try await supabase.auth.session
            return true
        } catch {
            return false
        }
    }
    
    /// Ensure session is restored (call this at app startup before making API calls)
    func ensureSessionRestored() async {
        do {
            _ = try await supabase.auth.session
            #if DEBUG
            print("[AuthService] ✅ Session restored")
            #endif
        } catch {
            #if DEBUG
            print("[AuthService] ⚠️ No session found (user not logged in)")
            #endif
        }
    }
}
