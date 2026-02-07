import SwiftUI

/// Button style for auth primary actions — orange when enabled, neutral surface when disabled.
/// Keeps "one orange element per screen" rule.
struct RMPrimaryButtonStyle: ButtonStyle {
    var isEnabled: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 17, weight: .semibold))
            .foregroundColor(isEnabled ? .black : RMTheme.Colors.textTertiary.opacity(0.7))
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(
                Group {
                    if isEnabled {
                        LinearGradient(
                            colors: [RMTheme.Colors.accent, RMTheme.Colors.accent.opacity(0.85)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    } else {
                        RMTheme.Colors.surface
                    }
                }
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(RMTheme.Colors.border.opacity(isEnabled ? 0.0 : 0.8), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .shadow(color: .black.opacity(isEnabled ? 0.25 : 0.10), radius: isEnabled ? 10 : 6, x: 0, y: 6)
            .opacity(configuration.isPressed && isEnabled ? 0.92 : 1.0)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

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
