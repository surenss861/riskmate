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
            fatalError("Config.plist not found or invalid")
        }
        
        guard let backendURL = plist["BACKEND_URL"] as? String,
              let supabaseURL = plist["SUPABASE_URL"] as? String,
              let supabaseAnonKey = plist["SUPABASE_ANON_KEY"] as? String else {
            fatalError("Required config values missing in Config.plist")
        }
        
        self.backendURL = backendURL
        self.supabaseURL = supabaseURL
        self.supabaseAnonKey = supabaseAnonKey
    }
}
