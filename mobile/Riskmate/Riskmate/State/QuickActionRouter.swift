import SwiftUI

/// Global router for quick actions (evidence capture, new job, etc.)
/// Allows presenting sheets from anywhere in the app
@MainActor
final class QuickActionRouter: ObservableObject {
    static let shared = QuickActionRouter()
    
    @Published var isEvidenceSheetPresented: Bool = false
    @Published var evidenceJobId: String? = nil
    
    private init() {}
    
    /// Present evidence capture sheet, optionally scoped to a job
    func presentEvidence(jobId: String? = nil) {
        evidenceJobId = jobId
        isEvidenceSheetPresented = true
    }
    
    /// Dismiss evidence capture sheet
    func dismissEvidence() {
        isEvidenceSheetPresented = false
        // Clear jobId after a short delay to avoid flicker
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            self.evidenceJobId = nil
        }
    }
}
