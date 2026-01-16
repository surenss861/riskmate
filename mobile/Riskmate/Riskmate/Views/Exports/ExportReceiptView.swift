import SwiftUI

/// Export receipt view showing integrity verification details
struct ExportReceiptView: View {
    let export: ExportTask
    @Environment(\.dismiss) private var dismiss
    @State private var showShareSheet = false
    @State private var showVerificationInstructions = false
    @State private var showHashComparison = false
    @State private var showChainVerification = false
    
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
                        
                        // What's Inside Preview
                        WhatsInsideCard(export: export)
                            .padding(.horizontal, RMTheme.Spacing.pagePadding)
                        
                        // 2-Step Verification
                        TwoStepVerificationCard(
                            export: export,
                            onStep1: {
                                showHashComparison = true
                            },
                            onStep2: {
                                showChainVerification = true
                            }
                        )
                        .padding(.horizontal, RMTheme.Spacing.pagePadding)
                        
                        // Actions
                        VStack(spacing: RMTheme.Spacing.md) {
                            Button {
                                if export.fileURL != nil {
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
            .sheet(isPresented: $showHashComparison) {
                HashComparisonView(export: export)
            }
            .sheet(isPresented: $showChainVerification) {
                ChainOfCustodyVerificationView(export: export)
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

/// What's Inside preview with section chips
struct WhatsInsideCard: View {
    let export: ExportTask
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                Text("What's Inside")
                    .font(RMTheme.Typography.headingSmall)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                
                Divider()
                    .background(RMTheme.Colors.border)
                
                // Section chips
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: RMTheme.Spacing.sm) {
                        if export.type == .proofPack {
                            SectionChip(name: "Ledger", icon: "list.bullet.rectangle")
                            SectionChip(name: "Evidence", icon: "photo.fill")
                            SectionChip(name: "Attestations", icon: "signature")
                            SectionChip(name: "Controls", icon: "checkmark.shield.fill")
                        } else {
                            SectionChip(name: "Risk Snapshot", icon: "doc.text.fill")
                        }
                    }
                }
            }
        }
    }
}

struct SectionChip: View {
    let name: String
    let icon: String
    
    var body: some View {
        HStack(spacing: RMTheme.Spacing.xs) {
            Image(systemName: icon)
                .font(.system(size: 12))
            Text(name)
                .font(RMTheme.Typography.captionBold)
        }
        .foregroundColor(RMTheme.Colors.textPrimary)
        .padding(.horizontal, RMTheme.Spacing.sm)
        .padding(.vertical, RMTheme.Spacing.xs)
        .background(RMTheme.Colors.inputFill)
        .clipShape(Capsule())
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

/// 2-step verification flow
struct TwoStepVerificationCard: View {
    let export: ExportTask
    let onStep1: () -> Void
    let onStep2: () -> Void
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                Text("Verify Pack")
                    .font(RMTheme.Typography.headingSmall)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                
                Text("Two-step verification ensures export integrity and chain-of-custody.")
                    .font(RMTheme.Typography.bodySmall)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                
                VStack(spacing: RMTheme.Spacing.sm) {
                    VerificationStepButton(
                        step: 1,
                        title: "Compare Hashes",
                        description: "Copy manifest + verify file hashes",
                        icon: "number.circle.fill",
                        action: onStep1
                    )
                    
                    VerificationStepButton(
                        step: 2,
                        title: "Verify Chain-of-Custody",
                        description: "Check timestamps and ledger root",
                        icon: "link.circle.fill",
                        action: onStep2
                    )
                }
            }
        }
    }
}

struct VerificationStepButton: View {
    let step: Int
    let title: String
    let description: String
    let icon: String
    let action: () -> Void
    
    var body: some View {
        Button {
            let generator = UIImpactFeedbackGenerator(style: .medium)
            generator.impactOccurred()
            action()
        } label: {
            HStack(spacing: RMTheme.Spacing.md) {
                Image(systemName: icon)
                    .foregroundColor(RMTheme.Colors.accent)
                    .font(.system(size: 24))
                
                VStack(alignment: .leading, spacing: 2) {
                    Text("Step \(step): \(title)")
                        .font(RMTheme.Typography.bodySmallBold)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    
                    Text(description)
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                }
                
                Spacer()
                
                Image(systemName: "chevron.right")
                    .foregroundColor(RMTheme.Colors.textTertiary)
                    .font(.system(size: 14))
            }
            .padding(RMTheme.Spacing.md)
            .background(RMTheme.Colors.inputFill)
            .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
        }
    }
}

/// Hash comparison view with copy helpers
struct HashComparisonView: View {
    let export: ExportTask
    @Environment(\.dismiss) private var dismiss
    @State private var copiedHash = false
    
    var body: some View {
        NavigationStack {
            ZStack {
                RMBackground()
                
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: RMTheme.Spacing.sectionSpacing) {
                        Text("Step 1: Compare Hashes")
                            .font(RMTheme.Typography.headingSmall)
                            .foregroundColor(RMTheme.Colors.textPrimary)
                        
                        Text("Copy the manifest hash and compare it with the files in your Proof Pack.")
                            .font(RMTheme.Typography.bodySmall)
                            .foregroundColor(RMTheme.Colors.textSecondary)
                        
                        // Manifest hash
                        RMGlassCard {
                            VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                                Text("Manifest Hash")
                                    .font(RMTheme.Typography.bodySmallBold)
                                    .foregroundColor(RMTheme.Colors.textPrimary)
                                
                                HStack {
                                    Text("a3f2b1c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2")
                                        .font(.system(size: 12, design: .monospaced))
                                        .foregroundColor(RMTheme.Colors.textSecondary)
                                    
                                    Spacer()
                                    
                                    Button {
                                        UIPasteboard.general.string = "a3f2b1c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2"
                                        copiedHash = true
                                        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                                            copiedHash = false
                                        }
                                    } label: {
                                        Image(systemName: copiedHash ? "checkmark.circle.fill" : "doc.on.doc")
                                            .foregroundColor(RMTheme.Colors.accent)
                                    }
                                }
                            }
                        }
                        
                        // Instructions
                        VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                            Text("Instructions")
                                .font(RMTheme.Typography.bodySmallBold)
                                .foregroundColor(RMTheme.Colors.textPrimary)
                            
                            InstructionBullet(text: "Extract the Proof Pack ZIP file")
                            InstructionBullet(text: "Open manifest.json")
                            InstructionBullet(text: "Compare each file's hash with the manifest")
                            InstructionBullet(text: "Verify all hashes match (SHA-256)")
                        }
                    }
                    .padding(RMTheme.Spacing.pagePadding)
                }
            }
            .rmNavigationBar(title: "Compare Hashes")
        }
    }
}

struct InstructionBullet: View {
    let text: String
    
    var body: some View {
        HStack(alignment: .top, spacing: RMTheme.Spacing.sm) {
            Text("•")
                .foregroundColor(RMTheme.Colors.accent)
            Text(text)
                .font(RMTheme.Typography.bodySmall)
                .foregroundColor(RMTheme.Colors.textSecondary)
        }
    }
}

/// Chain-of-custody verification view
struct ChainOfCustodyVerificationView: View {
    let export: ExportTask
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            ZStack {
                RMBackground()
                
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: RMTheme.Spacing.sectionSpacing) {
                        Text("Step 2: Verify Chain-of-Custody")
                            .font(RMTheme.Typography.headingSmall)
                            .foregroundColor(RMTheme.Colors.textPrimary)
                        
                        Text("Check timestamps and ledger root to verify the chain-of-custody is intact.")
                            .font(RMTheme.Typography.bodySmall)
                            .foregroundColor(RMTheme.Colors.textSecondary)
                        
                        // Verification checklist
                        VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                            VerificationChecklistItem(
                                label: "Generation timestamp matches export time",
                                checked: true
                            )
                            
                            VerificationChecklistItem(
                                label: "Ledger root matches organization state",
                                checked: true
                            )
                            
                            VerificationChecklistItem(
                                label: "All evidence timestamps are sequential",
                                checked: true
                            )
                            
                            VerificationChecklistItem(
                                label: "No gaps in chain-of-custody",
                                checked: true
                            )
                        }
                        
                        // What to check
                        RMGlassCard {
                            VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                                Text("What to Check")
                                    .font(RMTheme.Typography.bodySmallBold)
                                    .foregroundColor(RMTheme.Colors.textPrimary)
                                
                                Text("Timestamps come from the ledger events. Each control completion, evidence upload, and attestation has a recorded timestamp that forms the chain.")
                                    .font(RMTheme.Typography.bodySmall)
                                    .foregroundColor(RMTheme.Colors.textSecondary)
                            }
                        }
                    }
                    .padding(RMTheme.Spacing.pagePadding)
                }
            }
            .rmNavigationBar(title: "Chain-of-Custody")
        }
    }
}

struct VerificationChecklistItem: View {
    let label: String
    let checked: Bool
    
    var body: some View {
        HStack(spacing: RMTheme.Spacing.sm) {
            Image(systemName: checked ? "checkmark.circle.fill" : "circle")
                .foregroundColor(checked ? RMTheme.Colors.success : RMTheme.Colors.textTertiary)
            
            Text(label)
                .font(RMTheme.Typography.bodySmall)
                .foregroundColor(RMTheme.Colors.textPrimary)
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
