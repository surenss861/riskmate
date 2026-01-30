import UIKit

/// Apple-grade haptics - use as punctuation for important actions. No-op in simulator to avoid CHHapticPattern noise.
enum Haptics {
    static func tap() {
        #if !targetEnvironment(simulator)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        #endif
    }
    
    static func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .medium) {
        #if !targetEnvironment(simulator)
        UIImpactFeedbackGenerator(style: style).impactOccurred()
        #endif
    }
    
    static func success() {
        #if !targetEnvironment(simulator)
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        #endif
    }
    
    static func warning() {
        #if !targetEnvironment(simulator)
        UINotificationFeedbackGenerator().notificationOccurred(.warning)
        #endif
    }
    
    static func error() {
        #if !targetEnvironment(simulator)
        UINotificationFeedbackGenerator().notificationOccurred(.error)
        #endif
    }
}
