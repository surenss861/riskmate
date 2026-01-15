import SwiftUI

/// RiskMate glass card - iOS material + web sharpness (hybrid)
struct RMGlassCard<Content: View>: View {
    let content: Content
    
    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }
    
    var body: some View {
        content
            .padding(RMTheme.Spacing.lg)
            .background {
                RoundedRectangle(cornerRadius: RMTheme.Radius.card, style: .continuous)
                    // iOS material base
                    .fill(.ultraThinMaterial)
                    // web-like dark tint (prevents grey mush)
                    .overlay(
                        RoundedRectangle(cornerRadius: RMTheme.Radius.card, style: .continuous)
                            .fill(RMTheme.Colors.cardBackground)
                    )
                    // crisp outer border (standardized: 1px white @ 10% opacity)
                    .overlay(
                        RoundedRectangle(cornerRadius: RMTheme.Radius.card, style: .continuous)
                            .stroke(Color.white.opacity(0.10), lineWidth: 1)
                    )
                    // inner "glass highlight" (web sharpness)
                    .overlay(
                        RoundedRectangle(cornerRadius: RMTheme.Radius.card, style: .continuous)
                            .stroke(
                                LinearGradient(
                                    colors: [
                                        Color.white.opacity(0.20),
                                        Color.white.opacity(0.03)
                                    ],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                lineWidth: 1
                            )
                            .blendMode(.screen)
                            .padding(0.5)
                    )
            }
            .themeShadow(RMTheme.Shadow.card)
    }
}

#Preview {
    RMBackground()
        .overlay {
            RMGlassCard {
                Text("Glass Card Content")
                    .foregroundColor(.white)
            }
            .padding()
        }
}
