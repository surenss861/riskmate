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
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(isVerified ? "Cryptographically Verified" : "Verification Issue")
                        .font(RMSystemTheme.Typography.subheadline.weight(.semibold))
                        .foregroundStyle(RMSystemTheme.Colors.textPrimary)
                    
                    if let anchored = lastAnchored {
                        // Ticking timestamp (updates once on open)
                        TickingTimestamp(date: anchored)
                            .font(RMSystemTheme.Typography.caption)
                            .foregroundStyle(RMSystemTheme.Colors.textSecondary)
                    } else {
                        Text("Pending anchor")
                            .font(RMSystemTheme.Typography.caption)
                            .foregroundStyle(RMSystemTheme.Colors.textTertiary)
                    }
                    
                    // Immutability flex (subtle, confident)
                    Text("Proofs cannot be altered once anchored.")
                        .font(RMSystemTheme.Typography.caption2)
                        .foregroundStyle(RMSystemTheme.Colors.textTertiary)
                        .padding(.top, 2)
                    
                    // Micro pulse on successful sync (very subtle, respects Reduce Motion)
                    if isVerified && !UIAccessibility.isReduceMotionEnabled {
                        Circle()
                            .fill(RMSystemTheme.Colors.success.opacity(0.3))
                            .frame(width: 4, height: 4)
                            .padding(.top, 4)
                            .symbolEffect(.pulse, options: .repeating.speed(2.0))
                            .accessibilityHidden(true) // Decorative
                    }
                }
                
                Spacer()
                
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(RMSystemTheme.Colors.textTertiary)
            }
            .padding(.horizontal, RMSystemTheme.Spacing.md)
            .padding(.vertical, RMSystemTheme.Spacing.sm)
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
