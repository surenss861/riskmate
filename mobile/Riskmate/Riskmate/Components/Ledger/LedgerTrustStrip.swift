import SwiftUI

/// Trust strip for Ledger - always visible, unforgeable status
struct LedgerTrustStrip: View {
    let isVerified: Bool
    let lastAnchored: Date?
    let onTap: () -> Void
    
    var body: some View {
        Button {
            Haptics.tap()
            onTap()
        } label: {
            HStack(spacing: RMSystemTheme.Spacing.sm) {
                // Animated checkmark loop (very subtle, respects Reduce Motion)
                ZStack {
                    if isVerified {
                        Group {
                            if UIAccessibility.isReduceMotionEnabled {
                                Image(systemName: "checkmark.seal.fill")
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundStyle(RMSystemTheme.Colors.success)
                            } else {
                                Image(systemName: "checkmark.seal.fill")
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundStyle(RMSystemTheme.Colors.success)
                                    .symbolEffect(.pulse, options: .repeating.speed(0.5))
                            }
                        }
                    } else {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(RMSystemTheme.Colors.warning)
                    }
                }
                .accessibilityLabel(isVerified ? "Verified" : "Verification issue")
                .accessibilityHint("Tap to view verification details")
                
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 4) {
                        Text(isVerified ? "Cryptographically Verified" : "Verification Issue")
                            .font(RMSystemTheme.Typography.caption.weight(.semibold))
                            .foregroundStyle(RMSystemTheme.Colors.textPrimary)
                        if let anchored = lastAnchored {
                            Text("·")
                                .foregroundStyle(RMSystemTheme.Colors.textTertiary)
                            TickingTimestamp(date: anchored)
                                .font(RMSystemTheme.Typography.caption2)
                                .foregroundStyle(RMSystemTheme.Colors.textSecondary)
                        } else {
                            Text("· Pending anchor")
                                .font(RMSystemTheme.Typography.caption2)
                                .foregroundStyle(RMSystemTheme.Colors.textTertiary)
                        }
                    }
                }
                
                Spacer()
                
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(RMSystemTheme.Colors.textTertiary)
            }
            .padding(.horizontal, RMSystemTheme.Spacing.md)
            .padding(.vertical, RMSystemTheme.Spacing.xs + 2)
            .background(
                VisualEffectBlur(style: .systemMaterial)
                    .overlay(
                        Rectangle()
                            .frame(height: 0.5)
                            .foregroundStyle(RMSystemTheme.Colors.separator),
                        alignment: .bottom
                    )
            )
        }
        .buttonStyle(.plain)
    }
    
    private func relativeTime(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}
