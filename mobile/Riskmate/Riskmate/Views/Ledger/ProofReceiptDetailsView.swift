import SwiftUI

/// Wallet-style proof receipt details - shows hash chain linkage for verifiable receipts.
/// Seal moment on open: hashing → verified (Reduce Motion = instant).
struct ProofReceiptDetailsView: View {
    let proofID: String
    let hash: String
    let prevHash: String?
    let timestamp: Date
    let actorName: String?
    let isVerified: Bool
    
    @Environment(\.dismiss) private var dismiss
    @State private var showShareSheet = false
    @State private var showFullHash = false
    /// 0 = hashing, 1 = verified. Only runs once on first appear (gate by hasSealCompleted).
    @State private var sealPhase: Int = 0
    @State private var hasSealCompleted = false
    
    var body: some View {
        NavigationStack {
            List {
                // Status Section (seal moment: hashing → verified)
                Section {
                    if sealPhase == 0 {
                        hashingView
                    } else {
                        verifiedStripView
                    }
                } header: {
                    Text("Verification Status")
                }
                
                // Proof Details Section
                Section {
                    ProofReceiptDetailRow(
                        label: "Proof ID",
                        value: proofID,
                        icon: "number",
                        isMonospaced: false
                    )
                    
                    ProofReceiptDetailRow(
                        label: "Hash",
                        value: showFullHash ? hash : String(hash.prefix(16)) + "...",
                        icon: "number",
                        isMonospaced: true,
                        onTap: copyHash
                    )
                    .swipeActions(edge: .trailing) {
                        Button {
                            copyHash()
                        } label: {
                            Label("Copy", systemImage: "doc.on.doc")
                        }
                        .tint(RMSystemTheme.Colors.accent)
                        
                        Button {
                            Haptics.tap()
                            showShareSheet = true
                        } label: {
                            Label("Share", systemImage: "square.and.arrow.up")
                        }
                        .tint(RMSystemTheme.Colors.categoryAccess)
                    }
                    
                    if let prevHash = prevHash {
                        ProofReceiptDetailRow(
                            label: "Previous Hash",
                            value: String(prevHash.prefix(16)) + "...",
                            icon: "link",
                            isMonospaced: true
                        )
                        .swipeActions(edge: .trailing) {
                            Button {
                                copyToClipboard(prevHash)
                            } label: {
                                Label("Copy", systemImage: "doc.on.doc")
                            }
                            .tint(RMSystemTheme.Colors.accent)
                        }
                        .onTapGesture { copyToClipboard(prevHash) }
                    } else {
                        ProofReceiptDetailRow(
                            label: "Previous Hash",
                            value: "None (root record)",
                            icon: "link",
                            isMonospaced: false
                        )
                    }
                } header: {
                    Text("Proof Details")
                }
                
                // Metadata Section
                Section {
                    ProofReceiptDetailRow(
                        label: "Timestamp",
                        value: formatDate(timestamp),
                        icon: "clock.fill",
                        isMonospaced: false
                    )
                    
                    if let actorName = actorName {
                        ProofReceiptDetailRow(
                            label: "Actor",
                            value: actorName,
                            icon: "person.fill",
                            isMonospaced: false
                        )
                    }
                } header: {
                    Text("Metadata")
                }
                
                // Info Section
                Section {
                    Text("Each proof is cryptographically linked to the previous record. If any record is altered, the hash chain breaks and verification fails.")
                        .font(RMSystemTheme.Typography.footnote)
                        .foregroundStyle(RMSystemTheme.Colors.textSecondary)
                        .padding(.vertical, RMSystemTheme.Spacing.xs)
                } header: {
                    Text("About")
                }
            }
            .navigationTitle("Proof Receipt")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
        .sheet(isPresented: $showShareSheet) {
            ShareSheet(items: [hash])
        }
        .onAppear {
            if RMMotion.reduceMotion {
                sealPhase = 1
                hasSealCompleted = true
                return
            }
            guard !hasSealCompleted else { return }
            Task {
                try? await Task.sleep(nanoseconds: 800_000_000)
                await MainActor.run {
                    withAnimation(RMMotion.easeOut) {
                        sealPhase = 1
                        hasSealCompleted = true
                    }
                }
            }
        }
    }
    
    private var hashingView: some View {
        HStack(spacing: RMTheme.Spacing.sm) {
            ProgressView()
                .scaleEffect(0.9)
                .tint(RMSystemTheme.Colors.textTertiary)
            Text("Hashing…")
                .font(RMSystemTheme.Typography.body)
                .foregroundStyle(RMSystemTheme.Colors.textSecondary)
            Spacer()
        }
        .padding(.vertical, RMSystemTheme.Spacing.xs)
    }
    
    private var verifiedStripView: some View {
        HStack {
            Image(systemName: isVerified ? "checkmark.seal.fill" : "exclamationmark.triangle.fill")
                .foregroundStyle(isVerified ? RMSystemTheme.Colors.success : RMSystemTheme.Colors.warning)
                .font(.system(size: 24))
            VStack(alignment: .leading, spacing: 4) {
                Text(isVerified ? "Verified Chain" : "Chain Mismatch")
                    .font(RMSystemTheme.Typography.headline)
                    .foregroundStyle(RMSystemTheme.Colors.textPrimary)
                Text(isVerified ? "Linked to previous record" : "Hash chain verification failed")
                    .font(RMSystemTheme.Typography.subheadline)
                    .foregroundStyle(RMSystemTheme.Colors.textSecondary)
            }
            Spacer()
        }
        .padding(.vertical, RMSystemTheme.Spacing.xs)
        .opacity(sealPhase == 1 ? 1 : 0)
        .offset(y: sealPhase == 1 ? 0 : 8)
    }
    
    private func copyHash() {
        copyToClipboard(hash)
    }
    
    private func copyToClipboard(_ text: String) {
        UIPasteboard.general.string = text
        Haptics.impact(.light)
        ToastCenter.shared.show("Copied", systemImage: "doc.on.doc", style: .success)
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Detail Row Component

private struct ProofReceiptDetailRow: View {
    let label: String
    let value: String
    let icon: String
    var isMonospaced: Bool = false
    var onTap: (() -> Void)? = nil
    
    var body: some View {
        HStack(spacing: RMSystemTheme.Spacing.md) {
            Image(systemName: icon)
                .foregroundStyle(RMSystemTheme.Colors.textTertiary)
                .font(.system(size: 16))
                .frame(width: 24)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(RMSystemTheme.Typography.caption)
                    .foregroundStyle(RMSystemTheme.Colors.textTertiary)
                
                Text(value)
                    .font(isMonospaced ? RMSystemTheme.Typography.monospaced : RMSystemTheme.Typography.body)
                    .foregroundStyle(RMSystemTheme.Colors.textPrimary)
                    .lineLimit(isMonospaced ? 1 : 2)
            }
            
            Spacer()
        }
        .padding(.vertical, RMSystemTheme.Spacing.xs)
        .contentShape(Rectangle())
        .onTapGesture {
            onTap?()
        }
    }
}

#Preview {
    ProofReceiptDetailsView(
        proofID: "A91F7C2B",
        hash: "a91f7c2b1c4d8a6f5e3b9d2c8a4f1e7b6d3c9a2f5e8b1d4c7a3f6e9b2d5c8a1",
        prevHash: "b2c8a4f1e7b6d3c9a2f5e8b1d4c7a3f6e9b2d5c8a1f4e7b3d6c9a2f5e8b1",
        timestamp: Date(),
        actorName: "John Doe",
        isVerified: true
    )
}
