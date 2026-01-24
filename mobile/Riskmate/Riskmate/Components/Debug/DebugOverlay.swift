import SwiftUI

/// Debug overlay - shows auth state, sync status, uploads (dev only)
#if DEBUG
struct DebugOverlay: View {
    @StateObject private var sessionManager = SessionManager.shared
    @StateObject private var uploadManager = BackgroundUploadManager.shared
    @StateObject private var jobsStore = JobsStore.shared
    @StateObject private var statusManager = ServerStatusManager.shared
    @AppStorage("debug_overlay_enabled") private var isEnabled = false
    
    private var pendingUploadsCount: Int {
        uploadManager.uploads.filter { upload in
            if case .queued = upload.state { return true }
            if case .uploading = upload.state { return true }
            return false
        }.count
    }
    
    private var failedUploadsCount: Int {
        uploadManager.uploads.filter { upload in
            if case .failed = upload.state { return true }
            return false
        }.count
    }
    
    var body: some View {
        if isEnabled {
            VStack(alignment: .leading, spacing: 8) {
                // Toggle
                Button {
                    isEnabled = false
                } label: {
                    HStack {
                        Text("DEBUG")
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundColor(.red)
                        Spacer()
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 12))
                    }
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.black.opacity(0.8))
                
                // Debug info
                VStack(alignment: .leading, spacing: 4) {
                    DebugRow(label: "Auth", value: sessionManager.isAuthenticated ? "✅" : "❌")
                    DebugRow(label: "User ID", value: sessionManager.currentUser?.id ?? "none")
                    DebugRow(label: "Org ID", value: sessionManager.currentOrganization?.id ?? "none")
                    DebugRow(label: "Online", value: statusManager.isOnline ? "✅" : "❌")
                    DebugRow(label: "Last Sync", value: formatDate(jobsStore.lastSyncDate))
                    DebugRow(label: "Pending Uploads", value: "\(pendingUploadsCount)")
                    DebugRow(label: "Failed Uploads", value: "\(failedUploadsCount)")
                }
                .font(.system(size: 9, design: .monospaced))
                .foregroundColor(.white)
                .padding(8)
                .background(Color.black.opacity(0.8))
                .cornerRadius(4)
            }
            .padding(8)
            .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            // Hidden toggle (long-press on version in settings)
            EmptyView()
        }
    }
    
    private func formatDate(_ date: Date?) -> String {
        guard let date = date else { return "never" }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

struct DebugRow: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text("\(label):")
                .foregroundColor(.gray)
            Spacer()
            Text(value)
                .foregroundColor(.white)
        }
    }
}

/// View modifier to add debug overlay
extension View {
    func debugOverlay() -> some View {
        self.overlay(alignment: .topLeading) {
            DebugOverlay()
        }
    }
}

/// Enable debug overlay (call from Settings with long-press on version)
func enableDebugOverlay() {
    UserDefaults.standard.set(true, forKey: "debug_overlay_enabled")
}
#endif
