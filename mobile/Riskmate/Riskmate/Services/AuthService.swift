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
        // Initialize Supabase client with emitLocalSessionAsInitialSession option
        // This prevents the "initial session emitted" warning and ensures deterministic auth state
        supabase = SupabaseClient(
            supabaseURL: URL(string: config.supabaseURL)!,
            supabaseKey: config.supabaseAnonKey,
            options: SupabaseClientOptions(
                auth: AuthOptions(
                    emitLocalSessionAsInitialSession: true
                )
            )
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
    /// Returns ONLY Supabase session.accessToken (JWT format: eyJ...xxx.yyy.zzz)
    func getAccessToken() async throws -> String? {
        do {
            let session = try await supabase.auth.session
            
            // accessToken is non-optional String in Supabase Swift
            // This is the ONLY token we should use - it's a JWT
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
            
            // Validate JWT format (must be 3 dot-separated parts: header.payload.signature)
            let parts = token.split(separator: ".")
            guard parts.count == 3 else {
                #if DEBUG
                let preview = String(token.prefix(20))
                print("[AuthService] ❌ Token format invalid (not JWT) - preview: \(preview)..., length: \(token.count), parts: \(parts.count)")
                print("[AuthService] ❌ Expected 3 dot-separated parts (header.payload.signature), got \(parts.count)")
                #endif
                throw NSError(
                    domain: "AuthService",
                    code: 2,
                    userInfo: [NSLocalizedDescriptionKey: "Token format invalid (not JWT - expected 3 dot-separated parts, got \(parts.count))"]
                )
            }
            
            // Validate token starts with JWT header (eyJ = base64 for {"alg":"HS256",...})
            guard token.hasPrefix("eyJ") else {
                #if DEBUG
                let preview = String(token.prefix(20))
                print("[AuthService] ❌ Token doesn't start with 'eyJ' (not a JWT) - preview: \(preview)...")
                #endif
                throw NSError(
                    domain: "AuthService",
                    code: 3,
                    userInfo: [NSLocalizedDescriptionKey: "Token doesn't appear to be a JWT (should start with 'eyJ')"]
                )
            }
            
            // Logging (safe): only log in DEBUG builds
            #if DEBUG
            let preview = String(token.prefix(20))
            print("[AuthService] ✅ Session loaded, token length: \(token.count), preview: \(preview)…")
            print("[AuthService] ✅ Token is valid JWT format (3 parts, starts with eyJ)")
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
