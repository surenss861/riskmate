import Foundation

/// App configuration loaded from Config.plist
struct AppConfig {
    static let shared = AppConfig()
    
    let backendURL: String
    let supabaseURL: String
    let supabaseAnonKey: String
    
    private init() {
        guard let path = Bundle.main.path(forResource: "Config", ofType: "plist"),
              let plist = NSDictionary(contentsOfFile: path) else {
            fatalError("Config.plist not found or invalid. Make sure Config.plist is added to target and in Copy Bundle Resources.")
        }
        
        guard let backendURL = plist["BACKEND_URL"] as? String,
              let supabaseURL = plist["SUPABASE_URL"] as? String,
              let supabaseAnonKey = plist["SUPABASE_ANON_KEY"] as? String else {
            fatalError("Required config values missing in Config.plist. Check: BACKEND_URL, SUPABASE_URL, SUPABASE_ANON_KEY")
        }
        
        // Validate values are not placeholders
        if supabaseURL.contains("YOUR_SUPABASE") || supabaseURL.contains("xxxxx") {
            fatalError("SUPABASE_URL is still a placeholder. Replace with your actual Supabase project URL from dashboard.")
        }
        
        if supabaseAnonKey.contains("YOUR_SUPABASE") || supabaseAnonKey.count < 50 {
            fatalError("SUPABASE_ANON_KEY is still a placeholder or invalid. Replace with your actual anon key from Supabase dashboard.")
        }
        
        // Debug logging (only in DEBUG builds)
        #if DEBUG
        print("[Config] ✅ Backend URL: \(backendURL)")
        print("[Config] ✅ Supabase URL: \(supabaseURL.prefix(30))...")
        print("[Config] ✅ Supabase Anon Key: \(supabaseAnonKey.prefix(20))... (length: \(supabaseAnonKey.count))")
        #endif
        
        self.backendURL = backendURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        self.supabaseURL = supabaseURL
        self.supabaseAnonKey = supabaseAnonKey
    }
}
