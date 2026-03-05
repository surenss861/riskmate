import SwiftUI

/// System-native card: material for pinned chrome, solid surface for scroll content (Wallet/Health feel).
struct RMCard<Content: View>: View {
    let content: Content
    /// When true, use solid surface2 (no blur) so list content doesn’t become “blur soup.”
    var useSolidSurface: Bool = false

    init(useSolidSurface: Bool = false, @ViewBuilder content: () -> Content) {
        self.useSolidSurface = useSolidSurface
        self.content = content()
    }

    private let radius = RMTheme.Radius.card
    private let cardPadding: CGFloat = 14

    var body: some View {
        content
            .padding(cardPadding)
            .background(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .fill(useSolidSurface ? RMTheme.Colors.surface2.opacity(0.92) : Color.clear)
                    .overlay(
                        Group {
                            if useSolidSurface {
                                // Subtle top highlight so it feels attached, not flat
                                RoundedRectangle(cornerRadius: radius, style: .continuous)
                                    .stroke(
                                        LinearGradient(
                                            colors: [Color.white.opacity(0.08), Color.clear],
                                            startPoint: .top,
                                            endPoint: .center
                                        ),
                                        lineWidth: 1
                                    )
                                    .padding(1)
                            } else {
                                VisualEffectBlur(style: .systemMaterial)
                                    .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
                            }
                        }
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: radius, style: .continuous)
                            .fill(Color.black.opacity(useSolidSurface ? 0 : 0.04))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: radius, style: .continuous)
                            .stroke(RMTheme.Colors.border.opacity(RMTheme.Surfaces.strokeOpacity), lineWidth: 1)
                    )
            )
    }
}
