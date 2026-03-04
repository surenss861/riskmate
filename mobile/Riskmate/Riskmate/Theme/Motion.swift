import SwiftUI

/// Canonical motion tokens — same language across the app (and shareable conceptually with web).
/// Use these so transitions and microinteractions feel consistent, not random.
enum RMMotion {
    // MARK: - Springs (selections, toggles, “alive” feedback)
    
    /// Selection / pill / chip (snappy, not bouncy)
    static var spring: Animation {
        .spring(response: 0.35, dampingFraction: 0.75)
    }
    
    /// Button press / FAB (slightly bouncy)
    static var springPress: Animation {
        .spring(response: 0.3, dampingFraction: 0.6)
    }
    
    /// Softer spring for large elements (e.g. sheet)
    static var springSoft: Animation {
        .spring(response: 0.45, dampingFraction: 0.82)
    }
    
    // MARK: - Ease (fades, content crossfades)
    
    /// Standard content fade / crossfade
    static var easeOut: Animation {
        .easeOut(duration: 0.22)
    }
    
    /// Slightly longer fade (e.g. overlay)
    static var easeOutSlow: Animation {
        .easeOut(duration: 0.3)
    }
    
    /// Stagger delay step between list items
    static let staggerStep: Double = 0.04
    
    // MARK: - Durations (for manual animations)
    
    static let durationFast: Double = 0.2
    static let durationNormal: Double = 0.28
    static let durationSlow: Double = 0.4
    
    // MARK: - Shimmer (skeleton)
    
    static let shimmerDuration: Double = 1.8
    static let shimmerOpacity: Double = 0.06
}
