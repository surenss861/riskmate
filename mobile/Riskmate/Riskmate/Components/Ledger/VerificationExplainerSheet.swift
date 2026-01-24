import SwiftUI

/// "Verified" explainer - one-sheet modal explaining what verification means
/// Accessible from ledger checkmark tap
struct VerificationExplainerSheet: View {
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: RiskMateDesignSystem.Spacing.lg) {
                    // Icon
                    ZStack {
                        Circle()
                            .fill(RiskMateDesignSystem.Colors.success.opacity(0.15))
                            .frame(width: 80, height: 80)
                        
                        Image(systemName: "checkmark.seal.fill")
                            .font(.system(size: 40, weight: .semibold))
                            .foregroundColor(RiskMateDesignSystem.Colors.success)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, RiskMateDesignSystem.Spacing.lg)
                    
                    // Title
                    Text("What does Verified mean?")
                        .font(RiskMateDesignSystem.Typography.title2)
                        .foregroundColor(RiskMateDesignSystem.Colors.textPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    
                    // Explanation
                    VStack(alignment: .leading, spacing: RiskMateDesignSystem.Spacing.md) {
                        ExplanationPoint(
                            icon: "lock.shield.fill",
                            title: "Cryptographically Anchored",
                            description: "Every proof record is anchored to an immutable ledger. Once anchored, records cannot be edited or deleted."
                        )
                        
                        ExplanationPoint(
                            icon: "link",
                            title: "Chain of Custody",
                            description: "Each record links to the previous one, creating an unbreakable chain. This proves the sequence of events."
                        )
                        
                        ExplanationPoint(
                            icon: "checkmark.seal.fill",
                            title: "Court-Grade Evidence",
                            description: "The ledger provides cryptographic proof that records are authentic and unaltered since creation."
                        )
                    }
                    
                    // Trust statement
                    VStack(alignment: .leading, spacing: RiskMateDesignSystem.Spacing.sm) {
                        Text("This is serious infrastructure, not a tool.")
                            .font(RiskMateDesignSystem.Typography.bodyBold)
                            .foregroundColor(RiskMateDesignSystem.Colors.textPrimary)
                        
                        Text("Every action creates an immutable proof record that can be verified independently.")
                            .font(RiskMateDesignSystem.Typography.bodySmall)
                            .foregroundColor(RiskMateDesignSystem.Colors.textSecondary)
                    }
                    .padding(RiskMateDesignSystem.Spacing.md)
                    .background(RiskMateDesignSystem.Colors.surface.opacity(0.5))
                    .clipShape(RoundedRectangle(cornerRadius: RiskMateDesignSystem.Radius.md))
                    .padding(.top, RiskMateDesignSystem.Spacing.sm)
                }
                .padding(RiskMateDesignSystem.Spacing.pagePadding)
            }
            .background(RiskMateDesignSystem.Colors.background)
            .navigationTitle("Verification")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                Analytics.shared.trackVerificationExplainerOpened()
            }
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        RiskMateDesignSystem.Haptics.tap()
                        dismiss()
                    }
                    .foregroundColor(RiskMateDesignSystem.Colors.accent)
                }
            }
        }
    }
}

struct ExplanationPoint: View {
    let icon: String
    let title: String
    let description: String
    
    var body: some View {
        HStack(alignment: .top, spacing: RiskMateDesignSystem.Spacing.md) {
            Image(systemName: icon)
                .font(.system(size: 20, weight: .semibold))
                .foregroundColor(RiskMateDesignSystem.Colors.accent)
                .frame(width: 32)
            
            VStack(alignment: .leading, spacing: RiskMateDesignSystem.Spacing.xs) {
                Text(title)
                    .font(RiskMateDesignSystem.Typography.bodyBold)
                    .foregroundColor(RiskMateDesignSystem.Colors.textPrimary)
                
                Text(description)
                    .font(RiskMateDesignSystem.Typography.bodySmall)
                    .foregroundColor(RiskMateDesignSystem.Colors.textSecondary)
            }
        }
    }
}

#Preview {
    VerificationExplainerSheet()
}
