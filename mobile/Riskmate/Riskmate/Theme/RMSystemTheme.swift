import SwiftUI

/// System-native Apple design system - matches iOS Settings/Wallet/Health
struct RMSystemTheme {
    // MARK: - Colors (System Semantic)
    
    struct Colors {
        // Text (system semantic)
        static let textPrimary = Color(.label)
        static let textSecondary = Color(.secondaryLabel)
        static let textTertiary = Color(.tertiaryLabel)
        static let textPlaceholder = Color(.placeholderText)
        
        // Backgrounds (system semantic)
        static let background = Color(.systemBackground)
        static let secondaryBackground = Color(.secondarySystemBackground)
        static let tertiaryBackground = Color(.tertiarySystemBackground)
        
        // Separators
        static let separator = Color(.separator)
        static let opaqueSeparator = Color(.opaqueSeparator)
        
        // Accent (brand - use sparingly)
        static let accent = Color(hex: "#F97316") // Orange - only for primary actions
        static let accentLight = Color(hex: "#FB923C")
        static let accentDark = Color(hex: "#EA580C")
        
        // Risk (system semantic)
        static let critical = Color(.systemRed)
        static let high = Color(.systemOrange)
        static let medium = Color(.systemYellow)
        static let low = Color(.systemGreen)
        
        // Status
        static let success = Color(.systemGreen)
        static let error = Color(.systemRed)
        static let warning = Color(.systemOrange)
        static let info = Color(.systemBlue)
        
        // Category Pills (keep for distinction)
        static let categoryAccess = Color(.systemBlue)
        static let categoryOperations = Color(.systemPurple)
        static let categoryGovernance = Color(.systemGreen)
    }
    
    // MARK: - Spacing (8/12/16/24 rhythm)
    
    struct Spacing {
        static let xs: CGFloat = 8
        static let sm: CGFloat = 12
        static let md: CGFloat = 16
        static let lg: CGFloat = 24
        static let xl: CGFloat = 32
        
        // Layout tokens
        static let pagePadding: CGFloat = 16
        static let sectionSpacing: CGFloat = 16
    }
    
    // MARK: - Corner Radius (12-16 for cards, 10-12 for pills)
    
    struct Radius {
        static let sm: CGFloat = 10
        static let md: CGFloat = 12
        static let lg: CGFloat = 16
        static let pill: CGFloat = 12
    }
    
    // MARK: - Typography (System Hierarchy)
    
    struct Typography {
        // Titles
        static let largeTitle = Font.largeTitle.weight(.bold)
        static let title = Font.title.weight(.bold)
        static let title2 = Font.title2.weight(.bold)
        static let title3 = Font.title3.weight(.semibold)
        
        // Headers
        static let headline = Font.headline
        static let subheadline = Font.subheadline
        
        // Body
        static let body = Font.body
        static let bodyBold = Font.body.weight(.semibold)
        static let callout = Font.callout
        
        // Captions
        static let caption = Font.caption
        static let caption2 = Font.caption2
        static let footnote = Font.footnote
        
        // Monospaced (for hashes)
        static let monospaced = Font.system(.footnote, design: .monospaced)
    }
}

// MARK: - Color Extension for Hex

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
