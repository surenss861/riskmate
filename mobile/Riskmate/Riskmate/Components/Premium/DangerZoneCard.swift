import SwiftUI

/// Danger zone: delete account with clear typography. Package 8.
struct DangerZoneCard: View {
    let onDeleteTapped: () -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
            Text("Danger Zone")
                .font(RMTheme.Typography.captionBold)
                .foregroundColor(RMTheme.Colors.textTertiary)
            Text("Deleting your account will permanently remove all your data. This action cannot be undone.")
                .font(RMTheme.Typography.caption)
                .foregroundColor(RMTheme.Colors.textSecondary)
            Button(role: .destructive) {
                Haptics.warning()
                onDeleteTapped()
            } label: {
                HStack {
                    Image(systemName: "trash")
                    Text("Delete account")
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, RMTheme.Spacing.md)
            }
            .buttonStyle(.borderedProminent)
            .tint(RMTheme.Colors.error)
        }
        .padding(RMTheme.Spacing.md)
        .background(RMTheme.Colors.surface.opacity(0.5))
        .overlay(
            RoundedRectangle(cornerRadius: RMTheme.Radius.sm)
                .stroke(RMTheme.Colors.error.opacity(0.3), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm, style: .continuous))
    }
}

#Preview {
    DangerZoneCard(onDeleteTapped: {})
        .padding()
        .background(RMTheme.Colors.background)
}
