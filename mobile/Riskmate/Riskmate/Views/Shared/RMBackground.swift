import SwiftUI

/// RiskMate background - flat, premium, subtle vignette (no gradient glow)
struct RMBackground: View {
    var body: some View {
        ZStack {
            Color(hex: "#0A0A0A")
                .ignoresSafeArea(.all)
            
            // Subtle vignette for depth (not a tint)
            RadialGradient(
                gradient: Gradient(colors: [
                    Color.black.opacity(0.0),
                    Color.black.opacity(0.65)
                ]),
                center: .center,
                startRadius: 120,
                endRadius: 850
            )
            .ignoresSafeArea(.all)
            .blendMode(.multiply)
        }
    }
}

#Preview {
    RMBackground()
}
