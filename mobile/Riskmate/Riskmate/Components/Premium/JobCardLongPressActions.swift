import SwiftUI

/// Long-press quick actions menu for job cards
struct JobCardLongPressActions: ViewModifier {
    let job: Job
    let onAddEvidence: (() -> Void)?
    let onViewLedger: (() -> Void)?
    let onExportProof: (() -> Void)?
    
    @State private var showActions = false
    
    func body(content: Content) -> some View {
        content
            .contextMenu {
                if let onAddEvidence = onAddEvidence {
                    Button {
                        RiskmateDesignSystem.Haptics.impact()
                        Analytics.shared.trackLongPressActionsUsed(action: "add_evidence", jobId: job.id)
                        onAddEvidence()
                    } label: {
                        Label("Add Evidence", systemImage: "camera.fill")
                    }
                }
                
                if let onViewLedger = onViewLedger {
                    Button {
                        RiskmateDesignSystem.Haptics.tap()
                        Analytics.shared.trackLongPressActionsUsed(action: "view_ledger", jobId: job.id)
                        onViewLedger()
                    } label: {
                        Label("View Ledger", systemImage: "lock.shield.fill")
                    }
                }
                
                if let onExportProof = onExportProof {
                    Button {
                        RiskmateDesignSystem.Haptics.success()
                        Analytics.shared.trackLongPressActionsUsed(action: "export_proof", jobId: job.id)
                        onExportProof()
                    } label: {
                        Label("Export Proof", systemImage: "square.and.arrow.up")
                    }
                }
            }
            .accessibilityLabel("Job: \(job.clientName) - \(job.jobType)")
            .accessibilityHint("Long press to access quick actions")
            .simultaneousGesture(
                LongPressGesture(minimumDuration: 0.5)
                    .onEnded { _ in
                        RiskmateDesignSystem.Haptics.impact(.medium)
                    }
            )
    }
}

extension View {
    func jobCardLongPressActions(
        job: Job,
        onAddEvidence: (() -> Void)? = nil,
        onViewLedger: (() -> Void)? = nil,
        onExportProof: (() -> Void)? = nil
    ) -> some View {
        self.modifier(JobCardLongPressActions(
            job: job,
            onAddEvidence: onAddEvidence,
            onViewLedger: onViewLedger,
            onExportProof: onExportProof
        ))
    }
}
