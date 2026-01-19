import SwiftUI

/// First-run onboarding - 60 seconds, Wallet/Health style
/// Shows once, then never again
struct FirstRunOnboardingView: View {
    @Binding var isPresented: Bool
    @State private var continueAsAuditor = false
    
    var body: some View {
        ZStack {
            RMBackground()
            
            VStack(spacing: RMSystemTheme.Spacing.xl) {
                Spacer()
                
                // Title (one line, confident)
                Text("Immutable compliance records.")
                    .font(.system(size: 34, weight: .bold, design: .default))
                    .foregroundStyle(RMSystemTheme.Colors.textPrimary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, RMSystemTheme.Spacing.pagePadding)
                
                // Subtitle
                Text("Capture evidence. Anchor it. Verify forever.")
                    .font(RMSystemTheme.Typography.subheadline)
                    .foregroundStyle(RMSystemTheme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, RMSystemTheme.Spacing.pagePadding)
                
                Spacer()
                
                // 3 inline bullets (icons only, no cards)
                VStack(spacing: RMSystemTheme.Spacing.lg) {
                    OnboardingBullet(
                        icon: "camera.fill",
                        text: "Capture evidence"
                    )
                    
                    OnboardingBullet(
                        icon: "lock.shield.fill",
                        text: "Cryptographically anchor"
                    )
                    
                    OnboardingBullet(
                        icon: "checkmark.seal.fill",
                        text: "Instantly verify"
                    )
                }
                .padding(.horizontal, RMSystemTheme.Spacing.pagePadding)
                
                Spacer()
                
                // CTAs
                VStack(spacing: RMSystemTheme.Spacing.md) {
                    // Primary: Get Started
                    Button {
                        Haptics.tap()
                        completeOnboarding(auditorMode: false)
                    } label: {
                        Text("Get Started")
                            .font(RMSystemTheme.Typography.headline)
                            .foregroundStyle(.black)
                            .frame(maxWidth: .infinity)
                            .frame(height: 52)
                            .background(RMSystemTheme.Colors.accent)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                    
                    // Secondary: Continue as auditor
                    Button {
                        Haptics.tap()
                        completeOnboarding(auditorMode: true)
                    } label: {
                        Text("Continue as auditor")
                            .font(RMSystemTheme.Typography.body)
                            .foregroundStyle(RMSystemTheme.Colors.accent)
                    }
                }
                .padding(.horizontal, RMSystemTheme.Spacing.pagePadding)
                .padding(.bottom, RMSystemTheme.Spacing.xl)
            }
        }
        .transition(.opacity)
        .animation(.easeOut(duration: 0.3), value: isPresented)
    }
    
    private func completeOnboarding(auditorMode: Bool) {
        // Save first-run completion
        UserDefaults.standard.set(true, forKey: "first_run_complete")
        
        // If auditor mode, set role flag
        if auditorMode {
            UserDefaults.standard.set("auditor", forKey: "user_role")
        }
        
        // Dismiss
        withAnimation(.easeOut(duration: 0.3)) {
            isPresented = false
        }
    }
}

/// Inline bullet (icon + text, no card)
struct OnboardingBullet: View {
    let icon: String
    let text: String
    
    var body: some View {
        HStack(spacing: RMSystemTheme.Spacing.md) {
            Image(systemName: icon)
                .font(.system(size: 20, weight: .medium))
                .foregroundStyle(RMSystemTheme.Colors.accent)
                .frame(width: 32, height: 32)
            
            Text(text)
                .font(RMSystemTheme.Typography.body)
                .foregroundStyle(RMSystemTheme.Colors.textPrimary)
            
            Spacer()
        }
    }
}

#Preview {
    FirstRunOnboardingView(isPresented: .constant(true))
}
