import SwiftUI
import Combine

/// Observable source for Reduce Motion so we react when the user toggles it in Settings while app is open.
final class RMMotionObserver: ObservableObject {
    static let shared = RMMotionObserver()
    @Published private(set) var reduceMotion: Bool

    private init() {
        reduceMotion = UIAccessibility.isReduceMotionEnabled
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(reduceMotionStatusDidChange),
            name: UIAccessibility.reduceMotionStatusDidChangeNotification,
            object: nil
        )
    }

    @objc private func reduceMotionStatusDidChange() {
        let newValue = UIAccessibility.isReduceMotionEnabled
        if newValue != reduceMotion {
            reduceMotion = newValue
        }
    }
}

/// Canonical motion tokens — same language across the app (and shareable with web via docs/MOTION_TOKENS.md).
/// Guardrails: Reduce Motion shortens durations and disables offset/shimmer; one canonical style per interaction.
enum RMMotion {
    /// When true, use shorter durations and no y-offset / no shimmer sweep (prevents jank and respects accessibility).
    /// Reads from RMMotionObserver.shared so toggling Reduce Motion in Settings updates the app without restart.
    static var reduceMotion: Bool {
        RMMotionObserver.shared.reduceMotion
    }
    
    // MARK: - Canonical styles (one per interaction — don’t mix)
    // press = springPress | selection = spring | appear = easeOut | skeleton = shimmer
    
    /// Selection / pill / chip (snappy)
    static var spring: Animation {
        reduceMotion ? .easeOut(duration: durationFast) : .spring(response: 0.35, dampingFraction: 0.75)
    }
    
    /// Button press / FAB
    static var springPress: Animation {
        reduceMotion ? .easeOut(duration: durationFast) : .spring(response: 0.3, dampingFraction: 0.6)
    }
    
    /// Softer spring (e.g. sheet)
    static var springSoft: Animation {
        reduceMotion ? .easeOut(duration: durationNormal) : .spring(response: 0.45, dampingFraction: 0.82)
    }
    
    /// Standard content fade / crossfade (appear)
    static var easeOut: Animation {
        .easeOut(duration: reduceMotion ? durationFast : 0.22)
    }
    
    /// Slightly longer fade (e.g. overlay)
    static var easeOutSlow: Animation {
        .easeOut(duration: reduceMotion ? durationNormal : 0.3)
    }
    
    /// Stagger delay step (cap list stagger at 12 in callers for perf).
    static let staggerStep: Double = 0.045
    
    // MARK: - Durations
    
    static let durationFast: Double = 0.14
    static let durationNormal: Double = 0.22
    static let durationSlow: Double = 0.32
    
    // MARK: - Shimmer (skeleton only; respect Reduce Motion)
    
    static var shimmerDuration: Double {
        reduceMotion ? 0 : 1.25
    }
    static var shimmerOpacity: Double {
        reduceMotion ? 0 : 0.22
    }
}
