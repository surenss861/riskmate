import SwiftUI

/// Coach mark - one-time tooltip for first-time users
struct CoachMark: View {
    let title: String
    let message: String
    let anchor: Anchor<CGRect>?
    let onDismiss: () -> Void
    
    @State private var opacity: Double = 0
    
    var body: some View {
        GeometryReader { geometry in
            if let anchor = anchor {
                let frame = geometry[anchor]
                
                ZStack {
                    // Dark overlay (accessible - VoiceOver focuses on tooltip)
                    Color.black.opacity(0.6)
                        .ignoresSafeArea()
                        .accessibilityHidden(true) // Overlay is decorative
                        .onTapGesture {
                            dismiss()
                        }
                    
                    // Highlighted area (cutout)
                    Path { path in
                        let rect = CGRect(
                            x: frame.minX - 8,
                            y: frame.minY - 8,
                            width: frame.width + 16,
                            height: frame.height + 16
                        )
                        path.addRoundedRect(in: rect, cornerSize: CGSize(width: 12, height: 12))
                        path.addRect(CGRect(origin: .zero, size: geometry.size))
                    }
                    .fill(.black.opacity(0.8), style: FillStyle(eoFill: true))
                    
                    // Tooltip
                    VStack {
                        if frame.minY > geometry.size.height / 2 {
                            // Show above
                            tooltip
                                .offset(y: frame.minY - 20)
                        } else {
                            // Show below
                            Spacer()
                            tooltip
                                .offset(y: frame.maxY + 20)
                        }
                    }
                }
                .opacity(opacity)
                .onAppear {
                    withAnimation(RiskMateDesignSystem.Motion.spring) {
                        opacity = 1
                    }
                }
            }
        }
    }
    
    private var tooltip: some View {
        VStack(alignment: .leading, spacing: RiskMateDesignSystem.Spacing.sm) {
            Text(title)
                .font(RiskMateDesignSystem.Typography.bodyBold)
                .foregroundColor(RiskMateDesignSystem.Colors.textPrimary)
                .accessibilityAddTraits(.isHeader)
            
            Text(message)
                .font(RiskMateDesignSystem.Typography.bodySmall)
                .foregroundColor(RiskMateDesignSystem.Colors.textSecondary)
            
            Button {
                dismiss()
            } label: {
                Text("Got it")
                    .font(RiskMateDesignSystem.Typography.bodySmallBold)
                    .foregroundColor(.black)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, RiskMateDesignSystem.Spacing.sm)
                    .background(RiskMateDesignSystem.Colors.accent)
                    .clipShape(RoundedRectangle(cornerRadius: RiskMateDesignSystem.Radius.sm))
            }
            .accessibilityLabel("Got it")
            .accessibilityHint("Dismisses this tip")
            .padding(.top, RiskMateDesignSystem.Spacing.xs)
        }
        .padding(RiskMateDesignSystem.Spacing.md)
        .frame(width: 280)
        .background(RiskMateDesignSystem.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: RiskMateDesignSystem.Radius.md))
        .riskMateShadow(RiskMateDesignSystem.Shadow.card)
        .accessibilityElement(children: .combine) // VoiceOver reads as single element
        .accessibilityLabel("\(title). \(message)")
    }
    
    private func dismiss() {
        RiskMateDesignSystem.Haptics.tap()
        withAnimation(RiskMateDesignSystem.Motion.spring) {
            opacity = 0
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            onDismiss()
        }
    }
}

/// Coach mark manager - tracks which coach marks have been shown
struct CoachMarkManager {
    static func hasSeen(_ key: String) -> Bool {
        UserDefaultsManager.CoachMarks.hasSeen(key)
    }
    
    static func markAsSeen(_ key: String) {
        UserDefaultsManager.CoachMarks.markAsSeen(key)
    }
}

#Preview {
    ZStack {
        Color.black
        VStack {
            Spacer()
            Button("Tap + to add evidence") {}
                .padding()
                .background(Color.orange)
        }
    }
}
