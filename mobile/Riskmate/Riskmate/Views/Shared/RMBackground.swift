import SwiftUI

/// RiskMate background - matches web app exactly (flat dark, no gradient)
struct RMBackground: View {
    var body: some View {
        ZStack {
            // Base dark background
            Color(hex: "#0A0A0A")
                .ignoresSafeArea(.all)
            
            // Optional: subtle vignette for depth (NOT a gradient glow)
            RadialGradient(
                gradient: Gradient(colors: [
                    Color.black.opacity(0.0),
                    Color.black.opacity(0.55)
                ]),
                center: .center,
                startRadius: 140,
                endRadius: 700
            )
            .ignoresSafeArea(.all)
            .blendMode(.multiply)
        }
    }
}

#Preview {
    RMBackground()
}
