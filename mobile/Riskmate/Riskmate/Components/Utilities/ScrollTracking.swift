import SwiftUI

/// Shared scroll-Y preference for divider fade-in (Work Records, Ledger, etc.).
struct ScrollYKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

struct TrackScrollY: ViewModifier {
    let space: String
    func body(content: Content) -> some View {
        content
            .background(
                GeometryReader { proxy in
                    Color.clear
                        .preference(key: ScrollYKey.self, value: proxy.frame(in: .named(space)).minY)
                }
            )
    }
}

extension View {
    /// Report this view’s minY in the named coordinate space for scroll-driven UI (e.g. divider opacity).
    func trackScrollY(in space: String) -> some View {
        modifier(TrackScrollY(space: space))
    }
}
