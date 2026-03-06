# JobDetailView.swift — Evidence + Exports chunks for surgical pass

**File:** `mobile/Riskmate/Riskmate/Views/Main/JobDetailView.swift`

**External refs used by these tabs (not in this file):**
- `EvidencePhase` (RMEvidenceCapture.swift)
- `ScrollOffsetPreferenceKey` (Components/Operations/ScrollOffsetPreferenceKey.swift)
- `LastExport` (BackgroundExportManager.swift)
- `RMIntegritySurface` (Components/RMIntegritySurface.swift)
- `EvidenceCaptureSheet`, `ShareSheet`, `ExportReceiptView`, `ExportErrorMessages`, `.trustToast` modifier

---

## CHUNK 1: struct EvidenceTab (lines 1847–1955)

```swift
// MARK: - Evidence Tab

struct EvidenceTab: View {
    let jobId: String
    @StateObject private var uploadManager = BackgroundUploadManager.shared
    @State private var evidence: [EvidenceItem] = []
    @State private var isLoading = true
    @State private var showImagePicker = false
    
    var body: some View {
        let activeUploads = uploadManager.uploads.filter { $0.jobId == jobId }
        ScrollView(showsIndicators: false) {
            VStack(spacing: RMTheme.Spacing.sectionSpacing) {
                // Evidence section header + Add Evidence (same label/icon in empty and non-empty)
                HStack {
                    Text("Evidence")
                        .rmSectionHeader()
                    Spacer()
                    Button {
                        Haptics.tap()
                        showImagePicker = true
                    } label: {
                        Label("Add Evidence", systemImage: "camera.fill")
                            .font(RMTheme.Typography.bodySmallBold)
                            .foregroundColor(RMTheme.Colors.accent)
                    }
                }
                .padding(.horizontal, RMTheme.Spacing.pagePadding)
                
                // Active uploads (Uploading… with progress, Failed — Tap to retry, Uploaded)
                if !activeUploads.isEmpty {
                    VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                        Text("Uploads")
                            .rmSectionHeader()
                            .padding(.horizontal, RMTheme.Spacing.pagePadding)
                        
                        ForEach(activeUploads) { upload in
                            UploadStatusCard(upload: upload)
                                .padding(.horizontal, RMTheme.Spacing.pagePadding)
                        }
                    }
                }
                
                // Synced evidence or empty state
                if evidence.isEmpty && activeUploads.isEmpty {
                    RMEmptyState(
                        icon: "photo",
                        title: "No Evidence",
                        message: "Upload photos and documents to complete readiness"
                    )
                    .padding(.top, RMTheme.Spacing.lg)
                    Button {
                        Haptics.tap()
                        showImagePicker = true
                    } label: {
                        Label("Add Evidence", systemImage: "camera.fill")
                            .font(RMTheme.Typography.bodySmallBold)
                            .foregroundColor(RMTheme.Colors.accent)
                    }
                    .padding(.top, RMTheme.Spacing.sm)
                } else {
                    ForEach(evidence) { item in
                        EvidenceCard(
                            jobId: jobId,
                            item: item,
                            onCategoryChanged: { await loadEvidence() }
                        )
                        .padding(.horizontal, RMTheme.Spacing.pagePadding)
                    }
                }
            }
            .padding(.vertical, RMTheme.Spacing.lg)
        }
        .sheet(isPresented: $showImagePicker) {
            EvidenceCaptureSheet(jobId: jobId) {
                // Refresh evidence list when sheet completes (e.g. after upload)
                Task { await loadEvidence() }
            }
        }
        .onChange(of: showImagePicker) { _, isShowing in
            if !isShowing {
                Task { await loadEvidence() }
            }
        }
        .task {
            await loadEvidence()
        }
    }
    
    private func loadEvidence() async {
        isLoading = true
        defer { isLoading = false }
        
        do {
            evidence = try await APIClient.shared.getEvidence(jobId: jobId)
            
            // Cache for offline (real data only)
            OfflineCache.shared.cacheEvidence(jobId: jobId, evidence: evidence)
        } catch {
            // Try offline cache (real previously-fetched data only)
            if let cached = OfflineCache.shared.getCachedEvidence(jobId: jobId) {
                print("[EvidenceTab] Using cached evidence (offline mode)")
                evidence = cached
            } else {
                // No cache available - show empty (no demo data)
                print("[EvidenceTab] ❌ Failed to load evidence and no cache: \(error.localizedDescription)")
                evidence = []
            }
        }
    }
}
```

---

## CHUNK 2: struct ExportsTab (lines 2259–2484)

```swift
// MARK: - Exports Tab

struct ExportsTab: View {
    let jobId: String
    @EnvironmentObject private var quickAction: QuickActionRouter
    @StateObject private var exportManager = BackgroundExportManager.shared
    @State private var showShareSheet = false
    @State private var shareURL: URL?
    @State private var showError = false
    @State private var errorMessage = ""
    @State private var showTrustToast = false
    @State private var completedExport: ExportTask?
    @State private var showExportReceipt = false
    @State private var failedExport: ExportTask?
    @State private var showFailedExportSheet = false
    @State private var scrollOffset: CGFloat = 0
    
    var activeExports: [ExportTask] {
        exportManager.exports.filter { $0.jobId == jobId && ($0.state == .queued || $0.state == .preparing || $0.state == .downloading) }
    }
    
    /// Recent exports (all states) for history + trust; tap → share when ready
    var recentExports: [ExportTask] {
        let allExports = exportManager.getAllExportsForJob(jobId: jobId)
        return Array(allExports.prefix(10))
    }
    
    private var scrollContent: some View {
        VStack(spacing: RMTheme.Spacing.sectionSpacing) {
            RMIntegritySurface(jobId: jobId, scrollOffset: scrollOffset)
                .padding(.horizontal, RMTheme.Spacing.pagePadding)
            
            generateButtonsSection
            exportQueueSection
            recentExportsSection
            lastExportSection
        }
        .padding(.vertical, RMTheme.Spacing.lg)
    }
    
    private var generateButtonsSection: some View {
        VStack(spacing: RMTheme.Spacing.md) {
            ExportCard(
                title: "Risk Snapshot Report",
                description: "Complete job documentation with hazards, controls, and evidence",
                icon: "doc.text.fill",
                action: { await generateExport(type: .pdf) },
                isGenerating: isGenerating(.pdf)
            )
            ExportCard(
                title: "Proof Pack",
                description: "ZIP archive with all PDFs, evidence, and verification",
                icon: "archivebox.fill",
                action: { await generateExport(type: .proofPack) },
                isGenerating: isGenerating(.proofPack)
            )
        }
        .padding(.horizontal, RMTheme.Spacing.pagePadding)
    }
    
    @ViewBuilder
    private var exportQueueSection: some View {
        if !activeExports.isEmpty {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                Text("Export Queue")
                    .rmSectionHeader()
                    .padding(.horizontal, RMTheme.Spacing.pagePadding)
                
                ForEach(activeExports) { export in
                    ExportStatusCard(export: export)
                        .padding(.horizontal, RMTheme.Spacing.pagePadding)
                }
            }
        }
    }
    
    @ViewBuilder
    private var recentExportsSection: some View {
        VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
            Text("Recent Exports")
                .rmSectionHeader()
                .padding(.horizontal, RMTheme.Spacing.pagePadding)
            
            if recentExports.isEmpty {
                Text("Proof Packs and PDFs will appear here after you generate them.")
                    .font(RMTheme.Typography.bodySmall)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                    .padding(.horizontal, RMTheme.Spacing.pagePadding)
                    .padding(.vertical, RMTheme.Spacing.md)
            } else {
                ForEach(recentExports) { export in
                    RecentExportCard(
                        export: export,
                        onView: {
                            if case .ready = export.state, let url = export.fileURL {
                                shareURL = url
                                showShareSheet = true
                            }
                        },
                        onFailed: {
                            failedExport = export
                            showFailedExportSheet = true
                        }
                    )
                    .padding(.horizontal, RMTheme.Spacing.pagePadding)
                }
            }
        }
    }
    
    @ViewBuilder
    private var lastExportSection: some View {
        if let lastPDF = exportManager.getLastExport(jobId: jobId, type: .pdf) {
            LastExportCard(export: lastPDF, onView: {
                shareURL = lastPDF.fileURL
                showShareSheet = true
            })
            .padding(.horizontal, RMTheme.Spacing.pagePadding)
        }
    }
    
    var body: some View {
        ScrollView(showsIndicators: false) {
            scrollContent
                .background(
                    GeometryReader { g in
                        Color.clear.preference(
                            key: ScrollOffsetPreferenceKey.self,
                            value: g.frame(in: .named("exportsScroll")).minY
                        )
                    }
                )
        }
        .coordinateSpace(name: "exportsScroll")
        .onPreferenceChange(ScrollOffsetPreferenceKey.self) { value in
            scrollOffset = value
        }
        .trustToast(
            message: "Ledger recorded",
            icon: "checkmark.circle.fill",
            isPresented: $showTrustToast
        )
        .sheet(isPresented: $showShareSheet) {
            if let shareURL = shareURL {
                ShareSheet(items: [shareURL])
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
        .sheet(isPresented: $showFailedExportSheet) {
            if let export = failedExport {
                FailedExportSheet(
                    export: export,
                    onRetry: {
                        showFailedExportSheet = false
                        Task {
                            await generateExport(type: export.type)
                        }
                    },
                    onCopyID: {
                        UIPasteboard.general.string = export.id
                        ToastCenter.shared.show("Export ID Copied", systemImage: "doc.on.doc", style: .success)
                    },
                    onAddEvidence: {
                        showFailedExportSheet = false
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                            quickAction.presentEvidence(jobId: jobId)
                        }
                    }
                )
                .presentationDetents([.medium])
            }
        }
        .onAppear {
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
        }
    }
    
    private func checkForCompletedExport() {
        if let export = exportManager.exports.first(where: { $0.jobId == jobId && $0.state == .ready && $0.initiatedFromForeground && $0.fileURL != nil }) {
            completedExport = export
            showExportReceipt = true
            showTrustToast = true
        }
    }
    
    private func isGenerating(_ type: ExportType) -> Bool {
        activeExports.contains { $0.type == type }
    }
    
    private func generateExport(type: ExportType) async {
        do {
            try await exportManager.export(
                jobId: jobId,
                type: type,
                initiatedFromForeground: true
            )
        } catch {
            errorMessage = ExportErrorMessages.friendlyMessage(for: error)
            showError = true
        }
    }
}
```

---

## CHUNK 3: Shared row/components/helpers (same file)

### Evidence: UploadStatusCard (lines 1957–2077)

```swift
struct UploadStatusCard: View {
    let upload: UploadTask
    @StateObject private var uploadManager = BackgroundUploadManager.shared
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                HStack {
                    Image(systemName: iconName)
                        .foregroundColor(iconColor)
                        .font(.system(size: 16))
                    
                    Text(upload.fileName)
                        .font(RMTheme.Typography.bodySmallBold)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    
                    if let cat = upload.category {
                        CategoryBadge(category: cat)
                    }
                    
                    Spacer()
                    
                    if case .failed = upload.state {
                        Button {
                            Haptics.tap()
                            Task {
                                do {
                                    try await uploadManager.retryUpload(upload)
                                } catch {
                                    ToastCenter.shared.show(
                                        error.localizedDescription,
                                        systemImage: "exclamationmark.triangle",
                                        style: .error
                                    )
                                }
                            }
                        } label: {
                            Text("Retry")
                                .font(RMTheme.Typography.captionBold)
                                .foregroundColor(RMTheme.Colors.accent)
                        }
                    }
                }
                
                if case .uploading = upload.state {
                    GeometryReader { geometry in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 4)
                                .fill(RMTheme.Colors.inputFill)
                                .frame(height: 4)
                            
                            RoundedRectangle(cornerRadius: 4)
                                .fill(RMTheme.Colors.accent)
                                .frame(width: geometry.size.width * upload.progress, height: 4)
                        }
                    }
                    .frame(height: 4)
                }
                
                Text(statusText)
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(statusColor)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture {
            if case .failed = upload.state {
                Haptics.tap()
                Task {
                    do {
                        try await uploadManager.retryUpload(upload)
                    } catch {
                        ToastCenter.shared.show(
                            error.localizedDescription,
                            systemImage: "exclamationmark.triangle",
                            style: .error
                        )
                    }
                }
            }
        }
    }
    
    private var iconName: String {
        switch upload.state {
        case .queued: return "clock.fill"
        case .uploading: return "arrow.up.circle.fill"
        case .synced: return "checkmark.circle.fill"
        case .failed: return "exclamationmark.triangle.fill"
        }
    }
    
    private var iconColor: Color {
        switch upload.state {
        case .queued: return RMTheme.Colors.textTertiary
        case .uploading: return RMTheme.Colors.accent
        case .synced: return RMTheme.Colors.success
        case .failed: return RMTheme.Colors.error
        }
    }
    
    private var statusColor: Color {
        switch upload.state {
        case .queued, .uploading: return RMTheme.Colors.textSecondary
        case .synced: return RMTheme.Colors.success
        case .failed: return RMTheme.Colors.error
        }
    }
    
    private var statusText: String {
        switch upload.state {
        case .queued:
            return "Queued"
        case .uploading:
            return "Uploading… \(Int(upload.progress * 100))%"
        case .synced:
            return "Uploaded"
        case .failed:
            return "Failed — Tap to retry"
        }
    }
}
```

### EvidenceItem model (lines 2080–2125)

```swift
struct EvidenceItem: Identifiable, Codable {
    let id: String
    let type: String
    let fileName: String
    let uploadedAt: Date
    let category: String?
    
    enum CodingKeys: String, CodingKey {
        case id
        case type
        case fileName = "file_name"
        case uploadedAt = "uploaded_at"
        case createdAt = "created_at"
        case category
        case phase
    }
    
    init(id: String, type: String, fileName: String, uploadedAt: Date, category: String? = nil) {
        self.id = id
        self.type = type
        self.fileName = fileName
        self.uploadedAt = uploadedAt
        self.category = category
    }
    
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        type = try c.decode(String.self, forKey: .type)
        fileName = try c.decode(String.self, forKey: .fileName)
        uploadedAt = try c.decodeIfPresent(Date.self, forKey: .uploadedAt)
            ?? c.decode(Date.self, forKey: .createdAt)
        category = try c.decodeIfPresent(String.self, forKey: .category)
            ?? c.decodeIfPresent(String.self, forKey: .phase)
    }
    
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(type, forKey: .type)
        try c.encode(fileName, forKey: .fileName)
        try c.encode(uploadedAt, forKey: .uploadedAt)
        try c.encodeIfPresent(category, forKey: .category)
    }
}
```

### EvidenceCard (lines 2127–2224)

```swift
struct EvidenceCard: View {
    let jobId: String
    let item: EvidenceItem
    var onCategoryChanged: (() async -> Void)?
    @State private var showCategoryPicker = false
    @State private var isUpdating = false

    var body: some View {
        RMGlassCard {
            HStack(spacing: RMTheme.Spacing.md) {
                Image(systemName: item.type == "photo" ? "photo.fill" : "doc.fill")
                    .foregroundColor(RMTheme.Colors.accent)
                    .font(.system(size: 24))

                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: RMTheme.Spacing.sm) {
                        Text(item.fileName)
                            .font(RMTheme.Typography.bodySmallBold)
                            .foregroundColor(RMTheme.Colors.textPrimary)
                        if item.type == "photo" {
                            categoryBadgeView
                        }
                    }
                    Text(formatDate(item.uploadedAt))
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                }

                Spacer()
                if item.type == "photo", onCategoryChanged != nil {
                    Button {
                        Haptics.tap()
                        showCategoryPicker = true
                    } label: {
                        Image(systemName: "pencil.circle.fill")
                            .font(.system(size: 22))
                            .foregroundColor(RMTheme.Colors.accent.opacity(0.9))
                    }
                    .disabled(isUpdating)
                }
            }
        }
        .confirmationDialog("Change photo category", isPresented: $showCategoryPicker, titleVisibility: .visible) {
            ForEach([EvidencePhase.before, .during, .after], id: \.self) { phase in
                Button(phase.displayName) {
                    Task { await updateCategory(phase.rawValue) }
                }
            }
            Button("Cancel", role: .cancel) {
                showCategoryPicker = false
            }
        } message: {
            Text("When was this photo taken relative to the job?")
        }
    }

    @ViewBuilder
    private var categoryBadgeView: some View {
        let category = item.category ?? "during"
        if onCategoryChanged != nil {
            Button {
                Haptics.tap()
                showCategoryPicker = true
            } label: {
                CategoryBadge(category: category)
            }
            .buttonStyle(.plain)
            .disabled(isUpdating)
        } else {
            CategoryBadge(category: category)
        }
    }

    private func updateCategory(_ category: String) async {
        showCategoryPicker = false
        isUpdating = true
        defer { isUpdating = false }
        do {
            try await APIClient.shared.updateDocumentCategory(jobId: jobId, docId: item.id, category: category)
            ToastCenter.shared.show("Category updated", systemImage: "checkmark.circle.fill", style: .success)
            await onCategoryChanged?()
        } catch {
            ToastCenter.shared.show(
                error.localizedDescription,
                systemImage: "exclamationmark.triangle",
                style: .error
            )
        }
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}
```

### CategoryBadge (lines 2226–2255)

```swift
/// Category badge for Before/During/After
struct CategoryBadge: View {
    let category: String
    
    private var displayName: String {
        switch category.lowercased() {
        case "before": return "Before"
        case "after": return "After"
        default: return "During"
        }
    }
    
    private var badgeColor: Color {
        switch category.lowercased() {
        case "before": return .blue
        case "after": return .green
        default: return .orange
        }
    }
    
    var body: some View {
        Text(displayName.uppercased())
            .font(.caption2)
            .fontWeight(.bold)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(badgeColor.opacity(0.2))
            .foregroundColor(badgeColor)
            .cornerRadius(4)
    }
}
```

### ExportStatusCard (lines 2486–2557)

```swift
struct ExportStatusCard: View {
    let export: ExportTask
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                HStack {
                    Image(systemName: iconName)
                        .foregroundColor(iconColor)
                        .font(.system(size: 16))
                    
                    Text(export.type.displayName)
                        .font(RMTheme.Typography.bodySmallBold)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    
                    Spacer()
                }
                
                if case .preparing = export.state {
                    ProgressView()
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else if case .downloading = export.state {
                    GeometryReader { geometry in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 4)
                                .fill(RMTheme.Colors.inputFill)
                                .frame(height: 4)
                            
                            RoundedRectangle(cornerRadius: 4)
                                .fill(RMTheme.Colors.accent)
                                .frame(width: geometry.size.width * export.progress, height: 4)
                        }
                    }
                    .frame(height: 4)
                }
                
                Text(statusText)
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(RMTheme.Colors.textSecondary)
            }
        }
    }
    
    private var iconName: String {
        switch export.state {
        case .queued: return "clock.fill"
        case .preparing: return "gearshape.fill"
        case .downloading: return "arrow.down.circle.fill"
        case .ready: return "checkmark.circle.fill"
        case .failed: return "exclamationmark.triangle.fill"
        }
    }
    
    private var iconColor: Color {
        switch export.state {
        case .queued: return RMTheme.Colors.textTertiary
        case .preparing, .downloading: return RMTheme.Colors.accent
        case .ready: return RMTheme.Colors.success
        case .failed: return RMTheme.Colors.error
        }
    }
    
    private var statusText: String {
        switch export.state {
        case .queued: return "Queued"
        case .preparing: return "Preparing..."
        case .downloading: return "Downloading... \(Int(export.progress * 100))%"
        case .ready: return "Ready"
        case .failed(let error): return "Failed: \(error)"
        }
    }
}
```

### RecentExportCard (lines 2559–2644)

```swift
struct RecentExportCard: View {
    let export: ExportTask
    let onView: () -> Void
    var onFailed: (() -> Void)? = nil
    
    private var statusLabel: String {
        switch export.state {
        case .queued: return "Queued"
        case .preparing: return "Processing"
        case .downloading: return "Downloading"
        case .ready: return "Ready"
        case .failed: return "Failed"
        }
    }
    
    private var statusColor: Color {
        switch export.state {
        case .queued, .preparing, .downloading: return RMTheme.Colors.textTertiary
        case .ready: return RMTheme.Colors.success
        case .failed: return RMTheme.Colors.error
        }
    }
    
    private var isFailed: Bool {
        if case .failed = export.state { return true }
        return false
    }
    
    private var isReady: Bool {
        if case .ready = export.state { return export.fileURL != nil }
        return false
    }
    
    var body: some View {
        RMGlassCard {
            HStack {
                Image(systemName: export.type == .pdf ? "doc.text.fill" : "archivebox.fill")
                    .foregroundColor(isFailed ? RMTheme.Colors.error : RMTheme.Colors.accent)
                    .font(.system(size: 20))
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(export.type.displayName)
                        .font(RMTheme.Typography.bodySmallBold)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    
                    HStack(spacing: RMTheme.Spacing.sm) {
                        Text(formatDate(export.createdAt))
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.textSecondary)
                        Text("•")
                            .foregroundColor(RMTheme.Colors.textTertiary)
                        Text(statusLabel)
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(statusColor)
                    }
                }
                
                Spacer()
                
                if isReady {
                    Button {
                        onView()
                    } label: {
                        Text("View")
                            .font(RMTheme.Typography.bodySmallBold)
                            .foregroundColor(RMTheme.Colors.accent)
                    }
                } else if isFailed {
                    Button {
                        Haptics.tap()
                        onFailed?()
                    } label: {
                        Text("Details")
                            .font(RMTheme.Typography.bodySmallBold)
                            .foregroundColor(RMTheme.Colors.error)
                    }
                }
            }
        }
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}
```

### LastExportCard (lines 2647–2691)

```swift
struct LastExportCard: View {
    let export: LastExport
    let onView: () -> Void
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                HStack {
                    Image(systemName: "clock.arrow.circlepath")
                        .foregroundColor(RMTheme.Colors.accent)
                        .font(.system(size: 16))
                    
                    Text("Last \(export.type.displayName)")
                        .rmSectionHeader()
                    
                    Spacer()
                }
                
                Text("Generated \(formatDate(export.generatedAt))")
                    .font(RMTheme.Typography.bodySmall)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                
                Button {
                    onView()
                } label: {
                    Text("View Last Export")
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
    
    private func formatDate(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}
```

### FailedExportSheet (lines 2694–2818)

```swift
/// Sheet shown when tapping a failed export - shows failure reason + smart CTAs (Add Evidence, Retry, Contact Support).
struct FailedExportSheet: View {
    let export: ExportTask
    let onRetry: () -> Void
    let onCopyID: () -> Void
    var onAddEvidence: (() -> Void)? = nil
    @Environment(\.dismiss) private var dismiss
    
    private var errorReason: String {
        if case .failed(let reason) = export.state {
            return reason
        }
        return "Unknown error"
    }
    
    private var showAddEvidenceCTA: Bool {
        guard onAddEvidence != nil else { return false }
        let lower = errorReason.lowercased()
        return lower.contains("evidence") || lower.contains("missing") || lower.contains("upload")
    }
    
    var body: some View {
        NavigationStack {
            VStack(spacing: RMTheme.Spacing.lg) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 48))
                    .foregroundColor(RMTheme.Colors.error)
                    .padding(.top, RMTheme.Spacing.xl)
                
                Text("Export Failed")
                    .font(RMTheme.Typography.title)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                
                Text(errorReason)
                    .font(RMTheme.Typography.bodySmall)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, RMTheme.Spacing.lg)
                
                Spacer()
                
                VStack(spacing: RMTheme.Spacing.md) {
                    if showAddEvidenceCTA, let onAddEvidence = onAddEvidence {
                        Button {
                            Haptics.impact(.medium)
                            dismiss()
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                                onAddEvidence()
                            }
                        } label: {
                            HStack {
                                Image(systemName: "camera.fill")
                                Text("Add Evidence")
                                    .font(RMTheme.Typography.bodyBold)
                            }
                            .foregroundColor(.black)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, RMTheme.Spacing.md)
                            .background(RMTheme.Colors.accent)
                            .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
                        }
                    }
                    
                    Button {
                        Haptics.impact(.medium)
                        onRetry()
                    } label: {
                        HStack {
                            Image(systemName: "arrow.clockwise")
                            Text("Try Again")
                                .font(RMTheme.Typography.bodyBold)
                        }
                        .foregroundColor(.black)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, RMTheme.Spacing.md)
                        .background(showAddEvidenceCTA ? RMTheme.Colors.accent.opacity(0.2) : RMTheme.Colors.accent)
                        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
                    }
                    
                    Button {
                        Haptics.tap()
                        onCopyID()
                    } label: {
                        Label("Copy Export ID", systemImage: "doc.on.doc")
                            .font(RMTheme.Typography.bodySmall)
                            .foregroundColor(RMTheme.Colors.accent)
                    }
                    
                    Button {
                        Haptics.tap()
                        onCopyID()
                        let subject = "Export Failed"
                        let body = "Export ID: \(export.id)"
                        let encoded = "mailto:support@riskmate.dev?subject=\(subject.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? subject)&body=\(body.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? body)"
                        if let url = URL(string: encoded) {
                            UIApplication.shared.open(url)
                        }
                    } label: {
                        Label("Contact Support", systemImage: "envelope")
                            .font(RMTheme.Typography.bodySmall)
                            .foregroundColor(RMTheme.Colors.textSecondary)
                    }
                }
                .padding(.horizontal, RMTheme.Spacing.pagePadding)
                .padding(.bottom, RMTheme.Spacing.xl)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(RMTheme.Colors.background)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}
```

### ExportCard (lines 2820–2881)

```swift
struct ExportCard: View {
    let title: String
    let description: String
    let icon: String
    let action: () async -> Void
    let isGenerating: Bool
    var disabled: Bool = false
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                HStack {
                    Image(systemName: icon)
                        .foregroundColor(disabled ? RMTheme.Colors.textTertiary : RMTheme.Colors.accent)
                        .font(.system(size: 24))
                    
                    Text(title)
                        .rmSectionHeader()
                        .foregroundColor(disabled ? RMTheme.Colors.textTertiary : RMTheme.Colors.textPrimary)
                    
                    Spacer()
                }
                
                Text(description)
                    .font(RMTheme.Typography.bodySmall)
                    .foregroundColor(disabled ? RMTheme.Colors.textTertiary : RMTheme.Colors.textSecondary)
                
                Button {
                    Task {
                        await action()
                    }
                } label: {
                    if isGenerating {
                        HStack {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .black))
                            Text("Generating...")
                                .font(RMTheme.Typography.bodySmallBold)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, RMTheme.Spacing.sm)
                        .background(RMTheme.Colors.accent.opacity(0.7))
                        .foregroundColor(.black)
                        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
                    } else {
                        Text("Generate")
                            .font(RMTheme.Typography.bodySmallBold)
                            .foregroundColor(.black)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, RMTheme.Spacing.sm)
                            .background(disabled ? RMTheme.Colors.inputFill : RMTheme.Colors.accent)
                            .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
                    }
                }
                .disabled(isGenerating || disabled)
            }
        }
        .opacity(disabled ? 0.8 : 1)
    }
}
```

---

## CHUNK 4: View model / state / manager refs (local to these tabs)

**EvidenceTab**
- `BackgroundUploadManager.shared` (uploads, retryUpload)
- `APIClient.shared.getEvidence(jobId:)`
- `OfflineCache.shared.cacheEvidence` / `getCachedEvidence`
- State: `evidence`, `isLoading`, `showImagePicker`

**ExportsTab**
- `BackgroundExportManager.shared` (exports, getAllExportsForJob, getLastExport, export(jobId:type:initiatedFromForeground:))
- `QuickActionRouter` (presentEvidence)
- State: `showShareSheet`, `shareURL`, `showError`, `errorMessage`, `showTrustToast`, `completedExport`, `showExportReceipt`, `failedExport`, `showFailedExportSheet`, `scrollOffset`
- Helpers: `activeExports`, `recentExports`, `checkForCompletedExport()`, `isGenerating(_:)`, `generateExport(type:)`

**UploadStatusCard**
- `BackgroundUploadManager.shared.retryUpload(upload)`

**EvidenceCard**
- `APIClient.shared.updateDocumentCategory(jobId:docId:category:)`
- `EvidencePhase` (from RMEvidenceCapture)

No separate view model types; state and manager refs are as above.
