import SwiftUI

/// Empty state component for premium UX. Optional voice hint for “Try saying: …”.
struct RMEmptyState: View {
    let icon: String
    let title: String
    let message: String
    let action: RMEmptyStateAction?
    /// e.g. "Try saying: 'Show high risk jobs'" for guided voice-first.
    var voiceHint: String? = nil
    
    init(icon: String, title: String, message: String, action: RMEmptyStateAction? = nil, voiceHint: String? = nil) {
        self.icon = icon
        self.title = title
        self.message = message
        self.action = action
        self.voiceHint = voiceHint
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
                
                if let hint = voiceHint {
                    Text(hint)
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.textTertiary)
                        .multilineTextAlignment(.center)
                        .padding(.top, 4)
                }
            }
            
            if let action = action {
                Button {
                    Haptics.impact(.medium)
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
