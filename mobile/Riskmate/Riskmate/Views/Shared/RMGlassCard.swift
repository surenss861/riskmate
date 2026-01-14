import SwiftUI

/// RiskMate glass card - matches web app card styling
struct RMGlassCard<Content: View>: View {
    let content: Content
    
    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }
    
    var body: some View {
        content
            .padding(24)
            .background(
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .fill(Color(hex: "#121212").opacity(0.80))
                    .overlay(
                        // Glass edge highlight (web-style, not gradient)
                        RoundedRectangle(cornerRadius: 28, style: .continuous)
                            .stroke(
                                LinearGradient(
                                    colors: [Color.white.opacity(0.18), Color.white.opacity(0.02)],
                                    startPoint: .top,
                                    endPoint: .bottom
                                ),
                                lineWidth: 1
                            )
                    )
                    .overlay(
                        // Base border
                        RoundedRectangle(cornerRadius: 28, style: .continuous)
                            .stroke(Color.white.opacity(0.08), lineWidth: 1)
                    )
            )
            .shadow(color: .black.opacity(0.35), radius: 18, x: 0, y: 12)
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
