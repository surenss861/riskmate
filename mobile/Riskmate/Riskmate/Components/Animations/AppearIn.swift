import SwiftUI

/// Subtle appear animation - Apple-grade motion (felt, not seen)
struct AppearIn: ViewModifier {
    @State private var shown = false
    
    func body(content: Content) -> some View {
        content
            .opacity(shown ? 1 : 0)
            .offset(y: shown ? 0 : 8)
            .animation(.easeOut(duration: 0.25), value: shown)
            .onAppear { shown = true }
    }
}

extension View {
    func appearIn() -> some View {
        modifier(AppearIn())
    }
}
