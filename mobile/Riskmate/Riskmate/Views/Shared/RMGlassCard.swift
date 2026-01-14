import SwiftUI

/// RiskMate glass card - native material, not gradient-y
struct RMGlassCard<Content: View>: View {
    let content: Content
    
    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }
    
    var body: some View {
        content
            .padding(24)
            .background(
                RoundedRectangle(cornerRadius: 26, style: .continuous)
                    .fill(.ultraThinMaterial) // iOS-native glass
                    .overlay(
                        RoundedRectangle(cornerRadius: 26, style: .continuous)
                            .stroke(Color.white.opacity(0.10), lineWidth: 1)
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
