import SwiftUI

struct TermsOfServiceView: View {
    var body: some View {
        NavigationStack {
            ZStack {
                RMBackground()
                
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: RMTheme.Spacing.sectionSpacing) {
                        Text("Terms of Service")
                            .font(RMTheme.Typography.largeTitle)
                            .foregroundColor(RMTheme.Colors.textPrimary)
                            .padding(.horizontal, RMTheme.Spacing.pagePadding)
                            .padding(.top, RMTheme.Spacing.lg)
                        
                        VStack(alignment: .leading, spacing: RMTheme.Spacing.lg) {
                            SectionView(
                                title: "Acceptance of Terms",
                                content: """
                                By using Riskmate, you agree to these Terms of Service. If you do not agree, please do not use the service.
                                """
                            )
                            
                            SectionView(
                                title: "Service Description",
                                content: """
                                Riskmate provides audit-ready compliance documentation and proof pack generation for contractors and organizations. We help you document hazards, controls, and evidence to create defensible audit trails.
                                """
                            )
                            
                            SectionView(
                                title: "User Responsibilities",
                                content: """
                                You are responsible for:
                                
                                • Maintaining the accuracy of your data
                                • Ensuring compliance with applicable regulations
                                • Protecting your account credentials
                                • Using the service in accordance with applicable laws
                                """
                            )
                            
                            SectionView(
                                title: "Data Integrity",
                                content: """
                                Riskmate maintains ledger integrity and chain-of-custody records. You acknowledge that:
                                
                                • All actions are recorded and cannot be deleted
                                • Export integrity is verified through cryptographic hashes
                                • Audit logs are immutable and serve as legal records
                                """
                            )
                            
                            SectionView(
                                title: "Limitation of Liability",
                                content: """
                                Riskmate is provided "as is" without warranties. We are not liable for:
                                
                                • Decisions made based on exported documentation
                                • Compliance failures or regulatory violations
                                • Data loss due to user error or system failures
                                """
                            )
                            
                            SectionView(
                                title: "Contact",
                                content: """
                                For questions about these terms:
                                
                                Email: legal@riskmate.dev
                                """
                            )
                        }
                        .padding(.horizontal, RMTheme.Spacing.pagePadding)
                    }
                    .padding(.vertical, RMTheme.Spacing.lg)
                }
            }
            .rmNavigationBar(title: "Terms of Service")
        }
    }
}
