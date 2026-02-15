import SwiftUI

/// Offline mode banner - shows when offline, pending ops, or syncing; tap to view sync queue
struct RMOfflineBanner: View {
    @StateObject private var statusManager = ServerStatusManager.shared
    @StateObject private var jobsStore = JobsStore.shared
    @StateObject private var uploadManager = BackgroundUploadManager.shared
    @StateObject private var syncEngine = SyncEngine.shared
    @State private var showSyncQueue = false

    private var lastSyncText: String {
        if let lastSync = jobsStore.lastSyncDate {
            let formatter = RelativeDateTimeFormatter()
            formatter.unitsStyle = .abbreviated
            return formatter.localizedString(for: lastSync, relativeTo: Date())
        }
        return "Never"
    }

    private var pendingCount: Int {
        OfflineDatabase.shared.pendingOperationsCount() + queuedUploadsCount
    }

    private var queuedUploadsCount: Int {
        uploadManager.uploads.filter { upload in
            if case .queued = upload.state { return true }
            if case .uploading = upload.state { return true }
            return false
        }.count
    }

    // Show when: offline (backend down), OR pending operations, OR syncing
    private var shouldShow: Bool {
        statusManager.backendDown || pendingCount > 0 || syncEngine.isSyncing
    }

    private var bannerTitle: String {
        if syncEngine.isSyncing {
            return "Syncing..."
        }
        if statusManager.backendDown {
            return pendingCount > 0 ? "Offline — \(pendingCount) pending" : "Offline"
        }
        return pendingCount > 0 ? "\(pendingCount) pending sync" : ""
    }

    var body: some View {
        if shouldShow {
            Button {
                Haptics.tap()
                showSyncQueue = true
            } label: {
                HStack(spacing: RMTheme.Spacing.sm) {
                    if syncEngine.isSyncing {
                        ProgressView()
                            .scaleEffect(0.9)
                            .tint(RMTheme.Colors.accent)
                    } else {
                        Image(systemName: statusManager.backendDown ? "wifi.slash" : "clock.fill")
                            .foregroundColor(RMTheme.Colors.warning)
                            .font(.system(size: 14, weight: .semibold))
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text(bannerTitle)
                            .font(RMTheme.Typography.bodySmallBold)
                            .foregroundColor(RMTheme.Colors.textPrimary)

                        Text(syncEngine.isSyncing ? "Uploading changes..." : "Last sync: \(lastSyncText)")
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.textSecondary)
                    }

                    Spacer()

                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(RMTheme.Colors.textTertiary)
                }
                .padding(RMTheme.Spacing.md)
                .background(RMTheme.Colors.warning.opacity(0.15))
                .overlay {
                    RoundedRectangle(cornerRadius: RMTheme.Radius.sm)
                        .stroke(RMTheme.Colors.warning.opacity(0.3), lineWidth: 1)
                }
                .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
            }
            .buttonStyle(.plain)
            .padding(.horizontal, RMTheme.Spacing.pagePadding)
            .padding(.top, RMTheme.Spacing.sm)
            .transition(.move(edge: .top).combined(with: .opacity))
            .accessibilityLabel("Sync status. \(bannerTitle). Tap to view sync queue.")
            .accessibilityHint("Opens sync queue")
            .sheet(isPresented: $showSyncQueue) {
                SyncQueueView()
                    .onDisappear {
                        JobsStore.shared.refreshPendingJobs()
                    }
            }
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
