import SwiftUI

/// Ledger receipt card - makes events feel like proof receipts
struct LedgerReceiptCard: View {
    let title: String
    let subtitle: String
    let timeAgo: String
    let hashPreview: String
    
    var body: some View {
        RMCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                // Header
                HStack {
                    Text(title)
                        .font(.system(size: 17, weight: .bold, design: .rounded))
                        .foregroundStyle(RMTheme.Colors.textPrimary)
                        .lineLimit(2)
                    
                    Spacer()
                    
                    Text(timeAgo)
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                        .foregroundStyle(RMTheme.Colors.textTertiary)
                }
                
                // Subtitle
                Text(subtitle)
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundStyle(RMTheme.Colors.textSecondary)
                
                // Hash preview with copy action
                HStack(spacing: 10) {
                    Image(systemName: "number")
                        .foregroundStyle(RMTheme.Colors.textTertiary)
                        .font(.system(size: 12, weight: .medium))
                    
                    Text(hashPreview)
                        .font(.system(size: 12, weight: .semibold, design: .monospaced))
                        .foregroundStyle(RMTheme.Colors.textTertiary)
                        .lineLimit(1)
                    
                    Spacer()
                    
                    Button {
                        UIPasteboard.general.string = hashPreview
                    } label: {
                        Text("Copy Hash")
                            .font(.system(size: 12, weight: .bold, design: .rounded))
                            .foregroundStyle(RMTheme.Colors.accent)
                    }
                }
                .padding(.top, 4)
            }
        }
    }
}
