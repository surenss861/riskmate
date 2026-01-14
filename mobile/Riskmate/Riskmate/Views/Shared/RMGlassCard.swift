import SwiftUI

/// RiskMate glass card - iOS material + web sharpness (hybrid)
struct RMGlassCard<Content: View>: View {
    let content: Content
    
    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }
    
    var body: some View {
        content
            .padding(24)
            .background {
                RoundedRectangle(cornerRadius: 26, style: .continuous)
                    // iOS material base
                    .fill(.ultraThinMaterial)
                    // web-like dark tint (prevents grey mush)
                    .overlay(
                        RoundedRectangle(cornerRadius: 26, style: .continuous)
                            .fill(Color(hex: "#0B0B0C").opacity(0.72))
                    )
                    // crisp outer border
                    .overlay(
                        RoundedRectangle(cornerRadius: 26, style: .continuous)
                            .stroke(Color.white.opacity(0.10), lineWidth: 1)
                    )
                    // inner "glass highlight" (web sharpness)
                    .overlay(
                        RoundedRectangle(cornerRadius: 26, style: .continuous)
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
            // tight shadow (sharp web depth)
            .shadow(color: .black.opacity(0.45), radius: 14, x: 0, y: 10)
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
