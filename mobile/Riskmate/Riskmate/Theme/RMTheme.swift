import SwiftUI

/// Riskmate Design System - Single source of truth for all design tokens
/// Matches web brand while feeling native iOS
struct RMTheme {
    // MARK: - Colors
    
    struct Colors {
        // Backgrounds
        static let background = Color(hex: "#0A0A0A")
        static let surface = Color(hex: "#121212")
        static let cardBackground = Color(hex: "#0B0B0C").opacity(0.72)
        
        // Accent
        static let accent = Color(hex: "#F97316")
        static let accentLight = Color(hex: "#FB923C")
        static let accentDark = Color(hex: "#EA580C")
        
        // Text
        static let textPrimary = Color.white
        static let textSecondary = Color.white.opacity(0.65)
        static let textTertiary = Color.white.opacity(0.45)
        static let textPlaceholder = Color.white.opacity(0.38)
        
        // Inputs
        static let inputFill = Color.white.opacity(0.06)
        static let inputStroke = Color.white.opacity(0.10)
        static let inputStrokeFocused = Color(hex: "#F97316").opacity(0.55)
        
        // Borders & Dividers
        static let border = Color.white.opacity(0.10)
        static let divider = Color.white.opacity(0.10)
        
        // Status
        static let success = Color.green.opacity(0.8)
        static let error = Color.red.opacity(0.95)
        static let errorBackground = Color.red.opacity(0.1)
        static let errorBorder = Color.red.opacity(0.2)
        static let warning = Color.orange.opacity(0.8)
        static let info = Color.blue.opacity(0.8)
        
        // Category Pills
        static let categoryAccess = Color(hex: "#3B82F6") // Blue
        static let categoryOperations = Color(hex: "#8B5CF6") // Purple
        static let categoryGovernance = Color(hex: "#10B981") // Green
    }
    
    // MARK: - Spacing
    
    struct Spacing {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 16
        static let lg: CGFloat = 24
        static let xl: CGFloat = 32
        static let xxl: CGFloat = 48
        
        // Layout tokens
        static let pagePadding: CGFloat = 20
        static let sectionSpacing: CGFloat = 16
    }
    
    // MARK: - Typography
    
    struct Typography {
        // Titles
        static let largeTitle = Font.system(size: 34, weight: .bold, design: .default)
        static let title = Font.system(size: 28, weight: .bold, design: .default)
        static let title2 = Font.system(size: 22, weight: .semibold, design: .default)
        static let title3 = Font.system(size: 20, weight: .semibold, design: .default)
        static let headingLarge = Font.system(size: 28, weight: .bold, design: .default)
        static let headingSmall = Font.system(size: 18, weight: .semibold, design: .default)
        
        // Body
        static let body = Font.system(size: 17, weight: .regular, design: .default)
        static let bodyBold = Font.system(size: 17, weight: .semibold, design: .default)
        static let bodySmall = Font.system(size: 15, weight: .regular, design: .default)
        static let bodySmallBold = Font.system(size: 15, weight: .semibold, design: .default)
        
        // Captions
        static let caption = Font.system(size: 13, weight: .regular, design: .default)
        static let captionBold = Font.system(size: 13, weight: .semibold, design: .default)
        static let captionSmall = Font.system(size: 11, weight: .regular, design: .default)
    }
    
    // MARK: - Corner Radius
    
    struct Radius {
        static let xs: CGFloat = 8
        static let sm: CGFloat = 12
        static let md: CGFloat = 16
        static let lg: CGFloat = 24
        static let xl: CGFloat = 26 // Glass cards
        
        // Standardized card radius
        static let card: CGFloat = 24
    }
    
    // MARK: - Shadows
    
    struct Shadow {
        static let card = ShadowStyle(
            color: .black.opacity(0.3),
            radius: 12,
            x: 0,
            y: 6
        )
        
        static let button = ShadowStyle(
            color: Color(hex: "#F97316").opacity(0.18),
            radius: 18,
            x: 0,
            y: 10
        )
        
        static let small = ShadowStyle(
            color: .black.opacity(0.2),
            radius: 4,
            x: 0,
            y: 2
        )
    }
    
    struct ShadowStyle {
        let color: Color
        let radius: CGFloat
        let x: CGFloat
        let y: CGFloat
    }
    
    // MARK: - Animation
    
    struct Animation {
        static let spring = SwiftUI.Animation.spring(response: 0.35, dampingFraction: 0.9)
        static let springFast = SwiftUI.Animation.spring(response: 0.25, dampingFraction: 0.9)
        static let springSlow = SwiftUI.Animation.spring(response: 0.5, dampingFraction: 0.85)
        static let smooth = SwiftUI.Animation.easeInOut(duration: 0.3)
    }
}

// MARK: - View Extensions

extension View {
    func themeShadow(_ style: RMTheme.ShadowStyle) -> some View {
        self.shadow(color: style.color, radius: style.radius, x: style.x, y: style.y)
    }
}
