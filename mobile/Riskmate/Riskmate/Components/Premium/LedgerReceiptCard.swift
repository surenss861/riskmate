import SwiftUI

/// System-native ledger receipt card - Wallet-style proof receipts
struct LedgerReceiptCard: View {
    let title: String
    let subtitle: String
    let timeAgo: String
    let hashPreview: String
    let fullHash: String? // Optional full hash for sharing
    
    @State private var showShareSheet = false
    
    init(title: String, subtitle: String, timeAgo: String, hashPreview: String, fullHash: String? = nil) {
        self.title = title
        self.subtitle = subtitle
        self.timeAgo = timeAgo
        self.hashPreview = hashPreview
        self.fullHash = fullHash
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
                
                // Hash preview with actions
                HStack(spacing: RMSystemTheme.Spacing.sm) {
                    Image(systemName: "number")
                        .foregroundStyle(RMSystemTheme.Colors.textTertiary)
                        .font(.system(size: 12))
                    
                    Text(hashPreview)
                        .font(RMSystemTheme.Typography.monospaced)
                        .foregroundStyle(RMSystemTheme.Colors.textTertiary)
                        .lineLimit(1)
                    
                    Spacer()
                    
                    Button {
                        Haptics.tap()
                        UIPasteboard.general.string = fullHash ?? hashPreview
                        Haptics.success()
                    } label: {
                        Text("Copy")
                            .font(RMSystemTheme.Typography.caption.weight(.semibold))
                            .foregroundStyle(RMSystemTheme.Colors.accent)
                    }
                    
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
                                Haptics.success()
                            } label: {
                                Label("Copy Full Hash", systemImage: "doc.on.doc")
                            }
                            
                            // TODO: Add "Verify Externally" when verifier URL is available
                            // Button {
                            //     if let url = URL(string: "https://verifier.riskmate.dev/\(fullHash ?? "")") {
                            //         UIApplication.shared.open(url)
                            //     }
                            // } label: {
                            //     Label("Verify Externally", systemImage: "arrow.up.right.square")
                            // }
                        } label: {
                            Image(systemName: "ellipsis.circle")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundStyle(RMSystemTheme.Colors.accent)
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
