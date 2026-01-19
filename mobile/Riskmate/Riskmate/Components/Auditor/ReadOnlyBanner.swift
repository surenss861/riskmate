import SwiftUI

/// Subtle read-only banner for auditor mode
struct ReadOnlyBanner: View {
    var body: some View {
        HStack(spacing: RMSystemTheme.Spacing.sm) {
            Image(systemName: "eye.fill")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(RMSystemTheme.Colors.textTertiary)
            
            Text("Read-only audit mode")
                .font(RMSystemTheme.Typography.caption)
                .foregroundStyle(RMSystemTheme.Colors.textTertiary)
        }
        .padding(.horizontal, RMSystemTheme.Spacing.md)
        .padding(.vertical, RMSystemTheme.Spacing.xs)
        .background(
            Capsule()
                .fill(RMSystemTheme.Colors.tertiaryBackground.opacity(0.5))
        )
    }
}

#Preview {
    ReadOnlyBanner()
        .padding()
        .background(RMBackground())
}
