import SwiftUI
import UIKit

/// RiskMate Design System - Single source of truth for all design tokens
/// Consolidates brand (RMTheme) and system-native (RMSystemTheme) patterns
/// Use this for all new components to maintain consistency
struct RiskMateDesignSystem {
    
    // MARK: - Colors
    
    struct Colors {
        // Backgrounds (Dark theme - brand)
        static let background = Color(hex: "#0A0A0A", alpha: 1.0)
        static let surface = Color(hex: "#121212", alpha: 1.0)
        static let cardBackground = Color(hex: "#0B0B0C", alpha: 0.72)
        
        // Accent (Orange - brand identity)
        static let accent = Color(hex: "#F97316", alpha: 1.0)
        static let accentLight = Color(hex: "#FB923C", alpha: 1.0)
        static let accentDark = Color(hex: "#EA580C", alpha: 1.0)
        
        // Text (Hierarchy)
        static let textPrimary = Color.white
        static let textSecondary = Color.white.opacity(0.65)
        static let textTertiary = Color.white.opacity(0.45)
        static let textPlaceholder = Color.white.opacity(0.38)
        static let textMuted = Color.white.opacity(0.30)
        
        // Borders & Dividers
        static let border = Color.white.opacity(0.10)
        static let divider = Color.white.opacity(0.10)
        static let separator = Color(.separator)
        
        // Inputs
        static let inputFill = Color.white.opacity(0.06)
        static let inputStroke = Color.white.opacity(0.10)
        static let inputStrokeFocused = Color(hex: "#F97316", alpha: 0.55)
        
        // Risk Colors (Semantic - use system colors for accessibility)
        static let riskCritical = Color(.systemRed)
        static let riskHigh = Color(.systemOrange)
        static let riskMedium = Color(.systemYellow)
        static let riskLow = Color(.systemGreen)
        
        // Status (Semantic)
        static let success = Color(.systemGreen)
        static let error = Color(.systemRed)
        static let warning = Color(.systemOrange)
        static let info = Color(.systemBlue)
        
        // Category Pills (Ledger)
        static let categoryAccess = Color(.systemBlue)
        static let categoryOperations = Color(.systemPurple)
        static let categoryGovernance = Color(.systemGreen)
    }
    
    // MARK: - Typography
    
    struct Typography {
        // Titles
        static let largeTitle = Font.system(size: 34, weight: .bold, design: .default)
        static let title = Font.system(size: 28, weight: .bold, design: .default)
        static let title2 = Font.system(size: 22, weight: .semibold, design: .default)
        static let title3 = Font.system(size: 20, weight: .semibold, design: .default)
        
        // Headings
        static let headingLarge = Font.system(size: 28, weight: .bold, design: .default)
        static let headingSmall = Font.system(size: 18, weight: .semibold, design: .default)
        static let headline = Font.headline
        static let subheadline = Font.subheadline
        
        // Body
        static let body = Font.system(size: 17, weight: .regular, design: .default)
        static let bodyBold = Font.system(size: 17, weight: .semibold, design: .default)
        static let bodySmall = Font.system(size: 15, weight: .regular, design: .default)
        static let bodySmallBold = Font.system(size: 15, weight: .semibold, design: .default)
        
        // Captions
        static let caption = Font.system(size: 13, weight: .regular, design: .default)
        static let captionBold = Font.system(size: 13, weight: .semibold, design: .default)
        static let caption2 = Font.caption2
        static let captionSmall = Font.system(size: 11, weight: .regular, design: .default)
        
        // Monospaced (for hashes, IDs)
        static let monospaced = Font.system(.footnote, design: .monospaced)
    }
    
    // MARK: - Spacing Scale (4/8/12/16/24/32)
    
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
    
    // MARK: - Corner Radius
    
    struct Radius {
        static let xs: CGFloat = 8
        static let sm: CGFloat = 12
        static let md: CGFloat = 16
        static let lg: CGFloat = 24
        static let xl: CGFloat = 26 // Glass cards
        static let card: CGFloat = 24
        static let pill: CGFloat = 12
    }
    
    // MARK: - Shadows (3 levels max)
    
    struct Shadow {
        static let small = ShadowStyle(
            color: .black.opacity(0.2),
            radius: 4,
            x: 0,
            y: 2
        )
        
        static let card = ShadowStyle(
            color: .black.opacity(0.3),
            radius: 12,
            x: 0,
            y: 6
        )
        
        static let button = ShadowStyle(
            color: Color(hex: "#F97316", alpha: 0.18),
            radius: 18,
            x: 0,
            y: 10
        )
    }
    
    struct ShadowStyle {
        let color: Color
        let radius: CGFloat
        let x: CGFloat
        let y: CGFloat
    }
    
    // MARK: - Blur Materials
    
    enum MaterialStyle {
        case thin
        case regular
        case thick
        case ultraThin
        
        var swiftUIMaterial: Material {
            switch self {
            case .thin: return .thin
            case .regular: return .regular
            case .thick: return .thick
            case .ultraThin: return .ultraThin
            }
        }
    }
    
    // MARK: - Motion Constants
    
    struct Motion {
        // Durations
        static let fast: Double = 0.2
        static let normal: Double = 0.3
        static let slow: Double = 0.5
        
        // Springs (response, dampingFraction) - respects Reduce Motion
        static var springFast: SwiftUI.Animation {
            if UIAccessibility.isReduceMotionEnabled {
                return .linear(duration: 0.1)
            }
            return .spring(response: 0.25, dampingFraction: 0.9)
        }
        
        static var spring: SwiftUI.Animation {
            if UIAccessibility.isReduceMotionEnabled {
                return .linear(duration: 0.1)
            }
            return .spring(response: 0.35, dampingFraction: 0.9)
        }
        
        static var springSlow: SwiftUI.Animation {
            if UIAccessibility.isReduceMotionEnabled {
                return .linear(duration: 0.1)
            }
            return .spring(response: 0.5, dampingFraction: 0.85)
        }
        
        // Easing - respects Reduce Motion
        static var smooth: SwiftUI.Animation {
            if UIAccessibility.isReduceMotionEnabled {
                return .linear(duration: 0.1)
            }
            return .easeInOut(duration: 0.3)
        }
        
        static var easeOut: SwiftUI.Animation {
            if UIAccessibility.isReduceMotionEnabled {
                return .linear(duration: 0.1)
            }
            return .easeOut(duration: 0.3)
        }
        
        static var easeIn: SwiftUI.Animation {
            if UIAccessibility.isReduceMotionEnabled {
                return .linear(duration: 0.1)
            }
            return .easeIn(duration: 0.3)
        }
    }
    
    // MARK: - Haptics Wrapper
    
    struct Haptics {
        /// Light tap - subtle interactions (toggles, filter changes)
        static func tap() {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        }
        
        /// Medium impact - primary actions (button presses, selections)
        static func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .medium) {
            UIImpactFeedbackGenerator(style: style).impactOccurred()
        }
        
        /// Success notification - confirmations (copy, export, success states)
        static func success() {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        }
        
        /// Warning notification - destructive actions (sign out, delete)
        static func warning() {
            UINotificationFeedbackGenerator().notificationOccurred(.warning)
        }
        
        /// Error notification - errors, failures
        static func error() {
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        }
    }
}

// MARK: - View Extensions

extension View {
    /// Apply RiskMate shadow style
    func riskMateShadow(_ style: RiskMateDesignSystem.ShadowStyle) -> some View {
        self.shadow(color: style.color, radius: style.radius, x: style.x, y: style.y)
    }
    
    /// Apply RiskMate blur material
    func riskMateMaterial(_ style: RiskMateDesignSystem.MaterialStyle) -> some View {
        self.background(style.swiftUIMaterial)
    }
}

// MARK: - Color Extension for Hex
// Note: Color(hex:) extension is defined in DesignSystem.swift to avoid ambiguity
