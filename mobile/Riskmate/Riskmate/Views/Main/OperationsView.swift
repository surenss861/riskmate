import SwiftUI

struct OperationsView: View {
    var body: some View {
        NavigationView {
            ZStack {
                DesignSystem.Colors.background
                    .ignoresSafeArea()
                
                VStack {
                    Text("Operations")
                        .font(DesignSystem.Typography.title)
                        .foregroundColor(DesignSystem.Colors.textPrimary)
                    Text("Coming soon")
                        .font(DesignSystem.Typography.body)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                }
            }
            .navigationTitle("Operations")
        }
        .preferredColorScheme(.dark)
    }
}

#Preview {
    OperationsView()
}
