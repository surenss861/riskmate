import SwiftUI

/// System-native sync status chip
struct SyncChip: View {
    let isSynced: Bool
    
    var body: some View {
        HStack(spacing: RMSystemTheme.Spacing.xs) {
            Circle()
                .fill(isSynced ? RMSystemTheme.Colors.success : RMSystemTheme.Colors.warning)
                .frame(width: 8, height: 8)
            
            Text(isSynced ? "Synced" : "Offline")
                .font(RMSystemTheme.Typography.caption)
                .foregroundStyle(RMSystemTheme.Colors.textSecondary)
        }
        .padding(.horizontal, RMSystemTheme.Spacing.sm)
        .padding(.vertical, 6)
        .background(
            Capsule()
                .fill(RMSystemTheme.Colors.tertiaryBackground)
        )
    }
}
