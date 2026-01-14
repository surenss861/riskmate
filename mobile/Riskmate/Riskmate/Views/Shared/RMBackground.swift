import SwiftUI

/// RiskMate background - matches web app exactly
struct RMBackground: View {
    var body: some View {
        ZStack {
            // Base dark background
            Color(hex: "#0A0A0A")
                .ignoresSafeArea(.all)
            
            // Subtle radial glow like web
            RadialGradient(
                gradient: Gradient(colors: [
                    Color(hex: "#F97316").opacity(0.14),
                    Color.clear
                ]),
                center: .top,
                startRadius: 10,
                endRadius: 520
            )
            .ignoresSafeArea(.all)
        }
    }
}

#Preview {
    RMBackground()
}
