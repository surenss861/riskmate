import SwiftUI

/// Sync status chip for operations screen
struct SyncChip: View {
    let isSynced: Bool
    
    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(isSynced ? Color.green : Color.yellow)
                .frame(width: 10, height: 10)
            
            Text(isSynced ? "Synced" : "Offline")
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .foregroundStyle(RMTheme.Colors.textSecondary)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(
            Capsule()
                .fill(RMTheme.Colors.surface.opacity(0.6))
                .overlay(
                    Capsule()
                        .stroke(RMTheme.Colors.border, lineWidth: 1)
                )
        )
    }
}
