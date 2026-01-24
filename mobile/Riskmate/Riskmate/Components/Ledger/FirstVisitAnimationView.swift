import SwiftUI

/// First-visit "holy sh*t" moment: Proof hash → anchor → lock animation
/// Shows once on first Ledger visit, then never again
struct FirstVisitAnimationView: View {
    @State private var animationPhase: AnimationPhase = .hash
    @State private var hashOpacity: Double = 0
    @State private var anchorOpacity: Double = 0
    @State private var lockOpacity: Double = 0
    @State private var hashScale: CGFloat = 0.8
    @State private var anchorScale: CGFloat = 0.8
    @State private var lockScale: CGFloat = 0.8
    
    enum AnimationPhase {
        case hash
        case anchor
        case lock
        case complete
    }
    
    var body: some View {
        ZStack {
            // Semi-transparent overlay
            Color.black.opacity(0.6)
                .ignoresSafeArea()
            
            VStack(spacing: RiskMateDesignSystem.Spacing.lg) {
                // Proof hash → anchor → lock sequence
                ZStack {
                    // Hash (first)
                    if animationPhase == .hash || animationPhase == .anchor || animationPhase == .lock {
                        VStack(spacing: RiskMateDesignSystem.Spacing.sm) {
                            Image(systemName: "number")
                                .font(.system(size: 40, weight: .bold))
                                .foregroundStyle(RiskMateDesignSystem.Colors.accent)
                            Text("Proof Hash")
                                .font(RiskMateDesignSystem.Typography.caption)
                                .foregroundStyle(RiskMateDesignSystem.Colors.textSecondary)
                        }
                        .opacity(hashOpacity)
                        .scaleEffect(hashScale)
                    }
                    
                    // Anchor (second)
                    if animationPhase == .anchor || animationPhase == .lock {
                        VStack(spacing: RiskMateDesignSystem.Spacing.sm) {
                            Image(systemName: "link")
                                .font(.system(size: 40, weight: .bold))
                                .foregroundStyle(RiskMateDesignSystem.Colors.accent)
                            Text("Anchored")
                                .font(RiskMateDesignSystem.Typography.caption)
                                .foregroundStyle(RiskMateDesignSystem.Colors.textSecondary)
                        }
                        .opacity(anchorOpacity)
                        .scaleEffect(anchorScale)
                    }
                    
                    // Lock (third)
                    if animationPhase == .lock {
                        VStack(spacing: RiskMateDesignSystem.Spacing.sm) {
                            Image(systemName: "lock.shield.fill")
                                .font(.system(size: 40, weight: .bold))
                                .foregroundStyle(RiskMateDesignSystem.Colors.success)
                            Text("Immutable")
                                .font(RiskMateDesignSystem.Typography.caption)
                                .foregroundStyle(RiskMateDesignSystem.Colors.textSecondary)
                        }
                        .opacity(lockOpacity)
                        .scaleEffect(lockScale)
                    }
                }
                .frame(height: 120)
                
                // Trust statement
                Text("This is serious infrastructure, not a tool.")
                    .font(RiskMateDesignSystem.Typography.bodyBold)
                    .foregroundStyle(RiskMateDesignSystem.Colors.textPrimary)
                    .multilineTextAlignment(.center)
                    .opacity(lockOpacity)
            }
            .padding(RiskMateDesignSystem.Spacing.xl)
            .background(
                RoundedRectangle(cornerRadius: RiskMateDesignSystem.Radius.lg)
                    .fill(RiskMateDesignSystem.Colors.surface)
                    .shadow(color: .black.opacity(0.3), radius: 20, x: 0, y: 10)
            )
            .padding(RiskMateDesignSystem.Spacing.pagePadding)
        }
        .onAppear {
            startAnimation()
        }
    }
    
    private func startAnimation() {
        // Phase 1: Hash appears
        withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) {
            hashOpacity = 1.0
            hashScale = 1.0
        }
        
        // Phase 2: Hash fades, Anchor appears
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            animationPhase = .anchor
            withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) {
                hashOpacity = 0
                hashScale = 0.8
                anchorOpacity = 1.0
                anchorScale = 1.0
            }
        }
        
        // Phase 3: Anchor fades, Lock appears
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) {
            animationPhase = .lock
            withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) {
                anchorOpacity = 0
                anchorScale = 0.8
                lockOpacity = 1.0
                lockScale = 1.0
            }
        }
        
        // Phase 4: Complete
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.4) {
            animationPhase = .complete
        }
    }
}

#Preview {
    FirstVisitAnimationView()
}
