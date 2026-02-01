import SwiftUI

/// Sheet to generate and share Proof Pack or PDF from Operations/JobsList quick actions.
/// Reuses export flow from Job Detail; guardrails when evidence is below threshold.
/// Fetches evidence count when not provided (e.g. from JobsList/Operations) to avoid "locked forever."
struct ExportProofSheet: View {
    let jobId: String
    @Binding var isPresented: Bool
    /// Pass when known (e.g. Job Detail); otherwise sheet fetches on appear.
    var evidenceCount: Int = 0
    var evidenceRequired: Int = 5
    /// When true, use evidenceCount as-is and don't fetch. Use for Job Detail.
    var useProvidedCount: Bool = false
    
    @EnvironmentObject private var quickAction: QuickActionRouter
    @StateObject private var exportManager = BackgroundExportManager.shared
    @State private var showExportReceipt = false
    @State private var completedExport: ExportTask?
    @State private var showError = false
    @State private var errorMessage = ""
    @State private var fetchedEvidenceCount: Int?
    @State private var isLoadingEvidence = false
    @State private var evidenceFetchFailed = false
    
    private var activeExports: [ExportTask] {
        exportManager.exports.filter { $0.jobId == jobId && ($0.state == .queued || $0.state == .preparing || $0.state == .downloading) }
    }
    
    /// When useProvidedCount: use evidenceCount. In fetch mode: use only fetchedEvidenceCount (never evidenceCount) so we never briefly show "locked" before fetch finishes.
    private var effectiveEvidenceCount: Int? {
        if useProvidedCount { return evidenceCount }
        return fetchedEvidenceCount
    }
    
    private var proofPackUnlocked: Bool {
        guard let c = effectiveEvidenceCount else { return false }
        return c >= evidenceRequired
    }
    
    private var proofPackUnlockMessage: String {
        let c = effectiveEvidenceCount ?? 0
        let need = max(0, evidenceRequired - c)
        return need == 1 ? "Add 1 evidence item to unlock" : "Add \(need) evidence items to unlock"
    }
    
    /// UI always prioritizes loading state: never show "Add X…" or lock message while loading.
    private var proofPackDescription: String {
        if !useProvidedCount && isLoadingEvidence {
            return "Checking readiness…"
        }
        if evidenceFetchFailed {
            return "Couldn't check readiness. Try again."
        }
        if proofPackUnlocked {
            return "ZIP archive with all PDFs, evidence, and verification"
        }
        return proofPackUnlockMessage
    }
    
    private var proofPackDisabled: Bool {
        if !useProvidedCount && isLoadingEvidence { return true }
        if evidenceFetchFailed { return true }
        return !proofPackUnlocked
    }
    
    private var showAddEvidenceCTA: Bool {
        !proofPackUnlocked && !isLoadingEvidence && !evidenceFetchFailed
    }
    
    private var showRetryReadiness: Bool {
        !useProvidedCount && evidenceFetchFailed
    }

    /// One clear sentence for VoiceOver when Proof Pack is locked or loading.
    private var proofPackAccessibilityLabel: String {
        if !useProvidedCount && isLoadingEvidence {
            return "Proof Pack. Checking readiness."
        }
        if evidenceFetchFailed {
            return "Proof Pack. Couldn't check readiness. Use Retry to try again."
        }
        if proofPackUnlocked {
            return "Proof Pack. Ready. ZIP archive with all PDFs and evidence."
        }
        let c = effectiveEvidenceCount ?? 0
        let need = max(0, evidenceRequired - c)
        return "Proof Pack. Locked. Add \(need) more evidence item\(need == 1 ? "" : "s") to unlock."
    }
    
    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(spacing: RMTheme.Spacing.sectionSpacing) {
                    ExportCard(
                        title: "Risk Snapshot Report",
                        description: "Complete job documentation with hazards, controls, and evidence",
                        icon: "doc.text.fill",
                        action: { await generateExport(type: .pdf) },
                        isGenerating: isGenerating(.pdf)
                    )
                    ExportCard(
                        title: "Proof Pack",
                        description: proofPackDescription,
                        icon: "archivebox.fill",
                        action: { await generateExport(type: .proofPack) },
                        isGenerating: isGenerating(.proofPack),
                        disabled: proofPackDisabled
                    )
                    .accessibilityLabel(proofPackAccessibilityLabel)
                    if showAddEvidenceCTA {
                        Button {
                            Haptics.tap()
                            isPresented = false
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                                quickAction.presentEvidence(jobId: jobId)
                            }
                        } label: {
                            Label("Add Evidence", systemImage: "camera.fill")
                                .font(RMTheme.Typography.bodyBold)
                                .foregroundColor(.black)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, RMTheme.Spacing.md)
                                .background(RMTheme.Colors.accent)
                                .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
                        }
                    }
                    if showRetryReadiness {
                        Button {
                            Haptics.tap()
                            evidenceFetchFailed = false
                            Task { await loadEvidenceCountIfNeeded() }
                        } label: {
                            Label("Retry", systemImage: "arrow.clockwise")
                                .font(RMTheme.Typography.bodySmall)
                                .foregroundColor(RMTheme.Colors.accent)
                        }
                    }
                    if !activeExports.isEmpty {
                        VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                            Text("Export Queue")
                                .rmSectionHeader()
                            ForEach(activeExports) { export in
                                ExportStatusCard(export: export)
                            }
                        }
                    }
                }
                .padding(RMTheme.Spacing.pagePadding)
            }
            .background(RMBackground())
            .navigationTitle("Export")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        Haptics.tap()
                        isPresented = false
                    }
                    .foregroundColor(RMTheme.Colors.accent)
                }
            }
            .alert("Error", isPresented: $showError) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(errorMessage)
            }
            .onChange(of: exportManager.exports) { _, _ in
                checkForCompletedExport()
            }
            .sheet(isPresented: $showExportReceipt) {
                if let export = completedExport {
                    ExportReceiptView(export: export)
                }
            }
            .task {
                await loadEvidenceCountIfNeeded()
            }
            .onChange(of: proofPackUnlocked) { _, unlocked in
                if unlocked && !useProvidedCount {
                    Haptics.success()
                }
            }
        }
        .preferredColorScheme(.dark)
    }
    
    /// Fetch mode only. .task auto-cancels on dismiss; we guard state writes with Task.isCancelled to avoid late updates.
    /// @MainActor ensures all @State mutations happen on main. Early return if already loading to prevent double-fetch.
    @MainActor
    private func loadEvidenceCountIfNeeded() async {
        guard !useProvidedCount else { return }
        guard !isLoadingEvidence else { return }
        if Task.isCancelled { return }
        evidenceFetchFailed = false
        isLoadingEvidence = true
        defer {
            if !Task.isCancelled { isLoadingEvidence = false }
        }
        do {
            let list = try await APIClient.shared.getEvidence(jobId: jobId)
            if Task.isCancelled { return }
            fetchedEvidenceCount = list.count
        } catch {
            if Task.isCancelled { return }
            fetchedEvidenceCount = nil
            evidenceFetchFailed = true
        }
    }
    
    private func checkForCompletedExport() {
        if let export = exportManager.exports.first(where: { $0.jobId == jobId && $0.state == .ready && $0.initiatedFromForeground && $0.fileURL != nil }) {
            completedExport = export
            showExportReceipt = true
        }
    }
    
    private func isGenerating(_ type: ExportType) -> Bool {
        activeExports.contains { $0.type == type }
    }
    
    private func generateExport(type: ExportType) async {
        print("🐛 [ExportProofSheet] Export tapped — jobId: \(jobId), type: \(type.rawValue)")
        do {
            print("🐛 [ExportProofSheet] Calling exportManager.export...")
            try await exportManager.export(
                jobId: jobId,
                type: type,
                initiatedFromForeground: true
            )
            print("🐛 [ExportProofSheet] Export created successfully")
        } catch {
            print("🐛 [ExportProofSheet] Export FAILED: \(error)")
            print("🐛 [ExportProofSheet] Error details: \(error.localizedDescription)")
            errorMessage = ExportErrorMessages.friendlyMessage(for: error)
            showError = true
        }
    }
}
