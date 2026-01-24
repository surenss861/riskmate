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
        NavigationStack {
            VStack(spacing: 0) {
                // Step indicator dots (visual progress)
                StepIndicator(currentStep: 1, totalSteps: 3)
                    .padding(.top, RMSystemTheme.Spacing.md)
                    .padding(.horizontal, RMSystemTheme.Spacing.md)
                
                // Quick capture bar at top
                EvidenceQuickBar(selectedType: $selectedMode)
                    .padding(.top, RMSystemTheme.Spacing.sm)
                
                // Offline upload status (if any uploads are queued/uploading/failed)
                if !jobUploads.isEmpty {
                    EvidenceUploadStatusBar(uploads: jobUploads, jobId: effectiveJobId)
                        .padding(.horizontal, RMSystemTheme.Spacing.md)
                        .padding(.top, RMSystemTheme.Spacing.xs)
                }
                
                RMEvidenceCapture(jobId: effectiveJobId)
            }
            .navigationTitle("Add Evidence")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") {
                        onComplete?()
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
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
        .onChange(of: selectedMode) { newMode in
            // Persist last used mode
            lastModeRaw = newMode.rawValue
        }
        .onChange(of: uploadManager.uploads) { uploads in
            // Watch for newly synced uploads
            for upload in uploads {
                if case .synced = upload.state {
                    // If this is a new synced upload we haven't tracked
                    if !trackedUploadIds.contains(upload.id) {
                        trackedUploadIds.insert(upload.id)
                        
                        // Success moment: haptic + "Anchored" toast with timestamp + dismiss
                        Haptics.success()
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
