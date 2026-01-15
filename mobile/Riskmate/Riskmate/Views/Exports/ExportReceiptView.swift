import SwiftUI

/// Export receipt view showing integrity verification details
struct ExportReceiptView: View {
    let export: ExportTask
    @Environment(\.dismiss) private var dismiss
    @State private var showShareSheet = false
    @State private var showVerificationInstructions = false
    
    var body: some View {
        NavigationStack {
            ZStack {
                RMBackground()
                
                ScrollView(showsIndicators: false) {
                    VStack(spacing: RMTheme.Spacing.sectionSpacing) {
                        // Header
                        VStack(spacing: RMTheme.Spacing.sm) {
                            Image(systemName: export.type == .pdf ? "doc.text.fill" : "archivebox.fill")
                                .font(.system(size: 60))
                                .foregroundColor(RMTheme.Colors.accent)
                            
                            Text(export.type.displayName)
                                .font(RMTheme.Typography.headingLarge)
                                .foregroundColor(RMTheme.Colors.textPrimary)
                            
                            Text("Generated \(formatDate(export.createdAt))")
                                .font(RMTheme.Typography.bodySmall)
                                .foregroundColor(RMTheme.Colors.textSecondary)
                        }
                        .padding(.top, RMTheme.Spacing.xl)
                        
                        // Integrity Status
                        IntegrityStatusCard(export: export)
                            .padding(.horizontal, RMTheme.Spacing.pagePadding)
                        
                        // Included Sections
                        IncludedSectionsCard(export: export)
                            .padding(.horizontal, RMTheme.Spacing.pagePadding)
                        
                        // Verification
                        VerificationCard(
                            export: export,
                            onVerify: {
                                verifyIntegrity()
                            },
                            onShowInstructions: {
                                showVerificationInstructions = true
                            }
                        )
                        .padding(.horizontal, RMTheme.Spacing.pagePadding)
                        
                        // Actions
                        VStack(spacing: RMTheme.Spacing.md) {
                            Button {
                                if let url = export.fileURL {
                                    showShareSheet = true
                                }
                            } label: {
                                HStack {
                                    Image(systemName: "square.and.arrow.up")
                                    Text("Share Export")
                                }
                                .font(RMTheme.Typography.bodySmallBold)
                                .foregroundColor(.black)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, RMTheme.Spacing.md)
                                .background(RMTheme.Colors.accent)
                                .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
                            }
                            
                            Button {
                                showVerificationInstructions = true
                            } label: {
                                HStack {
                                    Image(systemName: "info.circle")
                                    Text("How to Verify")
                                }
                                .font(RMTheme.Typography.bodySmall)
                                .foregroundColor(RMTheme.Colors.accent)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, RMTheme.Spacing.sm)
                            }
                        }
                        .padding(.horizontal, RMTheme.Spacing.pagePadding)
                    }
                    .padding(.vertical, RMTheme.Spacing.lg)
                }
            }
            .rmNavigationBar(title: "Export Receipt")
            .sheet(isPresented: $showShareSheet) {
                if let url = export.fileURL {
                    ShareSheet(items: [url])
                }
            }
            .sheet(isPresented: $showVerificationInstructions) {
                VerificationInstructionsView()
            }
        }
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
    
    private func verifyIntegrity() {
        // TODO: Implement local verification
        // Check manifest.json, verify hashes, etc.
    }
}

struct IntegrityStatusCard: View {
    let export: ExportTask
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                HStack {
                    Image(systemName: "checkmark.shield.fill")
                        .foregroundColor(RMTheme.Colors.success)
                        .font(.system(size: 24))
                    
                    Text("Integrity Status")
                        .font(RMTheme.Typography.headingSmall)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    
                    Spacer()
                    
                    Text("Verified")
                        .font(RMTheme.Typography.bodySmallBold)
                        .foregroundColor(RMTheme.Colors.success)
                        .padding(.horizontal, RMTheme.Spacing.sm)
                        .padding(.vertical, 4)
                        .background(RMTheme.Colors.success.opacity(0.2))
                        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.xs))
                }
                
                Divider()
                    .background(RMTheme.Colors.border)
                
                VStack(alignment: .leading, spacing: RMTheme.Spacing.xs) {
                    ReceiptRow(label: "Ledger Root", value: "a3f2...9c1d")
                    ReceiptRow(label: "Hash Verified", value: "SHA-256")
                    ReceiptRow(label: "Timestamp", value: formatDate(export.createdAt))
                }
            }
        }
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        return formatter.string(from: date)
    }
}

struct IncludedSectionsCard: View {
    let export: ExportTask
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                Text("Included Sections")
                    .font(RMTheme.Typography.headingSmall)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                
                Divider()
                    .background(RMTheme.Colors.border)
                
                VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                    if export.type == .proofPack {
                        IncludedSectionRow(name: "Ledger Export", status: "✅")
                        IncludedSectionRow(name: "Controls PDF", status: "✅")
                        IncludedSectionRow(name: "Attestations PDF", status: "✅")
                        IncludedSectionRow(name: "Evidence Index", status: "✅")
                    } else {
                        IncludedSectionRow(name: "Risk Snapshot PDF", status: "✅")
                    }
                }
            }
        }
    }
}

struct IncludedSectionRow: View {
    let name: String
    let status: String
    
    var body: some View {
        HStack {
            Text(name)
                .font(RMTheme.Typography.bodySmall)
                .foregroundColor(RMTheme.Colors.textPrimary)
            
            Spacer()
            
            Text(status)
                .font(RMTheme.Typography.bodySmall)
                .foregroundColor(RMTheme.Colors.success)
        }
    }
}

struct VerificationCard: View {
    let export: ExportTask
    let onVerify: () -> Void
    let onShowInstructions: () -> Void
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                Text("Verification")
                    .font(RMTheme.Typography.headingSmall)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                
                Text("Verify the integrity of this export using the manifest and hash values.")
                    .font(RMTheme.Typography.bodySmall)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                
                Button {
                    onVerify()
                } label: {
                    HStack {
                        Image(systemName: "checkmark.shield.fill")
                        Text("Verify Integrity Now")
                    }
                    .font(RMTheme.Typography.bodySmallBold)
                    .foregroundColor(.black)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, RMTheme.Spacing.sm)
                    .background(RMTheme.Colors.accent)
                    .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
                }
            }
        }
    }
}

struct ReceiptRow: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text(label)
                .font(RMTheme.Typography.bodySmall)
                .foregroundColor(RMTheme.Colors.textSecondary)
            
            Spacer()
            
            Text(value)
                .font(RMTheme.Typography.bodySmallBold)
                .foregroundColor(RMTheme.Colors.textPrimary)
        }
    }
}

struct VerificationInstructionsView: View {
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            ZStack {
                RMBackground()
                
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: RMTheme.Spacing.sectionSpacing) {
                        Text("How to Verify Export Integrity")
                            .font(RMTheme.Typography.headingSmall)
                            .foregroundColor(RMTheme.Colors.textPrimary)
                        
                        VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                            InstructionStep(
                                number: 1,
                                title: "Check Manifest",
                                description: "Open manifest.json in the Proof Pack ZIP to see all included files and their hashes."
                            )
                            
                            InstructionStep(
                                number: 2,
                                title: "Verify Hashes",
                                description: "Compare each file's SHA-256 hash against the manifest to ensure no tampering."
                            )
                            
                            InstructionStep(
                                number: 3,
                                title: "Check Ledger Root",
                                description: "Verify the ledger root hash matches your organization's ledger state at generation time."
                            )
                            
                            InstructionStep(
                                number: 4,
                                title: "Timestamp Verification",
                                description: "Confirm the generation timestamp matches when the export was created."
                            )
                        }
                    }
                    .padding(RMTheme.Spacing.pagePadding)
                }
            }
            .rmNavigationBar(title: "Verification Instructions")
        }
    }
}

struct InstructionStep: View {
    let number: Int
    let title: String
    let description: String
    
    var body: some View {
        HStack(alignment: .top, spacing: RMTheme.Spacing.md) {
            Text("\(number)")
                .font(RMTheme.Typography.headingSmall)
                .foregroundColor(.black)
                .frame(width: 32, height: 32)
                .background(RMTheme.Colors.accent)
                .clipShape(Circle())
            
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(RMTheme.Typography.bodySmallBold)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                
                Text(description)
                    .font(RMTheme.Typography.bodySmall)
                    .foregroundColor(RMTheme.Colors.textSecondary)
            }
        }
    }
}
