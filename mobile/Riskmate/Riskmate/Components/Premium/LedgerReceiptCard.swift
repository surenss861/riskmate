import SwiftUI

/// System-native ledger receipt card - Wallet-style proof receipts
struct LedgerReceiptCard: View {
    let title: String
    let subtitle: String
    let timeAgo: String
    let hashPreview: String
    let fullHash: String? // Optional full hash for sharing
    let proofID: String // Stable proof identifier
    
    @State private var showShareSheet = false
    
    init(title: String, subtitle: String, timeAgo: String, hashPreview: String, fullHash: String? = nil, proofID: String? = nil) {
        self.title = title
        self.subtitle = subtitle
        self.timeAgo = timeAgo
        self.hashPreview = hashPreview
        self.fullHash = fullHash
        self.proofID = proofID ?? String(hashPreview.prefix(8)).uppercased()
    }
    
    var body: some View {
        RMCard {
            VStack(alignment: .leading, spacing: RMSystemTheme.Spacing.sm) {
                // Header
                HStack {
                    Text(title)
                        .font(RMSystemTheme.Typography.headline)
                        .foregroundStyle(RMSystemTheme.Colors.textPrimary)
                        .lineLimit(2)
                    
                    Spacer()
                    
                    Text(timeAgo)
                        .font(RMSystemTheme.Typography.caption)
                        .foregroundStyle(RMSystemTheme.Colors.textTertiary)
                }
                
                // Subtitle
                Text(subtitle)
                    .font(RMSystemTheme.Typography.subheadline)
                    .foregroundStyle(RMSystemTheme.Colors.textSecondary)
                
                // Proof ID + Hash (receipt-style)
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("Proof ID")
                            .font(RMSystemTheme.Typography.caption)
                            .foregroundStyle(RMSystemTheme.Colors.textTertiary)
                        
                        Spacer()
                        
                        Text(proofID)
                            .font(RMSystemTheme.Typography.caption.weight(.semibold))
                            .foregroundStyle(RMSystemTheme.Colors.textSecondary)
                    }
                    
                    HStack(spacing: RMSystemTheme.Spacing.xs) {
                        Image(systemName: "number")
                            .foregroundStyle(RMSystemTheme.Colors.textTertiary)
                            .font(.system(size: 11))
                        
                        Text(hashPreview)
                            .font(RMSystemTheme.Typography.monospaced)
                            .foregroundStyle(RMSystemTheme.Colors.textTertiary)
                            .lineLimit(1)
                        
                        Button {
                            Haptics.tap()
                            UIPasteboard.general.string = fullHash ?? hashPreview
                            ToastCenter.shared.show("Copied hash", systemImage: "doc.on.doc", style: .success)
                        } label: {
                            Image(systemName: "doc.on.doc")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(RMSystemTheme.Colors.accent)
                        }
                        
                        Spacer()
                        
                        if fullHash != nil {
                            Menu {
                                Button {
                                    Haptics.tap()
                                    showShareSheet = true
                                } label: {
                                    Label("Share Proof", systemImage: "square.and.arrow.up")
                                }
                                
                                Button {
                                    Haptics.tap()
                                    UIPasteboard.general.string = fullHash
                                    ToastCenter.shared.show("Copied full hash", systemImage: "doc.on.doc", style: .success)
                                } label: {
                                    Label("Copy Full Hash", systemImage: "doc.on.doc")
                                }
                            } label: {
                                Image(systemName: "ellipsis.circle")
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundStyle(RMSystemTheme.Colors.accent)
                            }
                        }
                    }
                }
                .padding(.top, 2)
            }
        }
        .appearIn()
        .sheet(isPresented: $showShareSheet) {
            ShareSheet(items: [fullHash ?? hashPreview])
        }
    }
}
