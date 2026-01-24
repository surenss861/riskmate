import SwiftUI

/// System-native ledger receipt card - Wallet-style proof receipts
struct LedgerReceiptCard: View {
    let title: String
    let subtitle: String
    let timeAgo: String
    let hashPreview: String
    let fullHash: String? // Optional full hash for sharing
    let proofID: String // Stable proof identifier
    let prevHash: String? // Previous hash for chain verification
    let timestamp: Date // Event timestamp
    let actorName: String? // Actor name
    let isVerified: Bool // Chain verification status
    
    @State private var showShareSheet = false
    @State private var showReceiptDetails = false
    
    init(
        title: String,
        subtitle: String,
        timeAgo: String,
        hashPreview: String,
        fullHash: String? = nil,
        proofID: String? = nil,
        prevHash: String? = nil,
        timestamp: Date = Date(),
        actorName: String? = nil,
        isVerified: Bool = true
    ) {
        self.title = title
        self.subtitle = subtitle
        self.timeAgo = timeAgo
        self.hashPreview = hashPreview
        self.fullHash = fullHash
        self.proofID = proofID ?? String(hashPreview.prefix(8)).uppercased()
        self.prevHash = prevHash
        self.timestamp = timestamp
        self.actorName = actorName
        self.isVerified = isVerified
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
                            .font(.system(.caption, design: .monospaced))
                            .foregroundStyle(RMSystemTheme.Colors.textTertiary)
                            .lineLimit(1)
                        
                        Button {
                            Haptics.success()
                            UIPasteboard.general.string = fullHash ?? hashPreview
                            // Animated copy action (respects Reduce Motion)
                            if !UIAccessibility.isReduceMotionEnabled {
                                withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                                    // Visual feedback handled by toast
                                }
                            }
                            ToastCenter.shared.show("Copied hash", systemImage: "doc.on.doc", style: .success)
                        } label: {
                            Image(systemName: "doc.on.doc")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(RMSystemTheme.Colors.accent)
                        }
                        .accessibilityLabel("Copy hash")
                        .accessibilityHint("Copies the proof hash to clipboard")
                        
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
        .contentShape(Rectangle())
        .onTapGesture {
            Haptics.tap()
            showReceiptDetails = true
        }
        .sheet(isPresented: $showShareSheet) {
            ShareSheet(items: [fullHash ?? hashPreview])
        }
        .sheet(isPresented: $showReceiptDetails) {
            ProofReceiptDetailsView(
                proofID: proofID,
                hash: fullHash ?? hashPreview,
                prevHash: prevHash,
                timestamp: timestamp,
                actorName: actorName,
                isVerified: isVerified
            )
        }
    }
}
