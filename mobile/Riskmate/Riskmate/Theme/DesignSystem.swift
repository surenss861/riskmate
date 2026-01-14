import SwiftUI

/// RiskMate Design System - matches web app exactly
struct DesignSystem {
    // Colors
    struct Colors {
        static let background = Color(hex: "0A0A0A") // Minimal black
        static let surface = Color(hex: "121212") // Card background
        static let accent = Color(hex: "F97316") // Orange
        static let accentLight = Color(hex: "FB923C") // Light orange
        static let textPrimary = Color.white
        static let textSecondary = Color(hex: "A1A1A1") // Muted gray
        static let border = Color.white.opacity(0.1)
        static let error = Color.red.opacity(0.4)
        static let errorBackground = Color.red.opacity(0.1)
        static let errorBorder = Color.red.opacity(0.2)
    }
    
    // Spacing
    struct Spacing {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 16
        static let lg: CGFloat = 24
        static let xl: CGFloat = 32
        static let xxl: CGFloat = 48
    }
    
    // Typography
    struct Typography {
        static let title = Font.system(size: 30, weight: .bold, design: .default)
        static let body = Font.system(size: 16, weight: .regular, design: .default)
        static let bodySmall = Font.system(size: 14, weight: .regular, design: .default)
        static let caption = Font.system(size: 12, weight: .regular, design: .default)
    }
    
    // Corner Radius
    struct Radius {
        static let small: CGFloat = 8
        static let medium: CGFloat = 12
        static let large: CGFloat = 16
    }
}

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
