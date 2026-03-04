import SwiftUI

/// Bottom sheet wrapper for evidence capture - provides fast, accessible evidence capture from anywhere
struct EvidenceCaptureSheet: View {
    let jobId: String?
    let onComplete: (() -> Void)?
    
    @Environment(\.dismiss) private var dismiss
    @StateObject private var jobsStore = JobsStore.shared
    @StateObject private var uploadManager = BackgroundUploadManager.shared
    @State private var selectedMode: EvidenceQuickBar.EvidenceType = .photo
    @AppStorage("lastEvidenceMode") private var lastModeRaw: String = "photo"
    @State private var trackedUploadIds: Set<String> = []
    
    private var effectiveJobId: String {
        jobId ?? jobsStore.jobs.first?.id ?? ""
    }
    
    private var jobUploads: [UploadTask] {
        guard !effectiveJobId.isEmpty else { return [] }
        return uploadManager.uploads.filter { $0.jobId == effectiveJobId }
    }
    
    var body: some View {
        RMSheetShell(
            title: "Add Evidence",
            subtitle: nil,
            currentStep: 1,
            totalSteps: 3,
            detents: [.large],
            onClose: { onComplete?(); dismiss() }
        ) {
            VStack(spacing: 0) {
                EvidenceQuickBar(selectedType: $selectedMode)
                    .padding(.horizontal, RMSystemTheme.Spacing.md)
                    .padding(.top, RMSystemTheme.Spacing.sm)
                if !jobUploads.isEmpty {
                    EvidenceUploadStatusBar(uploads: jobUploads, jobId: effectiveJobId)
                        .padding(.horizontal, RMSystemTheme.Spacing.md)
                        .padding(.top, RMSystemTheme.Spacing.xs)
                }
                RMEvidenceCapture(
                    jobId: effectiveJobId,
                    jobStatus: jobsStore.jobs.first { $0.id == effectiveJobId }?.status ?? ""
                )
            }
        }
        .interactiveDismissDisabled(false)
        .onAppear {
            // Restore last used mode
            if let mode = EvidenceQuickBar.EvidenceType(rawValue: lastModeRaw) {
                selectedMode = mode
            }
            
            // Track existing synced uploads
            trackedUploadIds = Set(uploadManager.uploads.filter {
                if case .synced = $0.state { return true }
                return false
            }.map { $0.id })
        }
        .onChange(of: selectedMode) {
            // Persist last used mode
            lastModeRaw = selectedMode.rawValue
        }
        .onChange(of: uploadManager.uploads) { oldUploads, newUploads in
            // Watch for newly synced uploads for the current job only
            for upload in newUploads where upload.jobId == effectiveJobId {
                if case .synced = upload.state {
                    // If this is a new synced upload we haven't tracked
                    if !trackedUploadIds.contains(upload.id) {
                        trackedUploadIds.insert(upload.id)
                        
                        // Success moment: haptic + "Anchored" toast + streak
                        Haptics.success()
                        UserDefaultsManager.Streaks.recordDayLogged()
                        Analytics.shared.trackEvidenceCaptureCompleted()
                        Analytics.shared.trackCapturePhotoSuccess()
                        
                        // Format timestamp for toast
                        let formatter = DateFormatter()
                        formatter.timeStyle = .short
                        let timeString = formatter.string(from: Date())
                        ToastCenter.shared.show("Anchored • \(timeString)", systemImage: "checkmark.seal.fill", style: .success)
                        
                        // Auto-dismiss after brief delay with background fade
                        Task {
                            // Fade background slightly before dismiss
                            try? await Task.sleep(nanoseconds: 300_000_000) // 0.3s
                            onComplete?()
                            try? await Task.sleep(nanoseconds: 200_000_000) // 0.2s fade
                            dismiss()
                        }
                        break // Only handle one at a time
                    }
                }
            }
        }
    }
}
