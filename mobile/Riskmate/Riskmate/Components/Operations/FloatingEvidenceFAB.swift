import SwiftUI

/// Floating Action Button for Add Evidence - elevated primary action with glow pulse
struct FloatingEvidenceFAB: View {
    let action: () -> Void
    @State private var isPressed = false
    @State private var glowPulse: Double = 0.0
    @Environment(\.scenePhase) private var scenePhase
    
    var body: some View {
        Button {
            Haptics.impact(.medium)
            Analytics.shared.trackEvidenceCaptureStarted()
            Analytics.shared.trackAddEvidenceTapped()
            // Bounce animation on tap (respects Reduce Motion)
            if UIAccessibility.isReduceMotionEnabled {
                action()
            } else {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.5)) {
                    isPressed = true
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.5)) {
                        isPressed = false
                    }
                }
                action()
            }
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "camera.fill")
                    .font(.system(size: 18, weight: .semibold))
                Text("Add Evidence")
                    .font(RMSystemTheme.Typography.bodyBold)
            }
            .foregroundColor(.black)
            .padding(.horizontal, 20)
            .padding(.vertical, 14)
            .background(
                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [RMSystemTheme.Colors.accent, RMSystemTheme.Colors.accent.opacity(0.8)],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .shadow(
                        color: RMSystemTheme.Colors.accent.opacity((0.34 + glowPulse * 0.17) * 0.85), // Reduced by ~15%
                        radius: (12 + glowPulse * 4) * 0.9, // Slightly reduced radius
                        x: 0,
                        y: 4
                    )
            )
            .scaleEffect(isPressed ? 0.95 : 1.0)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Add Evidence")
        .accessibilityHint("Opens evidence capture screen to add photos, videos, or notes")
        .onAppear {
            startGlowAnimation()
        }
        .onDisappear {
            stopGlowAnimation()
        }
        .onChange(of: scenePhase) { oldPhase, newPhase in
            // Stop animation when app backgrounds, restart when foregrounds
            if newPhase == .background || newPhase == .inactive {
                stopGlowAnimation()
            } else if newPhase == .active {
                startGlowAnimation()
            }
        }
    }
    
    private func startGlowAnimation() {
        // Subtle glow pulse when idle (respects Reduce Motion)
        if UIAccessibility.isReduceMotionEnabled {
            glowPulse = 0.5 // Static, no animation
        } else {
            withAnimation(
                Animation.easeInOut(duration: 2.0)
                    .repeatForever(autoreverses: true)
            ) {
                glowPulse = 1.0
            }
        }
    }
    
    private func stopGlowAnimation() {
        // Stop animation by setting to static state
        withAnimation(.linear(duration: 0.1)) {
            glowPulse = 0.5
        }
    }
}

#Preview {
    ZStack {
        Color.black
        FloatingEvidenceFAB {
            print("Add Evidence tapped")
        }
    }
}
