import SwiftUI
import Combine

/// Global router for quick actions (evidence capture, tab switch, etc.)
/// Allows presenting sheets and requesting tab/sidebar navigation from anywhere in the app
@MainActor
final class QuickActionRouter: ObservableObject {
    static let shared = QuickActionRouter()
    
    @Published var isEvidenceSheetPresented: Bool = false
    @Published var evidenceJobId: String? = nil
    
    /// Tab/sidebar switch request (observed by ContentView). Cleared after handling.
    @Published var requestedTab: MainTab? = nil
    @Published var workRecordsFilter: String? = nil
    
    /// When true, ContentView presents notification center and switches to settings tab.
    @Published var showNotificationCenter: Bool = false
    
    private init() {}
    
    /// Present evidence capture sheet, optionally scoped to a job
    func presentEvidence(jobId: String? = nil) {
        evidenceJobId = jobId
        isEvidenceSheetPresented = true
    }
    
    /// Dismiss evidence capture sheet
    func dismissEvidence() {
        isEvidenceSheetPresented = false
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            self.evidenceJobId = nil
        }
    }
    
    /// Request switch to Ledger tab (iPhone) or Ledger sidebar item (iPad)
    func requestSwitchToLedger() {
        requestedTab = .ledger
        workRecordsFilter = nil
    }
    
    /// Request switch to Work Records tab with optional filter (iPhone) or sidebar (iPad)
    func requestSwitchToWorkRecords(filter: String? = nil) {
        requestedTab = .workRecords
        workRecordsFilter = filter
    }
    
    /// Consume and clear tab request. Returns (tab, workRecordsFilter) if any.
    func consumeTabRequest() -> (MainTab, String?)? {
        guard let tab = requestedTab else { return nil }
        let filter = workRecordsFilter
        requestedTab = nil
        workRecordsFilter = nil
        return (tab, filter)
    }

    /// Request opening notification center (sheet + switch to settings). ContentView observes showNotificationCenter.
    func openNotificationCenter() {
        showNotificationCenter = true
    }

    /// Clear the request after ContentView has reacted.
    func dismissNotificationCenterRequest() {
        showNotificationCenter = false
    }

    /// Request switch to Settings/Account tab (iPhone) or Account sidebar (iPad).
    func requestSwitchToSettings() {
        requestedTab = .settings
        workRecordsFilter = nil
    }
}
