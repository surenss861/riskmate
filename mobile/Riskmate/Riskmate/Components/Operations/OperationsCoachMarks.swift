import SwiftUI

/// Coach marks overlay for first-time Operations screen users
struct OperationsCoachMarks: View {
    @State private var currentMark: CoachMarkKey? = nil
    @State private var fabAnchor: Anchor<CGRect>? = nil
    @State private var riskStripAnchor: Anchor<CGRect>? = nil
    @State private var ledgerAnchor: Anchor<CGRect>? = nil
    
    enum CoachMarkKey: String {
        case fab = "operations_fab"
        case riskStrip = "operations_risk_strip"
        case ledger = "operations_ledger"
    }
    
    var body: some View {
        ZStack {
            if let currentMark = currentMark {
                switch currentMark {
                case .fab:
                    if let anchor = fabAnchor {
                        CoachMark(
                            title: "Tap + to add evidence",
                            message: "Capture photos, videos, or notes. Evidence is automatically linked to jobs and added to your ledger.",
                            anchor: anchor,
                            onDismiss: {
                                showNextMark()
                            }
                        )
                    }
                case .riskStrip:
                    if let anchor = riskStripAnchor {
                        CoachMark(
                            title: "Risk strip shows urgency",
                            message: "The colored strip on the left indicates risk level. Green is low, red is critical. Tap a job to see details.",
                            anchor: anchor,
                            onDismiss: {
                                showNextMark()
                            }
                        )
                    }
                case .ledger:
                    if let anchor = ledgerAnchor {
                        CoachMark(
                            title: "Ledger is your audit trail",
                            message: "Every action creates an immutable proof record. View your ledger to see all anchored proofs.",
                            anchor: anchor,
                            onDismiss: {
                                completeCoachMarks()
                            }
                        )
                    }
                }
            }
        }
        .onAppear {
            if shouldShowCoachMarks() {
                showFirstMark()
            }
        }
    }
    
    private func shouldShowCoachMarks() -> Bool {
        !CoachMarkManager.hasSeen(CoachMarkKey.fab.rawValue)
    }
    
    private func showFirstMark() {
        // Wait a moment for layout
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            currentMark = .fab
        }
    }
    
    private func showNextMark() {
        guard let mark = currentMark else { return }
        CoachMarkManager.markAsSeen(mark.rawValue)
        
        switch mark {
        case .fab:
            currentMark = .riskStrip
        case .riskStrip:
            currentMark = .ledger
        case .ledger:
            completeCoachMarks()
        }
    }
    
    private func completeCoachMarks() {
        CoachMarkManager.markAsSeen(CoachMarkKey.ledger.rawValue)
        currentMark = nil
    }
}

/// View modifier to provide anchor for coach marks
struct CoachMarkAnchor: ViewModifier {
    let key: String
    @Binding var anchor: Anchor<CGRect>?
    
    func body(content: Content) -> some View {
        content
            .anchorPreference(key: CoachMarkPreferenceKey.self, value: .bounds) { anchor in
                // Return the anchor value for the preference key
                anchor
            }
            .onPreferenceChange(CoachMarkPreferenceKey.self) { value in
                // Update binding when preference changes
                self.anchor = value
            }
    }
}

struct CoachMarkPreferenceKey: PreferenceKey {
    static var defaultValue: Anchor<CGRect>? = nil
    static func reduce(value: inout Anchor<CGRect>?, nextValue: () -> Anchor<CGRect>?) {
        value = nextValue() ?? value
    }
}

extension View {
    func coachMarkAnchor(_ key: String, binding: Binding<Anchor<CGRect>?>) -> some View {
        self.modifier(CoachMarkAnchor(key: key, anchor: binding))
    }
}
