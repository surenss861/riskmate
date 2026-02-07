import SwiftUI

/// Anchored Proof™ symbol — two elements, one resolved structure.
/// Geometry: 24×24 grid. Bottom 16×6, Top 12×5, +1 offset right.
struct AnchoredProofSymbol: View {
    var size: CGFloat = 80
    var color: Color = RMTheme.Colors.accent
    /// Offset for loading animation: negative = top block up (misaligned), 0 = locked
    var topOffset: CGFloat = 0
    var glowOpacity: Double = 0

    private var scale: CGFloat { size / 24 }

    var body: some View {
        VStack(spacing: 1 * scale) {
            // Top block (Proof): 12×5, +1 right offset, animatable
            RoundedRectangle(cornerRadius: 0)
                .fill(color)
                .frame(width: 12 * scale, height: 5 * scale)
                .offset(x: 1 * scale, y: topOffset)
            // Bottom block (Anchor): 16×6, center
            RoundedRectangle(cornerRadius: 0)
                .fill(color)
                .frame(width: 16 * scale, height: 6 * scale)
        }
        .frame(width: size, height: size, alignment: .bottom)
        .shadow(color: color.opacity(glowOpacity), radius: 10, x: 0, y: 0)
    }
}

/// Loading sequence: Anchored Proof motion + copy transition
struct AnchoredProofLoadingView: View {
    @State private var phase: Phase = .anchoring
    @State private var topOffset: CGFloat = -12
    @State private var glowOpacity: Double = 0

    enum Phase {
        case anchoring   // Top slides down, "Anchoring records…"
        case snap        // Hard stop, glow
        case verified    // "Ledger verified", freeze
    }

    var body: some View {
        ZStack {
            RMTheme.Colors.background
                .ignoresSafeArea()

            VStack(spacing: 24) {
                AnchoredProofSymbol(
                    size: 88,
                    topOffset: topOffset,
                    glowOpacity: glowOpacity
                )

                Text(phase == .verified ? "Ledger verified" : "Anchoring records…")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(RMTheme.Colors.textSecondary)
                    .animation(.easeOut(duration: 0.2), value: phase)
            }
        }
        .onAppear {
            runSequence()
        }
    }

    private func runSequence() {
        // Phase 1: Top slides down (350ms) — mechanical, no bounce
        withAnimation(.linear(duration: 0.35)) {
            topOffset = 0
        }

        // Phase 2: Snap + glow at ~400ms (150–250ms glow)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
            phase = .snap
            withAnimation(.linear(duration: 0.18)) {
                glowOpacity = 0.32
            }
        }

        // Phase 3: Copy → "Ledger verified", glow settle (~750ms)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
            phase = .verified
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.85) {
            withAnimation(.linear(duration: 0.15)) {
                glowOpacity = 0.1
            }
        }
    }
}

#Preview("Symbol") {
    ZStack {
        RMTheme.Colors.background
        AnchoredProofSymbol(size: 80)
    }
}

#Preview("Loading") {
    AnchoredProofLoadingView()
}
