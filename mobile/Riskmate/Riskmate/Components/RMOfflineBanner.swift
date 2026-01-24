import SwiftUI

/// Offline mode banner - shows when backend is down AND uploads are truly queued
struct RMOfflineBanner: View {
    @StateObject private var statusManager = ServerStatusManager.shared
    @StateObject private var jobsStore = JobsStore.shared
    @StateObject private var uploadManager = BackgroundUploadManager.shared
    
    private var lastSyncText: String {
        if let lastSync = jobsStore.lastSyncDate {
            let formatter = RelativeDateTimeFormatter()
            formatter.unitsStyle = .abbreviated
            return formatter.localizedString(for: lastSync, relativeTo: Date())
        }
        return "Never"
    }
    
    // Only show if backend is down AND there are queued/uploading items
    private var hasQueuedUploads: Bool {
        uploadManager.uploads.contains { upload in
            if case .queued = upload.state {
                return true
            }
            if case .uploading = upload.state {
                return true
            }
            return false
        }
    }
    
    var body: some View {
        if statusManager.backendDown && hasQueuedUploads {
            HStack(spacing: RMTheme.Spacing.sm) {
                Image(systemName: "wifi.slash")
                    .foregroundColor(RMTheme.Colors.warning)
                    .font(.system(size: 14, weight: .semibold))
                
                VStack(alignment: .leading, spacing: 2) {
                    Text("Offline — uploads queued")
                        .font(RMTheme.Typography.bodySmallBold)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    
                    Text("Last sync: \(lastSyncText)")
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
                .accessibilityLabel("Retry connection")
                .accessibilityHint("Attempts to reconnect to the server")
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
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Offline mode. Uploads queued. Last sync: \(lastSyncText)")
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
