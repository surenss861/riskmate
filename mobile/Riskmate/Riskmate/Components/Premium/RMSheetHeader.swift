import SwiftUI

/// Reusable sheet header: blur, title, subtitle, close button, optional step indicator. Package 7.
struct RMSheetHeader: View {
    let title: String
    var subtitle: String? = nil
    let onClose: () -> Void
    /// When set, shows step indicator below subtitle (e.g. currentStep: 1, totalSteps: 3).
    var currentStep: Int? = nil
    var totalSteps: Int? = nil
    
    var body: some View {
        VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
            HStack {
                VStack(alignment: .leading, spacing: RMTheme.Spacing.xs) {
                    Text(title)
                        .font(RMTheme.Typography.title3)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    if let subtitle = subtitle, !subtitle.isEmpty {
                        Text(subtitle)
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.textSecondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Button {
                    Haptics.tap()
                    onClose()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 28))
                        .foregroundStyle(RMTheme.Colors.textSecondary)
                        .symbolRenderingMode(.hierarchical)
                }
            }
            .padding(.horizontal, RMTheme.Spacing.md)
            .padding(.top, RMTheme.Spacing.sm)
            .padding(.bottom, currentStep != nil ? RMTheme.Spacing.xs : RMTheme.Spacing.sm)
            
            if let step = currentStep, let total = totalSteps, total > 0 {
                StepIndicatorRM(currentStep: step, totalSteps: total)
                    .padding(.horizontal, RMTheme.Spacing.md)
                    .padding(.bottom, RMTheme.Spacing.sm)
            }
        }
        .background(.ultraThinMaterial)
        .background(RMTheme.Colors.background.opacity(0.95))
    }
}

/// Step indicator using RMTheme (for use in premium sheets).
private struct StepIndicatorRM: View {
    let currentStep: Int
    let totalSteps: Int
    
    var body: some View {
        HStack(spacing: 8) {
            ForEach(1...totalSteps, id: \.self) { step in
                Circle()
                    .fill(step <= currentStep ? RMTheme.Colors.accent : RMTheme.Colors.textTertiary.opacity(0.3))
                    .frame(width: step == currentStep ? 10 : 8, height: step == currentStep ? 10 : 8)
                    .scaleEffect(step == currentStep ? 1.1 : 1.0)
                    .animation(RMMotion.spring, value: currentStep)
            }
        }
        .frame(maxWidth: .infinity)
    }
}

#Preview {
    VStack(spacing: 0) {
        RMSheetHeader(
            title: "Request signature",
            subtitle: "Choose who will sign",
            onClose: {},
            currentStep: 1,
            totalSteps: 3
        )
        Spacer()
    }
    .background(RMTheme.Colors.background)
}
