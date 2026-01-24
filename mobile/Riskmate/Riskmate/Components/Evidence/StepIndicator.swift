import SwiftUI

/// Step indicator dots - shows progress through capture flow
struct StepIndicator: View {
    let currentStep: Int
    let totalSteps: Int
    
    var body: some View {
        HStack(spacing: 8) {
            ForEach(1...totalSteps, id: \.self) { step in
                Circle()
                    .fill(step <= currentStep ? RMSystemTheme.Colors.accent : RMSystemTheme.Colors.textTertiary.opacity(0.3))
                    .frame(width: step == currentStep ? 10 : 8, height: step == currentStep ? 10 : 8)
                    .scaleEffect(step == currentStep ? 1.1 : 1.0)
                    .animation(.spring(response: 0.3, dampingFraction: 0.7), value: currentStep)
            }
        }
        .frame(maxWidth: .infinity)
    }
}

#Preview {
    VStack(spacing: 16) {
        StepIndicator(currentStep: 1, totalSteps: 3)
        StepIndicator(currentStep: 2, totalSteps: 3)
        StepIndicator(currentStep: 3, totalSteps: 3)
    }
    .padding()
    .background(Color.black)
}
