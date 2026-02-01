import SwiftUI

/// Subtle hint for long-press actions - shows once, then never again
struct LongPressHint: View {
    let onDismiss: () -> Void
    
    @State private var isVisible = false
    
    var body: some View {
        if isVisible && !UserDefaultsManager.Tips.hasSeenLongPressHint() {
            HStack(spacing: RiskmateDesignSystem.Spacing.sm) {
                Image(systemName: "hand.tap.fill")
                    .font(.system(size: 14))
                    .foregroundColor(RiskmateDesignSystem.Colors.accent)
                
                Text("Tip: Long-press a job for quick actions")
                    .font(RiskmateDesignSystem.Typography.caption)
                    .foregroundColor(RiskmateDesignSystem.Colors.textSecondary)
                
                Spacer()
                
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 12))
                        .foregroundColor(RiskmateDesignSystem.Colors.textTertiary)
                }
            }
            .padding(.horizontal, RiskmateDesignSystem.Spacing.md)
            .padding(.vertical, RiskmateDesignSystem.Spacing.sm)
            .background(RiskmateDesignSystem.Colors.surface.opacity(0.7))
            .clipShape(RoundedRectangle(cornerRadius: RiskmateDesignSystem.Radius.sm))
            .padding(.horizontal, RiskmateDesignSystem.Spacing.pagePadding)
            .padding(.top, RiskmateDesignSystem.Spacing.sm)
            .transition(.move(edge: .top).combined(with: .opacity))
            .onAppear {
                withAnimation(RiskmateDesignSystem.Motion.spring) {
                    isVisible = true
                }
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Tip: Long-press a job for quick actions")
        }
    }
    
    private func dismiss() {
        RiskmateDesignSystem.Haptics.tap()
        UserDefaultsManager.Tips.markLongPressHintSeen()
        withAnimation(RiskmateDesignSystem.Motion.spring) {
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
