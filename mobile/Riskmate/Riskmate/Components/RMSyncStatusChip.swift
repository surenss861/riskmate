import SwiftUI

/// Global sync status chip - shows sync state in navigation bar
struct RMSyncStatusChip: View {
    @ObservedObject private var cache = OfflineCache.shared
    
    var body: some View {
        Button {
            if case .queued = cache.syncState {
                Task {
                    await cache.sync()
                }
            }
        } label: {
            HStack(spacing: 4) {
                Image(systemName: iconName)
                    .font(.system(size: 12, weight: .semibold))
                
                if let count = queuedCount, count > 0 {
                    Text("\(count)")
                        .font(RMTheme.Typography.captionSmall)
                }
            }
            .foregroundColor(iconColor)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(backgroundColor)
            .clipShape(Capsule())
        }
        .disabled(!isTappable)
    }
    
    private var iconName: String {
        switch cache.syncState {
        case .synced:
            return "checkmark.circle.fill"
        case .syncing:
            return "arrow.clockwise"
        case .queued:
            return "clock.fill"
        case .error:
            return "exclamationmark.triangle.fill"
        }
    }
    
    private var iconColor: Color {
        switch cache.syncState {
        case .synced:
            return RMTheme.Colors.success
        case .syncing:
            return RMTheme.Colors.accent
        case .queued:
            return RMTheme.Colors.warning
        case .error:
            return RMTheme.Colors.error
        }
    }
    
    private var backgroundColor: Color {
        switch cache.syncState {
        case .synced:
            return RMTheme.Colors.success.opacity(0.15)
        case .syncing:
            return RMTheme.Colors.accent.opacity(0.15)
        case .queued:
            return RMTheme.Colors.warning.opacity(0.15)
        case .error:
            return RMTheme.Colors.error.opacity(0.15)
        }
    }
    
    private var queuedCount: Int? {
        switch cache.syncState {
        case .queued(let count):
            return count
        default:
            return nil
        }
    }
    
    private var isTappable: Bool {
        switch cache.syncState {
        case .queued, .error:
            return true
        default:
            return false
        }
    }
}

/// View modifier to add sync status chip to toolbar
extension View {
    func syncStatusChip() -> some View {
        self.toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                RMSyncStatusChip()
            }
        }
    }
}

#Preview {
    NavigationStack {
        Text("Content")
            .syncStatusChip()
    }
}
