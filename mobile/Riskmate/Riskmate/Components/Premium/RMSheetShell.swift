import SwiftUI

/// Unified sheet container: material background, RMSheetHeader, consistent enter motion, safe area.
/// Use for all bottom sheets so header spacing, blur, and close affordance are identical.
/// Reduce Motion: no y-offset on content enter. No haptic on open/close (only on meaningful actions).
struct RMSheetShell<Content: View>: View {
    let title: String
    var subtitle: String? = nil
    var currentStep: Int? = nil
    var totalSteps: Int? = nil
    let onClose: () -> Void
    @ViewBuilder let content: () -> Content

    @State private var contentAppeared = false

    var body: some View {
        VStack(spacing: 0) {
            RMSheetHeader(
                title: title,
                subtitle: subtitle,
                onClose: onClose,
                currentStep: currentStep,
                totalSteps: totalSteps
            )
            content()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .opacity(contentAppeared ? 1 : 0)
                .offset(y: RMMotion.reduceMotion ? 0 : (contentAppeared ? 0 : 12))
                .animation(RMMotion.easeOut, value: contentAppeared)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(RMTheme.Colors.background)
        .presentationDragIndicator(.visible)
        .presentationDetents([.medium, .large])
        .onAppear {
            contentAppeared = true
            Analytics.shared.trackSheetOpen(sheet: title)
        }
        .onDisappear {
            Analytics.shared.trackSheetClose(sheet: title)
        }
    }
}

#Preview {
    RMSheetShell(
        title: "Preview sheet",
        subtitle: "Unified shell",
        onClose: {}
    ) {
        ScrollView {
            Text("Content here")
                .padding(RMTheme.Spacing.pagePadding)
        }
    }
}
