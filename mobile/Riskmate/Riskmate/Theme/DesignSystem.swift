import SwiftUI

/// RiskMate Design System - matches web app exactly
struct DesignSystem {
    // Colors
    struct Colors {
        static let background = Color(hex: "#0A0A0A") // Minimal black
        static let surface = Color(hex: "#121212") // Card background
        static let accent = Color(hex: "#F97316") // Orange
        static let accentLight = Color(hex: "#FB923C") // Light orange
        static let textPrimary = Color.white
        static let textSecondary = Color(hex: "#A1A1A1") // Muted gray
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
    init(hex: String, alpha: Double = 1.0) {
        var hex = hex.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        // Strip # prefix if present
        if hex.hasPrefix("#") {
            hex.removeFirst()
        }
        
        var rgb: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&rgb)
        
        let r, g, b: Double
        if hex.count == 6 {
            r = Double((rgb & 0xFF0000) >> 16) / 255.0
            g = Double((rgb & 0x00FF00) >> 8) / 255.0
            b = Double(rgb & 0x0000FF) / 255.0
            self.init(.sRGB, red: r, green: g, blue: b, opacity: alpha)
        } else if hex.count == 8 {
            // ARGB format
            let a = Double((rgb & 0xFF000000) >> 24) / 255.0
            r = Double((rgb & 0x00FF0000) >> 16) / 255.0
            g = Double((rgb & 0x0000FF00) >> 8) / 255.0
            b = Double(rgb & 0x000000FF) / 255.0
            self.init(.sRGB, red: r, green: g, blue: b, opacity: a)
        } else {
            // Fallback to black so it never becomes invisible
            self.init(.sRGB, red: 0, green: 0, blue: 0, opacity: 1)
        }
    }
}
