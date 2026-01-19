import SwiftUI

/// System-native verification banner - Wallet/Security style
struct VerificationBanner: View {
    let verified: Bool
    let onTap: (() -> Void)?
    
    init(verified: Bool, onTap: (() -> Void)? = nil) {
        self.verified = verified
        self.onTap = onTap
    }
    
    var body: some View {
        Button {
            Haptics.tap()
            onTap?()
        } label: {
            RMCard {
                HStack(spacing: RMSystemTheme.Spacing.md) {
                    Image(systemName: verified ? "checkmark.seal.fill" : "exclamationmark.triangle.fill")
                        .font(.system(size: 20, weight: .medium))
                        .foregroundStyle(verified ? RMSystemTheme.Colors.success : RMSystemTheme.Colors.warning)
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text(verified ? "Verified" : "Verification Pending")
                            .font(RMSystemTheme.Typography.headline)
                            .foregroundStyle(RMSystemTheme.Colors.textPrimary)
                        
                        Text(verified ? "All events verified" : "Some events awaiting verification")
                            .font(RMSystemTheme.Typography.subheadline)
                            .foregroundStyle(RMSystemTheme.Colors.textSecondary)
                    }
                    
                    Spacer()
                    
                    if onTap != nil {
                        Image(systemName: "chevron.right")
                            .foregroundStyle(RMSystemTheme.Colors.textTertiary)
                            .font(.system(size: 14, weight: .medium))
                    }
                }
            }
        }
        .buttonStyle(.plain)
    }
}
