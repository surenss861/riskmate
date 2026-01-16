import SwiftUI
import Combine

/// Accessibility extensions for Dynamic Type, VoiceOver, and contrast
extension View {
    /// Applies Dynamic Type scaling with layout preservation
    func dynamicTypeScalable() -> some View {
        self.dynamicTypeSize(...DynamicTypeSize.accessibility5)
    }
    
    /// Adds VoiceOver label and hint
    func accessible(_ label: String, hint: String? = nil) -> some View {
        var view = self.accessibilityLabel(label)
        if let hint = hint {
            view = view.accessibilityHint(hint)
        }
        return view
    }
    
    /// Respects Reduce Motion preference
    func respectsReduceMotion() -> some View {
        self.animation(nil, value: UUID())
    }
}

/// Reduce Motion support
@MainActor
class MotionPreference: ObservableObject {
    static let shared = MotionPreference()
    @Published var prefersReducedMotion: Bool = false
    
    private init() {
        // Check system preference
        prefersReducedMotion = UIAccessibility.isReduceMotionEnabled
    }
}

/// Animation that respects Reduce Motion
extension Animation {
    static var accessibleSpring: Animation {
        if MotionPreference.shared.prefersReducedMotion {
            return .linear(duration: 0.1)
        } else {
            return .spring(response: 0.3, dampingFraction: 0.7)
        }
    }
    
    static var accessibleDefault: Animation {
        if MotionPreference.shared.prefersReducedMotion {
            return .linear(duration: 0.1)
        } else {
            return .default
        }
    }
}

enum ContrastLevel {
    case standard
    case increased
}

/// Accessibility helper for buttons
extension Button {
    func accessibleButton(label: String, hint: String? = nil) -> some View {
        self
            .accessibilityLabel(label)
            .accessibilityAddTraits(.isButton)
            .apply { view in
                if let hint = hint {
                    return view.accessibilityHint(hint)
                } else {
                    return view
                }
            }
    }
}

extension View {
    @ViewBuilder
    func apply<T: View>(_ transform: (Self) -> T) -> some View {
        transform(self)
    }
}

/// Accessibility helper for images
extension Image {
    func accessibleImage(label: String, decorative: Bool = false) -> some View {
        if decorative {
            return self.accessibilityHidden(true)
        } else {
            return self.accessibilityLabel(label)
        }
    }
}

/// Accessibility helper for text
extension Text {
    func accessibleText(label: String? = nil) -> some View {
        if let label = label {
            return self.accessibilityLabel(label)
        } else {
            return self
        }
    }
}
