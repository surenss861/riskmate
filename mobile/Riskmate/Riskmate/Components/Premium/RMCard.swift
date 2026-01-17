import SwiftUI

/// Premium card component with depth, shadow, and glass effect
struct RMCard<Content: View>: View {
    let content: Content
    
    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }
    
    var body: some View {
        content
            .padding(RMTheme.Spacing.lg)
            .background(
                RoundedRectangle(cornerRadius: RMTheme.Radius.lg, style: .continuous)
                    .fill(RMTheme.Colors.surface.opacity(0.6))
                    .overlay(
                        RoundedRectangle(cornerRadius: RMTheme.Radius.lg, style: .continuous)
                            .stroke(RMTheme.Colors.border, lineWidth: 1)
                    )
            )
            .shadow(color: .black.opacity(0.35), radius: 18, x: 0, y: 10)
    }
}
