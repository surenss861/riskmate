import SwiftUI

/// Anchored Proof loading — first trust moment. Mechanical, deliberate, no spinner.
/// Motion: top rect slides down → hard snap → 150–250ms glow → freeze. Copy: "Anchoring records…" → "Ledger verified"
struct SplashView: View {
    var body: some View {
        AnchoredProofLoadingView()
    }
}

#Preview {
    SplashView()
}
