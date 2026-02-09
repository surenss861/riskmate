import SwiftUI

/// Offline upload status bar - shows queued/uploading/failed uploads with actionable error states
struct EvidenceUploadStatusBar: View {
    let uploads: [UploadTask]
    let jobId: String?
    
    @State private var showErrorDetails = false
    @StateObject private var uploadManager = BackgroundUploadManager.shared
    
    init(uploads: [UploadTask], jobId: String? = nil) {
        self.uploads = uploads
        self.jobId = jobId
    }
    
    private var queuedCount: Int {
        uploads.filter { if case .queued = $0.state { return true }; return false }.count
    }
    
    private var uploadingCount: Int {
        uploads.filter { if case .uploading = $0.state { return true }; return false }.count
    }
    
    private var failedCount: Int {
        uploads.filter { if case .failed = $0.state { return true }; return false }.count
    }
    
    private var syncedCount: Int {
        uploads.filter { if case .synced = $0.state { return true }; return false }.count
    }
    
    private var failedUploads: [UploadTask] {
        uploads.filter { if case .failed = $0.state { return true }; return false }
    }
    
    private var failureReasons: [String] {
        failedUploads.compactMap { upload in
            if case .failed(let reason) = upload.state {
                return reason
            }
            return nil
        }
    }
    
    private var isAuthError: Bool {
        failureReasons.contains { reason in
            reason.lowercased().contains("auth") ||
            reason.lowercased().contains("unauthorized") ||
            reason.lowercased().contains("token") ||
            reason.lowercased().contains("session")
        }
    }
    
    private var isNetworkError: Bool {
        failureReasons.contains { reason in
            reason.lowercased().contains("network") ||
            reason.lowercased().contains("offline") ||
            reason.lowercased().contains("connection") ||
            reason.lowercased().contains("unreachable")
        }
    }
    
    private var statusText: String {
        if uploadingCount > 0 {
            return "Uploading…"
        } else if queuedCount > 0 {
            return "Queued for upload"
        } else if failedCount > 0 {
            if isAuthError {
                return "Sign in required"
            } else if isNetworkError {
                return "Waiting for connection"
            } else {
                return "Upload failed"
            }
        } else if syncedCount > 0 {
            return "Synced"
        }
        return ""
    }
    
    private var statusColor: Color {
        if uploadingCount > 0 {
            return RMSystemTheme.Colors.accent
        } else if queuedCount > 0 {
            return RMSystemTheme.Colors.textTertiary
        } else if failedCount > 0 {
            if isAuthError {
                return RMSystemTheme.Colors.warning
            } else {
                return RMSystemTheme.Colors.warning
            }
        } else if syncedCount > 0 {
            return RMSystemTheme.Colors.success
        }
        return RMSystemTheme.Colors.textSecondary
    }
    
    private var statusIcon: String {
        if uploadingCount > 0 {
            return "arrow.up.circle.fill"
        } else if queuedCount > 0 {
            return "clock.fill"
        } else if failedCount > 0 {
            if isAuthError {
                return "lock.fill"
            } else {
                return "exclamationmark.circle.fill"
            }
        } else if syncedCount > 0 {
            return "checkmark.circle.fill"
        }
        return "circle"
    }
    
    var body: some View {
        if !statusText.isEmpty {
            VStack(spacing: RMSystemTheme.Spacing.xs) {
                HStack(spacing: RMSystemTheme.Spacing.sm) {
                    Image(systemName: statusIcon)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(statusColor)
                    
                    Text(statusText)
                        .font(RMSystemTheme.Typography.caption)
                        .foregroundStyle(statusColor)
                    
                    Spacer()
                    
                    // Show count for multiple items
                    if (queuedCount + uploadingCount + failedCount) > 1 {
                        Text("\(queuedCount + uploadingCount + failedCount)")
                            .font(RMSystemTheme.Typography.caption2)
                            .foregroundStyle(RMSystemTheme.Colors.textTertiary)
                    }
                    
                    // Action button for failed uploads
                    if failedCount > 0 && !isAuthError {
                        Button {
                            Haptics.tap()
                            retryFailedUploads()
                        } label: {
                            Text("Retry")
                                .font(RMSystemTheme.Typography.caption2.weight(.semibold))
                                .foregroundStyle(RMSystemTheme.Colors.accent)
                        }
                    }
                    
                    // Error details expander
                    if failedCount > 0 && failureReasons.count > 0 {
                        Button {
                            Haptics.tap()
                            withAnimation(.spring(response: 0.3)) {
                                showErrorDetails.toggle()
                            }
                        } label: {
                            Image(systemName: showErrorDetails ? "chevron.up" : "chevron.down")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundStyle(RMSystemTheme.Colors.textTertiary)
                        }
                    }
                }
                .padding(.horizontal, RMSystemTheme.Spacing.sm)
                .padding(.vertical, RMSystemTheme.Spacing.xs)
                .background(
                    Capsule()
                        .fill(statusColor.opacity(0.1))
                        .overlay(
                            Capsule()
                                .stroke(statusColor.opacity(0.2), lineWidth: 0.5)
                        )
                )
                
                // Error details (expanded)
                if showErrorDetails && !failureReasons.isEmpty {
                    VStack(alignment: .leading, spacing: RMSystemTheme.Spacing.xs) {
                        ForEach(Array(failureReasons.enumerated()), id: \.offset) { _, reason in
                            Text(reason)
                                .font(RMSystemTheme.Typography.caption2)
                                .foregroundStyle(RMSystemTheme.Colors.textSecondary)
                                .padding(.horizontal, RMSystemTheme.Spacing.sm)
                        }
                    }
                    .padding(.vertical, RMSystemTheme.Spacing.xs)
                    .background(
                        RoundedRectangle(cornerRadius: RMSystemTheme.Radius.sm)
                            .fill(RMSystemTheme.Colors.secondaryBackground)
                    )
                    .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }
            .onTapGesture {
                // On tap for auth errors, show sign-in prompt
                if failedCount > 0 && isAuthError {
                    Haptics.tap()
                    // TODO: Navigate to sign-in or refresh auth
                    // Task {
                    //     await AuthService.shared.refreshSession()
                    // }
                }
            }
        }
    }
    
    private func retryFailedUploads() {
        guard jobId != nil else { return }
        
        Haptics.tap()
        
        Task {
            var retriedCount = 0
            for upload in failedUploads {
                do {
                    try await uploadManager.retryUpload(upload)
                    retriedCount += 1
                } catch {
                    fileMissingCount += 1
                    ToastCenter.shared.show(
                        error.localizedDescription,
                        systemImage: "exclamationmark.triangle",
                        style: .error
                    )
                }
            }
            if retriedCount > 0 {
                ToastCenter.shared.show(
                    retriedCount == 1 ? "Retrying upload" : "Retrying \(retriedCount) uploads",
                    systemImage: "arrow.clockwise",
                    style: .success
                )
            }
        }
    }
}

#Preview {
    VStack(spacing: RMSystemTheme.Spacing.md) {
        EvidenceUploadStatusBar(uploads: [
            UploadTask(id: "1", jobId: "job1", fileName: "photo.jpg", state: .queued, progress: 0, createdAt: Date())
        ], jobId: "job1")
        .padding()
        
        EvidenceUploadStatusBar(uploads: [
            UploadTask(id: "2", jobId: "job1", fileName: "video.mp4", state: .uploading, progress: 0.5, createdAt: Date())
        ], jobId: "job1")
        .padding()
        
        EvidenceUploadStatusBar(uploads: [
            UploadTask(id: "3", jobId: "job1", fileName: "note.txt", state: .failed("Auth expired - please sign in"), progress: 0, createdAt: Date())
        ], jobId: "job1")
        .padding()
        
        EvidenceUploadStatusBar(uploads: [
            UploadTask(id: "4", jobId: "job1", fileName: "file.pdf", state: .failed("Network unavailable"), progress: 0, createdAt: Date())
        ], jobId: "job1")
        .padding()
        
        EvidenceUploadStatusBar(uploads: [
            UploadTask(id: "5", jobId: "job1", fileName: "file.pdf", state: .synced, progress: 1.0, createdAt: Date())
        ], jobId: "job1")
        .padding()
    }
    .background(RMBackground())
}
