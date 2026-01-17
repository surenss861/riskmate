import SwiftUI

/// Bottom sheet wrapper for evidence capture - provides fast, accessible evidence capture from anywhere
struct EvidenceCaptureSheet: View {
    let jobId: String?
    let onComplete: (() -> Void)?
    
    @Environment(\.dismiss) private var dismiss
    @StateObject private var jobsStore = JobsStore.shared
    
    var body: some View {
        NavigationStack {
            // Use current job if no jobId provided and there's an active job
            let effectiveJobId = jobId ?? jobsStore.jobs.first?.id ?? ""
            
            RMEvidenceCapture(jobId: effectiveJobId)
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
    }
}
