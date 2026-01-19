import SwiftUI

/// System-native card component with iOS Material blur
struct RMCard<Content: View>: View {
    let content: Content
    
    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }
    
    var body: some View {
        content
            .padding(RMSystemTheme.Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: RMSystemTheme.Radius.lg, style: .continuous)
                    .fill(Color.clear)
                    .overlay(
                        VisualEffectBlur(style: .systemMaterial)
                            .clipShape(RoundedRectangle(cornerRadius: RMSystemTheme.Radius.lg, style: .continuous))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: RMSystemTheme.Radius.lg, style: .continuous)
                            .stroke(RMSystemTheme.Colors.separator, lineWidth: 0.5)
                    )
            )
    }
}
