import SwiftUI

/// RiskMate primary button - keep orange, add press feel + haptic
struct RMPrimaryButton: View {
    let title: String
    var isLoading: Bool = false
    var isDisabled: Bool = false
    var action: () -> Void
    
    @State private var isPressed = false
    
    var body: some View {
        Button {
            guard !(isDisabled || isLoading) else { return }
            UIImpactFeedbackGenerator(style: .soft).impactOccurred()
            action()
        } label: {
            ZStack {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color(hex: "#F97316"))
                    .opacity(isDisabled ? 0.5 : 1.0)
                
                if isLoading {
                    ProgressView()
                        .tint(.black)
                } else {
                    Text(title)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.black)
                }
            }
            .frame(height: 52)
            .scaleEffect(isPressed ? 0.98 : 1.0)
            .animation(.spring(response: 0.25, dampingFraction: 0.9), value: isPressed)
        }
        .buttonStyle(.plain)
        .disabled(isDisabled || isLoading)
        .shadow(color: Color(hex: "#F97316").opacity(0.18), radius: 18, x: 0, y: 10)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in isPressed = true }
                .onEnded { _ in isPressed = false }
        )
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
