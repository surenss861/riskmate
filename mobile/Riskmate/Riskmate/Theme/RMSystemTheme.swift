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
        static let accent = Color(hex: "#F97316", alpha: 1.0) // Orange - only for primary actions
        static let accentLight = Color(hex: "#FB923C", alpha: 1.0)
        static let accentDark = Color(hex: "#EA580C", alpha: 1.0)
        
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
// Note: Color(hex:) extension is defined in DesignSystem.swift to avoid ambiguity
