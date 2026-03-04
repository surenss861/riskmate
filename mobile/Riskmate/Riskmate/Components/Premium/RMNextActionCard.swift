import SwiftUI

/// Single next-action CTA card: title, subtitle, icon, button. Uses RMCard + rmPressable(scale: 0.98, haptic: true).
struct RMNextActionCard: View {
    let title: String
    let subtitle: String?
    let icon: String
    let actionTitle: String
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            RMGlassCard {
                HStack(spacing: RMTheme.Spacing.md) {
                    Image(systemName: icon)
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundColor(RMTheme.Colors.accent)
                        .frame(width: 40, height: 40)
                        .background(RMTheme.Colors.accent.opacity(0.15))
                        .clipShape(Circle())
                    VStack(alignment: .leading, spacing: 4) {
                        Text(title)
                            .font(RMTheme.Typography.bodyBold)
                            .foregroundColor(RMTheme.Colors.textPrimary)
                        if let sub = subtitle, !sub.isEmpty {
                            Text(sub)
                                .font(RMTheme.Typography.bodySmall)
                                .foregroundColor(RMTheme.Colors.textSecondary)
                        }
                        Text(actionTitle)
                            .font(RMTheme.Typography.captionBold)
                            .foregroundColor(RMTheme.Colors.accent)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Image(systemName: "chevron.right")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(RMTheme.Colors.textTertiary)
                }
            }
        }
        .buttonStyle(.plain)
        .rmPressable(scale: 0.98, haptic: true)
    }
}

#Preview {
    RMNextActionCard(
        title: "Add evidence",
        subtitle: "3 of 5 items to unlock Proof Pack",
        icon: "camera.fill",
        actionTitle: "Add evidence",
        action: {}
    )
    .padding()
    .background(RMTheme.Colors.background)
}
