import Foundation

/// Auditor/Read-only mode utilities
/// DEPRECATED: Use EntitlementsManager.shared instead
/// This is kept for backward compatibility during migration
enum AuditorMode {
    /// Check if current user is in auditor/read-only mode
    /// DEPRECATED: Use EntitlementsManager.shared.isAuditor() instead
    @available(*, deprecated, message: "Use EntitlementsManager.shared.isAuditor() instead")
    static var isEnabled: Bool {
        // Fallback to UserDefaults during migration, but prefer entitlements
        if let entitlements = EntitlementsManager.shared.entitlements {
            return entitlements.role.lowercased() == "auditor"
        }
        // Legacy fallback
        return UserDefaults.standard.string(forKey: "user_role") == "auditor"
    }
    
    /// Check if a feature should be disabled for auditors
    /// DEPRECATED: Use EntitlementsManager.shared permission checks instead
    @available(*, deprecated, message: "Use EntitlementsManager.shared permission checks instead")
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
