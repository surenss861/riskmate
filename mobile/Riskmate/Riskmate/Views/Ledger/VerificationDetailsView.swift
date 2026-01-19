import SwiftUI

/// Verification Details screen - auditor brain UI
struct VerificationDetailsView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var showShareSheet = false
    
    // TODO: Wire to actual ledger verification data
    @State private var isVerified: Bool = true
    @State private var lastAnchoredTimestamp: Date? = Date()
    @State private var rootHash: String? = "0x7a3f9e2b1c4d8a6f..."
    @State private var isAnchored: Bool = true
    
    var body: some View {
        NavigationStack {
            List {
                // Status Section
                Section {
                    HStack {
                        Image(systemName: isVerified ? "checkmark.seal.fill" : "exclamationmark.triangle.fill")
                            .foregroundStyle(isVerified ? RMSystemTheme.Colors.success : RMSystemTheme.Colors.warning)
                            .font(.system(size: 24))
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text(isVerified ? "Chain Verified" : "Verification Pending")
                                .font(RMSystemTheme.Typography.headline)
                                .foregroundStyle(RMSystemTheme.Colors.textPrimary)
                            
                            Text(isVerified ? "All events are tamper-evident" : "Some events require verification")
                                .font(RMSystemTheme.Typography.subheadline)
                                .foregroundStyle(RMSystemTheme.Colors.textSecondary)
                        }
                        
                        Spacer()
                    }
                    .padding(.vertical, RMSystemTheme.Spacing.xs)
                } header: {
                    Text("Chain Status")
                }
                
                // Details Section
                Section {
                    // Anchoring Status (Apple-style status message)
                    HStack {
                        Image(systemName: isAnchored ? "checkmark.circle.fill" : "clock.fill")
                            .foregroundStyle(isAnchored ? RMSystemTheme.Colors.success : RMSystemTheme.Colors.warning)
                            .font(.system(size: 16))
                        
                        VStack(alignment: .leading, spacing: 2) {
                            Text(isAnchored ? "Anchored" : "Pending Anchor")
                                .font(RMSystemTheme.Typography.headline)
                                .foregroundStyle(RMSystemTheme.Colors.textPrimary)
                            
                            if let timestamp = lastAnchoredTimestamp {
                                Text(isAnchored 
                                    ? "Anchored \(formatRelativeTime(timestamp))" 
                                    : "Waiting for anchor")
                                    .font(RMSystemTheme.Typography.subheadline)
                                    .foregroundStyle(RMSystemTheme.Colors.textSecondary)
                            }
                        }
                        
                        Spacer()
                    }
                    .padding(.vertical, RMSystemTheme.Spacing.xs)
                    
                    if let timestamp = lastAnchoredTimestamp {
                        DetailRow(
                            label: "Last Anchored",
                            value: formatDate(timestamp),
                            icon: "clock.fill"
                        )
                    }
                    
                    if let hash = rootHash {
                        DetailRow(
                            label: "Root Hash",
                            value: hash,
                            icon: "number",
                            isMonospaced: true
                        )
                        .swipeActions(edge: .trailing) {
                            Button {
                                Haptics.tap()
                                UIPasteboard.general.string = hash
                                Haptics.success()
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
                    }
                } header: {
                    Text("Verification Details")
                }
                
                // Info Section
                Section {
                    Text("The ledger uses cryptographic hashing to ensure events cannot be altered. Each event is linked to the previous, creating an immutable chain.")
                        .font(RMSystemTheme.Typography.footnote)
                        .foregroundStyle(RMSystemTheme.Colors.textSecondary)
                        .padding(.vertical, RMSystemTheme.Spacing.xs)
                } header: {
                    Text("About")
                }
            }
            .navigationTitle("Verification")
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
            if let hash = rootHash {
                ShareSheet(items: [hash])
            }
        }
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
    
    private func formatRelativeTime(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

// MARK: - Detail Row Component

struct DetailRow: View {
    let label: String
    let value: String
    let icon: String
    var isMonospaced: Bool = false
    
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
                    .lineLimit(2)
            }
            
            Spacer()
        }
        .padding(.vertical, RMSystemTheme.Spacing.xs)
    }
}
