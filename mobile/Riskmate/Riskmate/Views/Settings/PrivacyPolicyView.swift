import SwiftUI

struct PrivacyPolicyView: View {
    var body: some View {
        NavigationStack {
            ZStack {
                RMBackground()
                
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: RMTheme.Spacing.sectionSpacing) {
                        Text("Privacy Policy")
                            .font(RMTheme.Typography.largeTitle)
                            .foregroundColor(RMTheme.Colors.textPrimary)
                            .padding(.horizontal, RMTheme.Spacing.pagePadding)
                            .padding(.top, RMTheme.Spacing.lg)
                        
                        VStack(alignment: .leading, spacing: RMTheme.Spacing.lg) {
                            SectionView(
                                title: "Information We Collect",
                                content: """
                                RiskMate collects information necessary to provide our audit and compliance services:
                                
                                • Account information (email, organization name)
                                • Job and project data (hazards, controls, evidence)
                                • Photos and documents you upload
                                • Audit logs and compliance records
                                """
                            )
                            
                            SectionView(
                                title: "How We Use Your Information",
                                content: """
                                We use your information to:
                                
                                • Provide audit-ready proof packs and compliance documentation
                                • Maintain ledger integrity and chain-of-custody records
                                • Enable offline-first functionality with secure sync
                                • Generate reports and exports for insurers and auditors
                                """
                            )
                            
                            SectionView(
                                title: "Data Storage and Security",
                                content: """
                                Your data is stored securely:
                                
                                • Encrypted in transit and at rest
                                • Stored per organization with access controls
                                • Backed up regularly with integrity verification
                                • Accessible only to authorized team members
                                """
                            )
                            
                            SectionView(
                                title: "Your Rights",
                                content: """
                                You have the right to:
                                
                                • Access your data at any time
                                • Export your data in standard formats
                                • Request deletion of your account and data
                                • Control who has access to your organization's data
                                """
                            )
                            
                            SectionView(
                                title: "Contact Us",
                                content: """
                                For privacy questions or requests:
                                
                                Email: privacy@riskmate.dev
                                """
                            )
                        }
                        .padding(.horizontal, RMTheme.Spacing.pagePadding)
                    }
                    .padding(.vertical, RMTheme.Spacing.lg)
                }
            }
            .rmNavigationBar(title: "Privacy Policy")
        }
    }
}

struct SectionView: View {
    let title: String
    let content: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
            Text(title)
                .font(RMTheme.Typography.title3)
                .foregroundColor(RMTheme.Colors.textPrimary)
            
            Text(content)
                .font(RMTheme.Typography.body)
                .foregroundColor(RMTheme.Colors.textSecondary)
        }
    }
}
