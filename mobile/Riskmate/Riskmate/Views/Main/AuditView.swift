import SwiftUI

struct AuditView: View {
    var body: some View {
        NavigationView {
            ZStack {
                RMBackground()
                
                VStack {
                    Text("Audit")
                        .font(DesignSystem.Typography.title)
                        .foregroundColor(DesignSystem.Colors.textPrimary)
                    Text("Coming soon")
                        .font(DesignSystem.Typography.body)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                }
            }
            .navigationTitle("Audit")
        }
        .preferredColorScheme(.dark)
    }
}

#Preview {
    AuditView()
}
