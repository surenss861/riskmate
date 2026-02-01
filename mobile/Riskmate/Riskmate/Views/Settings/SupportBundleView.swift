import SwiftUI

/// Support bundle view - copies diagnostic info for support
struct SupportBundleView: View {
    @State private var copied = false
    @StateObject private var cache = OfflineCache.shared
    @StateObject private var uploadManager = BackgroundUploadManager.shared
    @StateObject private var statusManager = ServerStatusManager.shared
    
    var body: some View {
        List {
            Section {
                Button {
                    copySupportBundle()
                } label: {
                    HStack {
                        Image(systemName: copied ? "checkmark.circle.fill" : "doc.on.doc")
                            .foregroundColor(copied ? RMTheme.Colors.success : RMTheme.Colors.accent)
                        Text(copied ? "Copied!" : "Copy Support Bundle")
                            .foregroundColor(RMTheme.Colors.textPrimary)
                    }
                }
            } header: {
                Text("Diagnostics")
            } footer: {
                Text("This copies diagnostic information to help support troubleshoot issues.")
            }
            
            Section("App Info") {
                SupportInfoRow(label: "Version", value: appVersion)
                SupportInfoRow(label: "Build", value: buildNumber)
                SupportInfoRow(label: "iOS Version", value: iosVersion)
                SupportInfoRow(label: "Device", value: deviceModel)
            }
            
            Section("Backend") {
                SupportInfoRow(label: "Backend URL", value: AppConfig.shared.backendURL)
                SupportInfoRow(label: "Status", value: statusManager.isOnline ? "Online" : "Offline")
                if let lastCheck = statusManager.lastCheck {
                    SupportInfoRow(label: "Last Check", value: formatDate(lastCheck))
                }
            }
            
            Section("Sync Status") {
                SupportInfoRow(label: "Sync State", value: syncStateText)
                SupportInfoRow(label: "Queued Items", value: "\(cache.queuedItems.count)")
                SupportInfoRow(label: "Active Uploads", value: "\(uploadManager.uploads.filter { $0.state == .uploading || $0.state == .queued }.count)")
            }
        }
        .navigationTitle("Support")
        .navigationBarTitleDisplayMode(.inline)
    }
    
    private var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "Unknown"
    }
    
    private var buildNumber: String {
        Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "Unknown"
    }
    
    private var iosVersion: String {
        UIDevice.current.systemVersion
    }
    
    private var deviceModel: String {
        UIDevice.current.model
    }
    
    private var syncStateText: String {
        switch cache.syncState {
        case .synced: return "Synced"
        case .syncing: return "Syncing"
        case .queued(let count): return "Queued (\(count))"
        case .error(let message): return "Error: \(message)"
        }
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
    
    private func copySupportBundle() {
        var bundle = """
        Riskmate Support Bundle
        ======================
        
        App Info:
        - Version: \(appVersion)
        - Build: \(buildNumber)
        - iOS: \(iosVersion)
        - Device: \(deviceModel)
        
        Backend:
        - URL: \(AppConfig.shared.backendURL)
        - Status: \(statusManager.isOnline ? "Online" : "Offline")
        - Last Check: \(statusManager.lastCheck.map { formatDate($0) } ?? "Never")
        
        Sync Status:
        - State: \(syncStateText)
        - Queued: \(cache.queuedItems.count)
        - Active Uploads: \(uploadManager.uploads.filter { $0.state == .uploading || $0.state == .queued }.count)
        
        """
        
        // Add last error if available
        if case .error(let message) = cache.syncState {
            bundle += "\nLast Error: \(message)\n"
        }
        
        UIPasteboard.general.string = bundle
        
        copied = true
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)
        
        // Reset after 2 seconds
        Task {
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            copied = false
        }
    }
}

struct SupportInfoRow: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text(label)
                .foregroundColor(RMTheme.Colors.textSecondary)
            Spacer()
            Text(value)
                .foregroundColor(RMTheme.Colors.textPrimary)
                .textSelection(.enabled)
        }
    }
}

#Preview {
    NavigationStack {
        SupportBundleView()
    }
}
