import Foundation

/// Auditor/Read-only mode utilities
enum AuditorMode {
    /// Check if current user is in auditor/read-only mode
    static var isEnabled: Bool {
        UserDefaults.standard.string(forKey: "user_role") == "auditor"
    }
    
    /// Check if a feature should be disabled for auditors
    static func shouldDisable(_ feature: AuditorFeature) -> Bool {
        guard isEnabled else { return false }
        
        switch feature {
        case .evidenceCapture:
            return true
        case .jobCreation:
            return true
        case .jobEditing:
            return true
        case .teamManagement:
            return true
        }
    }
}

enum AuditorFeature {
    case evidenceCapture
    case jobCreation
    case jobEditing
    case teamManagement
}
