import SwiftUI

/// Empty state component for premium UX
struct RMEmptyState: View {
    let icon: String
    let title: String
    let message: String
    let action: RMEmptyStateAction?
    
    init(icon: String, title: String, message: String, action: RMEmptyStateAction? = nil) {
        self.icon = icon
        self.title = title
        self.message = message
        self.action = action
    }
    
    var body: some View {
        VStack(spacing: RMTheme.Spacing.lg) {
            Image(systemName: icon)
                .font(.system(size: 48, weight: .light))
                .foregroundColor(RMTheme.Colors.textTertiary)
                .accessibilityHidden(true)
            
            VStack(spacing: RMTheme.Spacing.sm) {
                Text(title)
                    .font(RMTheme.Typography.title3)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                    .accessibilityAddTraits(.isHeader)
                
                Text(message)
                    .font(RMTheme.Typography.bodySmall)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
            
            if let action = action {
                Button {
                    let generator = UIImpactFeedbackGenerator(style: .medium)
                    generator.impactOccurred()
                    action.action()
                } label: {
                    Text(action.title)
                        .font(RMTheme.Typography.bodyBold)
                        .foregroundColor(.black)
                        .padding(.horizontal, RMTheme.Spacing.lg)
                        .padding(.vertical, RMTheme.Spacing.md)
                        .background(RMTheme.Colors.accent)
                        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.md))
                }
                .padding(.top, RMTheme.Spacing.md)
            }
        }
        .padding(RMTheme.Spacing.xl)
    }
}

struct RMEmptyStateAction {
    let title: String
    let action: () -> Void
}
