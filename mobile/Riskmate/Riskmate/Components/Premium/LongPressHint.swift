import SwiftUI

/// Subtle hint for long-press actions - shows once, then never again
struct LongPressHint: View {
    let onDismiss: () -> Void
    
    @State private var isVisible = false
    
    var body: some View {
        if isVisible && !UserDefaultsManager.Tips.hasSeenLongPressHint() {
            HStack(spacing: RiskMateDesignSystem.Spacing.sm) {
                Image(systemName: "hand.tap.fill")
                    .font(.system(size: 14))
                    .foregroundColor(RiskMateDesignSystem.Colors.accent)
                
                Text("Tip: Long-press a job for quick actions")
                    .font(RiskMateDesignSystem.Typography.caption)
                    .foregroundColor(RiskMateDesignSystem.Colors.textSecondary)
                
                Spacer()
                
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 12))
                        .foregroundColor(RiskMateDesignSystem.Colors.textTertiary)
                }
            }
            .padding(.horizontal, RiskMateDesignSystem.Spacing.md)
            .padding(.vertical, RiskMateDesignSystem.Spacing.sm)
            .background(RiskMateDesignSystem.Colors.surface.opacity(0.7))
            .clipShape(RoundedRectangle(cornerRadius: RiskMateDesignSystem.Radius.sm))
            .padding(.horizontal, RiskMateDesignSystem.Spacing.pagePadding)
            .padding(.top, RiskMateDesignSystem.Spacing.sm)
            .transition(.move(edge: .top).combined(with: .opacity))
            .onAppear {
                withAnimation(RiskMateDesignSystem.Motion.spring) {
                    isVisible = true
                }
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Tip: Long-press a job for quick actions")
        }
    }
    
    private func dismiss() {
        RiskMateDesignSystem.Haptics.tap()
        UserDefaultsManager.Tips.markLongPressHintSeen()
        withAnimation(RiskMateDesignSystem.Motion.spring) {
            isVisible = false
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            onDismiss()
        }
    }
}

#Preview {
    ZStack {
        Color.black
        LongPressHint(onDismiss: {})
    }
}
