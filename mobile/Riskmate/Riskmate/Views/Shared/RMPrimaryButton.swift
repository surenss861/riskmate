import SwiftUI

/// Riskmate primary button - keep orange, add press feel + haptic
struct RMPrimaryButton: View {
    let title: String
    var isLoading: Bool = false
    var isDisabled: Bool = false
    var action: () -> Void
    
    @State private var isPressed = false
    
    var body: some View {
        Button {
            guard !(isDisabled || isLoading) else { return }
            // Haptic feedback on press
            let generator = UIImpactFeedbackGenerator(style: .medium)
            generator.impactOccurred()
            action()
        } label: {
            ZStack {
                RoundedRectangle(cornerRadius: RMTheme.Radius.md, style: .continuous)
                    .fill(
                        (isDisabled && !isLoading)
                            ? AnyShapeStyle(RMTheme.Colors.surface)
                            : AnyShapeStyle(LinearGradient(
                                colors: [RMTheme.Colors.accent, RMTheme.Colors.accentLight],
                                startPoint: .leading,
                                endPoint: .trailing
                            ))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: RMTheme.Radius.md, style: .continuous)
                            .stroke(
                                (isDisabled && !isLoading) ? RMTheme.Colors.border : Color.clear,
                                lineWidth: 1
                            )
                    )
                
                if isLoading {
                    HStack(spacing: 8) {
                        ProgressView()
                            .tint(.black)
                            .scaleEffect(0.9)
                        Text("Signing in...")
                            .font(RMTheme.Typography.bodyBold)
                            .foregroundColor(.black)
                            .opacity(0.8)
                    }
                } else {
                    Text(title)
                        .font(RMTheme.Typography.bodyBold)
                        .foregroundColor((isDisabled && !isLoading) ? RMTheme.Colors.textTertiary : .black)
                        .opacity((isDisabled && !isLoading) ? 0.7 : 1.0)
                }
            }
            .frame(height: 52)
            .scaleEffect(isPressed ? 0.96 : 1.0) // More noticeable compression
            .animation(RMTheme.Animation.springFast, value: isPressed)
        }
        .buttonStyle(.plain)
        .disabled(isDisabled || isLoading)
        .themeShadow((isDisabled && !isLoading) ? RMTheme.Shadow.small : RMTheme.Shadow.button)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in isPressed = true }
                .onEnded { _ in isPressed = false }
        )
        .accessibilityLabel(title)
        .accessibilityAddTraits(.isButton)
        .accessibilityHint(isLoading ? "Loading" : "")
    }
}

#Preview {
    RMBackground()
        .overlay {
            VStack(spacing: 16) {
                RMPrimaryButton(title: "Log In", action: {})
                RMPrimaryButton(title: "Loading...", isLoading: true, action: {})
                RMPrimaryButton(title: "Disabled", isDisabled: true, action: {})
            }
            .padding()
        }
}
