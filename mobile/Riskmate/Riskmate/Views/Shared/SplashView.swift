import SwiftUI

/// Minimal splash screen for polished launch experience
struct SplashView: View {
    var body: some View {
        ZStack {
            RMTheme.Colors.background
                .ignoresSafeArea()
            
            VStack(spacing: RMTheme.Spacing.md) {
                // Logo/App Name
                Text("RISK MATE")
                    .font(.system(size: 24, weight: .heavy, design: .rounded))
                    .tracking(3)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                
                // Loading indicator
                ProgressView()
                    .tint(RMTheme.Colors.accent)
                    .scaleEffect(1.2)
            }
        }
    }
}

#Preview {
    SplashView()
}
