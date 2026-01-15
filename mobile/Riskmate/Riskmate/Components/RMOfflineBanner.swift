import SwiftUI

/// Offline mode banner - shows when backend is down
struct RMOfflineBanner: View {
    @StateObject private var statusManager = ServerStatusManager.shared
    
    var body: some View {
        if statusManager.backendDown {
            HStack(spacing: RMTheme.Spacing.sm) {
                Image(systemName: "wifi.slash")
                    .foregroundColor(RMTheme.Colors.warning)
                    .font(.system(size: 14, weight: .semibold))
                
                VStack(alignment: .leading, spacing: 2) {
                    Text("Offline Mode")
                        .font(RMTheme.Typography.bodySmallBold)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    
                    Text("Backend unavailable. Changes will sync when connection is restored.")
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                }
                
                Spacer()
                
                Button {
                    Task {
                        await statusManager.checkHealth()
                    }
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .foregroundColor(RMTheme.Colors.accent)
                        .font(.system(size: 14))
                }
            }
            .padding(RMTheme.Spacing.md)
            .background(RMTheme.Colors.warning.opacity(0.15))
            .overlay {
                RoundedRectangle(cornerRadius: RMTheme.Radius.sm)
                    .stroke(RMTheme.Colors.warning.opacity(0.3), lineWidth: 1)
            }
            .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
            .padding(.horizontal, RMTheme.Spacing.pagePadding)
            .padding(.top, RMTheme.Spacing.sm)
            .transition(.move(edge: .top).combined(with: .opacity))
        }
    }
}

/// View modifier to add offline banner
extension View {
    func offlineBanner() -> some View {
        VStack(spacing: 0) {
            RMOfflineBanner()
            self
        }
    }
}

#Preview {
    VStack {
        RMOfflineBanner()
        Spacer()
    }
    .background(RMBackground())
}
