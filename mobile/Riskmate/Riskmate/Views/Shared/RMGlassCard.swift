import SwiftUI

/// RiskMate glass card - Apple-native material (no gradients)
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
                    .fill(.ultraThinMaterial)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .stroke(Color.white.opacity(0.10), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.45), radius: 26, x: 0, y: 18)
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
