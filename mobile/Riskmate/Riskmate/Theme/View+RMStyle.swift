import SwiftUI

// MARK: - Premium View Modifiers

extension View {
    /// Glass card style - web-sharp with iOS material
    func rmCard(padding: CGFloat = RMTheme.Spacing.md) -> some View {
        RMGlassCard {
            self
                .padding(padding)
        }
    }
    
    /// Input field style
    func rmInput() -> some View {
        self
            .padding(RMTheme.Spacing.md)
            .background(RMTheme.Colors.inputFill)
            .cornerRadius(RMTheme.Radius.sm)
            .overlay {
                RoundedRectangle(cornerRadius: RMTheme.Radius.sm)
                    .stroke(RMTheme.Colors.inputStroke, lineWidth: 1)
            }
    }
    
    /// Primary button style with haptics
    func rmButton() -> some View {
        self
            .padding(.horizontal, RMTheme.Spacing.lg)
            .padding(.vertical, RMTheme.Spacing.md)
            .background(RMTheme.Colors.accent)
            .foregroundColor(.black)
            .font(RMTheme.Typography.bodyBold)
            .cornerRadius(RMTheme.Radius.md)
            .themeShadow(RMTheme.Shadow.button)
    }
    
    /// Section header style
    func rmSectionHeader() -> some View {
        self
            .font(RMTheme.Typography.title3)
            .foregroundColor(RMTheme.Colors.textPrimary)
    }
    
    /// Body text style
    func rmBody() -> some View {
        self
            .font(RMTheme.Typography.body)
            .foregroundColor(RMTheme.Colors.textPrimary)
    }
    
    /// Secondary text style
    func rmSecondary() -> some View {
        self
            .font(RMTheme.Typography.bodySmall)
            .foregroundColor(RMTheme.Colors.textSecondary)
    }
    
    /// Caption text style
    func rmCaption() -> some View {
        self
            .font(RMTheme.Typography.caption)
            .foregroundColor(RMTheme.Colors.textTertiary)
    }
    
    /// Add haptic feedback on tap
    func rmHaptic(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .medium) -> some View {
        self.onTapGesture {
            let generator = UIImpactFeedbackGenerator(style: style)
            generator.impactOccurred()
        }
    }
    
    /// Smooth fade in animation
    func rmFadeIn(delay: Double = 0) -> some View {
        self
            .opacity(0)
            .animation(
                RMTheme.Animation.smooth.delay(delay),
                value: UUID()
            )
            .onAppear {
                withAnimation(RMTheme.Animation.smooth.delay(delay)) {
                    // Trigger animation
                }
            }
    }
}

// MARK: - Navigation Styling

extension View {
    /// Configure navigation bar for RiskMate style
    func rmNavigationBar(title: String) -> some View {
        self
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarBackground(RMTheme.Colors.background, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
    }
}

// MARK: - List Styling

extension View {
    /// RiskMate list row style
    func rmListRow() -> some View {
        self
            .listRowBackground(RMTheme.Colors.surface.opacity(0.5))
            .listRowSeparator(.hidden)
            .listRowInsets(EdgeInsets(
                top: RMTheme.Spacing.sm,
                leading: RMTheme.Spacing.md,
                bottom: RMTheme.Spacing.sm,
                trailing: RMTheme.Spacing.md
            ))
    }
}
