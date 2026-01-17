import SwiftUI

/// Verification banner for Ledger - makes it feel unforgeable
struct VerificationBanner: View {
    let verified: Bool
    
    var body: some View {
        RMCard {
            HStack(spacing: RMTheme.Spacing.md) {
                Image(systemName: verified ? "checkmark.seal.fill" : "exclamationmark.triangle.fill")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(verified ? Color.green : Color.yellow)
                
                VStack(alignment: .leading, spacing: 4) {
                    Text(verified ? "Ledger Verified" : "Verification Pending")
                        .font(.system(size: 17, weight: .bold, design: .rounded))
                        .foregroundStyle(RMTheme.Colors.textPrimary)
                    
                    Text(verified ? "Chain is intact. Events are tamper-evident." : "Some events are awaiting verification.")
                        .font(.system(size: 13, weight: .medium, design: .rounded))
                        .foregroundStyle(RMTheme.Colors.textSecondary)
                }
                
                Spacer()
                
                Image(systemName: "chevron.right")
                    .foregroundStyle(RMTheme.Colors.textTertiary)
                    .font(.system(size: 14, weight: .semibold))
            }
        }
    }
}
