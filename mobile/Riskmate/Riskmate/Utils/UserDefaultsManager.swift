import Foundation

/// Standardized UserDefaults key manager - namespaced and consistent
/// Format: riskmate.{category}.{key}
struct UserDefaultsManager {
    private static let prefix = "riskmate"
    
    // MARK: - Onboarding
    
    struct Onboarding {
        private static let category = "\(prefix).onboarding"
        
        /// Per-user onboarding completion (keyed by userId)
        static func hasSeenOnboarding(userId: String) -> Bool {
            UserDefaults.standard.bool(forKey: "\(category).seen.\(userId)")
        }
        
        static func markOnboardingSeen(userId: String) {
            UserDefaults.standard.set(true, forKey: "\(category).seen.\(userId)")
        }
        
        /// Device-level onboarding (fallback for anonymous users)
        static func hasSeenDeviceOnboarding() -> Bool {
            UserDefaults.standard.bool(forKey: "\(category).seen.device")
        }
        
        static func markDeviceOnboardingSeen() {
            UserDefaults.standard.set(true, forKey: "\(category).seen.device")
        }
    }
    
    // MARK: - Coach Marks
    
    struct CoachMarks {
        private static let category = "\(prefix).coachmarks"
        
        static func hasSeen(_ key: String) -> Bool {
            UserDefaults.standard.bool(forKey: "\(category).\(key)")
        }
        
        static func markAsSeen(_ key: String) {
            UserDefaults.standard.set(true, forKey: "\(category).\(key)")
        }
    }
    
    // MARK: - Banners
    
    struct Banners {
        private static let category = "\(prefix).banners"
        
        /// Critical risk banner - per job
        static func hasShownCriticalBanner(jobId: String) -> Bool {
            UserDefaults.standard.bool(forKey: "\(category).criticalSeen.\(jobId)")
        }
        
        static func markCriticalBannerShown(jobId: String) {
            UserDefaults.standard.set(true, forKey: "\(category).criticalSeen.\(jobId)")
        }
    }
    
    // MARK: - Tips/Hints
    
    struct Tips {
        private static let category = "\(prefix).tips"
        
        static func hasSeenLongPressHint() -> Bool {
            UserDefaults.standard.bool(forKey: "\(category).longPressHint")
        }
        
        static func markLongPressHintSeen() {
            UserDefaults.standard.set(true, forKey: "\(category).longPressHint")
        }
    }
    
    // MARK: - Setup
    
    struct Setup {
        private static let category = "\(prefix).setup"
        
        static func isChecklistDismissed() -> Bool {
            UserDefaults.standard.bool(forKey: "\(category).checklistDismissed")
        }
        
        static func markChecklistDismissed() {
            UserDefaults.standard.set(true, forKey: "\(category).checklistDismissed")
        }
    }
    
    // MARK: - Production Toggles
    
    struct Production {
        private static let category = "\(prefix).production"
        
        /// Send Diagnostics toggle (off by default)
        static var sendDiagnostics: Bool {
            get {
                UserDefaults.standard.bool(forKey: "\(category).sendDiagnostics")
            }
            set {
                UserDefaults.standard.set(newValue, forKey: "\(category).sendDiagnostics")
            }
        }
        
        /// Reset all onboarding and coach marks (dev/internal only)
        static func resetOnboardingAndCoachMarks() {
            let defaults = UserDefaults.standard
            
            // Clear all onboarding flags
            let onboardingKeys = defaults.dictionaryRepresentation().keys.filter { $0.contains("\(prefix).onboarding") }
            for key in onboardingKeys {
                defaults.removeObject(forKey: key)
            }
            
            // Clear all coach marks
            let coachMarkKeys = defaults.dictionaryRepresentation().keys.filter { $0.contains("\(prefix).coachmarks") }
            for key in coachMarkKeys {
                defaults.removeObject(forKey: key)
            }
            
            // Clear tips
            let tipKeys = defaults.dictionaryRepresentation().keys.filter { $0.contains("\(prefix).tips") }
            for key in tipKeys {
                defaults.removeObject(forKey: key)
            }
        }
    }
    
    // MARK: - Legacy Migration
    
    /// Migrate old keys to new namespaced format
    static func migrateLegacyKeys() {
        let defaults = UserDefaults.standard
        
        // Migrate onboarding
        if defaults.bool(forKey: "trust_onboarding_complete") {
            defaults.set(true, forKey: "\(prefix).onboarding.seen.device")
            defaults.removeObject(forKey: "trust_onboarding_complete")
        }
        
        if defaults.bool(forKey: "onboarding_complete") {
            defaults.set(true, forKey: "\(prefix).onboarding.seen.device")
            defaults.removeObject(forKey: "onboarding_complete")
        }
        
        if defaults.bool(forKey: "first_run_complete") {
            defaults.set(true, forKey: "\(prefix).onboarding.seen.device")
            defaults.removeObject(forKey: "first_run_complete")
        }
        
        // Migrate coach marks
        let coachMarkKeys = ["operations_fab", "operations_risk_strip", "operations_ledger"]
        for key in coachMarkKeys {
            if defaults.bool(forKey: "coach_mark_\(key)") {
                defaults.set(true, forKey: "\(prefix).coachmarks.\(key)")
                defaults.removeObject(forKey: "coach_mark_\(key)")
            }
        }
        
        // Migrate setup checklist
        if defaults.bool(forKey: "setup_checklist_dismissed") {
            defaults.set(true, forKey: "\(prefix).setup.checklistDismissed")
            defaults.removeObject(forKey: "setup_checklist_dismissed")
        }
    }
}
