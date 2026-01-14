import SwiftUI

/// RiskMate primary button - iOS-native press + clean depth
struct RMPrimaryButton: View {
    let title: String
    var isLoading: Bool = false
    var isDisabled: Bool = false
    var action: () -> Void
    
    var body: some View {
        Button(action: action) {
            ZStack {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color(hex: "#F97316"))
                    .opacity(isDisabled ? 0.45 : 1.0)
                
                if isLoading {
                    ProgressView()
                        .tint(.black)
                } else {
                    Text(title)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(.black)
                }
            }
            .frame(height: 52)
        }
        .buttonStyle(.plain)
        .disabled(isDisabled || isLoading)
        .shadow(color: .black.opacity(0.35), radius: 16, x: 0, y: 10)
        .pressEffect()
    }
}

/// Tiny native-feeling press animation
private struct PressEffect: ViewModifier {
    @GestureState private var isPressed = false
    
    func body(content: Content) -> some View {
        content
            .scaleEffect(isPressed ? 0.985 : 1)
            .opacity(isPressed ? 0.92 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.9), value: isPressed)
            .gesture(
                DragGesture(minimumDistance: 0)
                    .updating($isPressed) { _, state, _ in state = true }
            )
    }
}

private extension View {
    func pressEffect() -> some View {
        modifier(PressEffect())
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
