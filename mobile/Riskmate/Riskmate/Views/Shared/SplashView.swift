import SwiftUI

/// Minimal splash screen for polished launch experience
struct SplashView: View {
    var body: some View {
        ZStack {
            RMTheme.Colors.background
                .ignoresSafeArea()
            
            VStack(spacing: RMSystemTheme.Spacing.lg) {
                // Logo/App Name
                Text("RISKMATE")
                    .font(.system(size: 28, weight: .heavy, design: .rounded))
                    .tracking(3)
                    .foregroundStyle(RMSystemTheme.Colors.textPrimary)
                
                // Value prop (one line, confident)
                Text("Immutable compliance records.")
                    .font(RMSystemTheme.Typography.subheadline)
                    .foregroundStyle(RMSystemTheme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
                
                // Loading indicator
                ProgressView()
                    .tint(RMSystemTheme.Colors.accent)
                    .scaleEffect(1.2)
            }
        }
    }
}

#Preview {
    SplashView()
}
