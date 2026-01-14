import SwiftUI

/// RiskMate background - pure iOS dark canvas (no gradients)
struct RMBackground: View {
    var body: some View {
        Color(hex: "#0A0A0A")
            .ignoresSafeArea(.all)
    }
}

#Preview {
    RMBackground()
}
