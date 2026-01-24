import SwiftUI
import PDFKit
import UserNotifications

/// Job Detail screen with tabs: Overview, Hazards, Controls, Evidence, Exports
struct JobDetailView: View {
    let jobId: String
    @State private var selectedTab: JobDetailTab = .overview
    @State private var job: Job?
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var showPDFViewer = false
    @State private var pdfURL: URL?
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var quickAction: QuickActionRouter
    
    var body: some View {
        RMBackground()
            .overlay {
                if isLoading {
                    VStack(spacing: RMTheme.Spacing.lg) {
                        RMSkeletonCard()
                        RMSkeletonList(count: 3)
                    }
                    .padding(RMTheme.Spacing.pagePadding)
                } else if let errorMessage = errorMessage {
                    // Error state - show error with retry
                    RMEmptyState(
                        icon: "exclamationmark.triangle.fill",
                        title: "Failed to Load Job",
                        message: errorMessage,
                        action: RMEmptyStateAction(
                            title: "Retry",
                            action: {
                                Task {
                                    await loadJob()
                                }
                            }
                        )
                    )
                    .padding(RMTheme.Spacing.pagePadding)
                } else if let job = job {
                    VStack(spacing: 0) {
                        // Read-only banner for auditors
                        if AuditorMode.isEnabled {
                            ReadOnlyBanner()
                                .padding(.horizontal, RMTheme.Spacing.pagePadding)
                                .padding(.top, RMTheme.Spacing.md)
                        }
                        
                        // Prominent "Add Evidence" CTA (evidence-first hierarchy) - hidden for auditors
                        if !AuditorMode.isEnabled {
                            Button {
                                quickAction.presentEvidence(jobId: job.id)
                            } label: {
                                HStack(spacing: RMTheme.Spacing.sm) {
                                    Image(systemName: "camera.fill")
                                        .font(.system(size: 16, weight: .semibold))
                                    Text("Add Evidence")
                                        .font(RMTheme.Typography.bodyBold)
                                    Spacer()
                                    Image(systemName: "chevron.right")
                                        .font(.system(size: 14, weight: .medium))
                                        .opacity(0.6)
                                }
                                .foregroundColor(RMTheme.Colors.textPrimary)
                                .padding(RMTheme.Spacing.md)
                                .frame(maxWidth: .infinity)
                                .background(RMTheme.Colors.accent.opacity(0.15))
                                .overlay {
                                    RoundedRectangle(cornerRadius: 12)
                                        .stroke(RMTheme.Colors.accent.opacity(0.3), lineWidth: 1)
                                }
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                            }
                            .padding(.horizontal, RMTheme.Spacing.pagePadding)
                            .padding(.vertical, RMTheme.Spacing.sm)
                            .background(RMTheme.Colors.background)
                        }
                        
                        // Tab Picker
                        Picker("Tab", selection: $selectedTab) {
                            ForEach(JobDetailTab.allCases, id: \.self) { tab in
                                Text(tab.title).tag(tab)
                            }
                        }
                        .pickerStyle(.segmented)
                        .padding(.horizontal, RMTheme.Spacing.pagePadding)
                        .padding(.bottom, RMTheme.Spacing.sm)
                        .background(RMTheme.Colors.background)
                        
                        // Tab Content
                        TabView(selection: $selectedTab) {
                            OverviewTab(job: job)
                                .tag(JobDetailTab.overview)
                            
                            HazardsTab(jobId: jobId)
                                .tag(JobDetailTab.hazards)
                            
                            ControlsTab(jobId: jobId)
                                .tag(JobDetailTab.controls)
                            
                            EvidenceTab(jobId: jobId)
                                .tag(JobDetailTab.evidence)
                            
                            ExportsTab(jobId: jobId)
                            .tag(JobDetailTab.exports)
                        }
                        .tabViewStyle(.page(indexDisplayMode: .never))
                    }
                } else {
                    RMEmptyState(
                        icon: "exclamationmark.triangle",
                        title: "Job Not Found",
                        message: "This job could not be loaded"
                    )
                }
            }
            .rmNavigationBar(title: job?.clientName ?? "Job Details")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: RMTheme.Spacing.sm) {
                        // Evidence Requirements Badge
                        if job != nil {
                            RMEvidenceRequirementsBadge(
                                required: 5, // TODO: Get from job/API
                                uploaded: 2, // TODO: Get from evidence count
                                onTap: {
                                    selectedTab = .evidence
                                }
                            )
                            .id(job?.id) // Use job.id to satisfy compiler
                        }
                        
                        Menu {
                            Button {
                                // TODO: Share job
                            } label: {
                                Label("Share", systemImage: "square.and.arrow.up")
                            }
                            
                            Button(role: .destructive) {
                                // TODO: Delete job
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        } label: {
                            Image(systemName: "ellipsis.circle")
                                .foregroundColor(RMTheme.Colors.textSecondary)
                        }
                    }
                }
            }
            .sheet(isPresented: $showPDFViewer) {
                if let pdfURL = pdfURL {
                    RMPDFViewerScreen(url: pdfURL)
                }
            }
            .onAppear {
                // Request notification permission for export completion
                UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
            }
            .task(id: jobId) { // Use task(id:) to prevent re-fetch on unrelated re-renders
                await loadJob()
            }
    }
    
    private func loadJob() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        
        // Track job opened
        Analytics.shared.trackJobOpened(jobId: jobId)
        
        do {
            job = try await APIClient.shared.getJob(jobId)
            errorMessage = nil // Clear any previous error
        } catch {
            let errorDesc = error.localizedDescription
            print("[JobDetailView] ❌ Failed to load job: \(errorDesc)")
            errorMessage = errorDesc
            job = nil // Clear job on error - never show stale data
        }
    }
}

// MARK: - Tabs

enum JobDetailTab: String, CaseIterable {
    case overview
    case hazards
    case controls
    case evidence
    case exports
    
    var title: String {
        switch self {
        case .overview: return "Overview"
        case .hazards: return "Hazards"
        case .controls: return "Controls"
        case .evidence: return "Evidence"
        case .exports: return "Exports"
        }
    }
}

// MARK: - Overview Tab

struct OverviewTab: View {
    let job: Job
    @State private var recentReceipts: [ActionReceipt] = []
    
    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: RMTheme.Spacing.sectionSpacing) {
                // Risk Score Card
                RiskScoreCard(job: job)
                    .padding(.horizontal, RMTheme.Spacing.pagePadding)
                
                // Status & Info
                StatusInfoCard(job: job)
                    .padding(.horizontal, RMTheme.Spacing.pagePadding)
                
                // Readiness Score (if available - would need to fetch from API)
                // Note: Job model doesn't include readinessScore, would need separate API call
                
                // Proof Readiness Meter
                RMProofReadinessMeter(
                    readiness: ProofReadiness(
                        status: .needsEvidence, // Default until we fetch readiness data
                        evidenceCount: 2, // TODO: Get from evidence
                        evidenceRequired: 5,
                        evidenceStatus: .partial,
                        controlsCompleted: 3, // TODO: Get from controls
                        controlsRequired: 5,
                        controlsStatus: .partial,
                        needsAttestation: false
                    )
                )
                .padding(.horizontal, RMTheme.Spacing.pagePadding)
                
                // Recorded Strip
                RMRecordedStrip(
                    actor: "Alex",
                    role: "Safety Lead",
                    timestamp: Date().addingTimeInterval(-120)
                )
                .padding(.horizontal, RMTheme.Spacing.pagePadding)
                
                // Recent Receipts
                RMRecentReceipts(receipts: recentReceipts)
            }
            .padding(.vertical, RMTheme.Spacing.lg)
        }
        .task {
            await loadRecentReceipts()
        }
    }
    
    private func loadRecentReceipts() async {
        // Load from audit events for this job
        do {
            let events = try await APIClient.shared.getAuditEvents(timeRange: "7d", limit: 10)
            // Filter events for this job and map to ActionReceipt
            recentReceipts = events
                .filter { event in
                    event.metadata["job_id"] == job.id || event.metadata["jobId"] == job.id
                }
                .prefix(5)
                .map { event in
                    // Map event category to ActionType
                    let actionType: ActionType
                    if event.summary.lowercased().contains("evidence") || event.summary.lowercased().contains("upload") {
                        actionType = .evidenceUploaded
                    } else if event.summary.lowercased().contains("hazard") {
                        actionType = .hazardChanged
                    } else if event.summary.lowercased().contains("export") || event.summary.lowercased().contains("proof pack") {
                        actionType = .exportGenerated
                    } else if event.category == "GOVERNANCE" {
                        actionType = .roleChanged
                    } else {
                        actionType = .controlCompleted
                    }
                    
                    return ActionReceipt(
                        id: event.id,
                        type: actionType,
                        title: event.summary,
                        actor: event.actor,
                        role: nil,
                        timestamp: event.timestamp,
                        jobId: job.id,
                        jobTitle: job.clientName,
                        details: event.metadata
                    )
                }
        } catch {
            print("[OverviewTab] ❌ Failed to load recent receipts: \(error.localizedDescription)")
            recentReceipts = [] // Show empty - no demo data
        }
    }
}

struct RiskScoreCard: View {
    let job: Job
    
    private var riskScore: Int {
        if let score = job.riskScore {
            return score
        }
        // Compute from risk level if score not available
        switch job.riskLevel {
        case "Critical": return 95
        case "High": return 80
        case "Medium": return 55
        case "Low": return 30
        default: return 50
        }
    }
    
    private var riskLevel: String {
        job.riskLevel ?? "Unknown"
    }
    
    private var riskColor: Color {
        switch riskScore {
        case 0..<30: return RMTheme.Colors.categoryOperations
        case 30..<70: return RMTheme.Colors.categoryAccess
        default: return RMTheme.Colors.categoryGovernance
        }
    }
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                HStack {
                    Text("Risk Score")
                        .rmSectionHeader()
                    Spacer()
                    Text("\(riskScore)")
                        .font(RMTheme.Typography.title)
                        .foregroundColor(riskColor)
                        .contentTransition(.numericText())
                        .animation(.spring(response: 0.4, dampingFraction: 0.8), value: riskScore)
                }
                
                Text(riskLevel)
                    .font(RMTheme.Typography.bodySmall)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                
                // Risk level indicator with animation
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(RMTheme.Colors.inputFill)
                            .frame(height: 8)
                        
                        RoundedRectangle(cornerRadius: 4)
                            .fill(riskColor)
                            .frame(width: geometry.size.width * CGFloat(riskScore) / 100, height: 8)
                            .animation(.spring(response: 0.5, dampingFraction: 0.8), value: riskScore)
                    }
                }
                .frame(height: 8)
            }
        }
    }
}

struct StatusInfoCard: View {
    let job: Job
    
    var body: some View {
        RMGlassCard {
            VStack(spacing: RMTheme.Spacing.md) {
                InfoRow(label: "Status", value: job.status)
                InfoRow(label: "Client", value: job.clientName)
                InfoRow(label: "Location", value: job.location)
                // Note: dueDate and owner not in Job model - would need API extension
            }
        }
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }
}

struct InfoRow: View {
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

struct JobReadinessScoreCard: View {
    let score: Int
    
    var readinessColor: Color {
        if score >= 80 { return RMTheme.Colors.success }
        if score >= 60 { return RMTheme.Colors.warning }
        return RMTheme.Colors.error
    }
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                HStack {
                    Text("Readiness Score")
                        .rmSectionHeader()
                    Spacer()
                    Text("\(score)%")
                        .font(RMTheme.Typography.title)
                        .foregroundColor(readinessColor)
                }
                
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(RMTheme.Colors.inputFill)
                            .frame(height: 8)
                        
                        RoundedRectangle(cornerRadius: 4)
                            .fill(readinessColor)
                            .frame(width: geometry.size.width * CGFloat(score) / 100, height: 8)
                    }
                }
                .frame(height: 8)
            }
        }
    }
}

struct BlockersCard: View {
    let blockers: [String]
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(RMTheme.Colors.warning)
                    Text("Blockers")
                        .rmSectionHeader()
                }
                
                VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                    ForEach(blockers, id: \.self) { blocker in
                        HStack(alignment: .top, spacing: RMTheme.Spacing.sm) {
                            Circle()
                                .fill(RMTheme.Colors.warning)
                                .frame(width: 6, height: 6)
                                .padding(.top, 6)
                            
                            Text(blocker)
                                .font(RMTheme.Typography.bodySmall)
                                .foregroundColor(RMTheme.Colors.textPrimary)
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Hazards Tab

struct HazardsTab: View {
    let jobId: String
    @State private var hazards: [Hazard] = []
    @State private var isLoading = true
    @State private var didLoad = false // Deduplication gate
    
    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: RMTheme.Spacing.sectionSpacing) {
                if hazards.isEmpty {
                    RMEmptyState(
                        icon: "exclamationmark.triangle",
                        title: "No Hazards",
                        message: "Add hazards to assess job risks"
                    )
                    .padding(.top, RMTheme.Spacing.xxl)
                } else {
                    ForEach(hazards) { hazard in
                        HazardCard(hazard: hazard)
                            .padding(.horizontal, RMTheme.Spacing.pagePadding)
                    }
                }
            }
            .padding(.vertical, RMTheme.Spacing.lg)
        }
        .task(id: jobId) { // Use task(id:) to prevent re-fetch on unrelated re-renders
            guard !didLoad else { return } // Deduplication gate
            didLoad = true
            await loadHazards()
        }
    }
    
    private func loadHazards() async {
        isLoading = true
        defer { isLoading = false }
        
        do {
            hazards = try await APIClient.shared.getHazards(jobId: jobId)
        } catch {
            // On error, show empty (no demo data)
            print("[HazardsTab] ❌ Failed to load hazards: \(error.localizedDescription)")
            hazards = []
        }
    }
}

struct Hazard: Identifiable, Codable {
    let id: String
    let code: String
    let name: String
    let description: String
    let severity: String
    let status: String
    let createdAt: String
    let updatedAt: String
    
    enum CodingKeys: String, CodingKey {
        case id
        case code
        case name
        case description
        case severity
        case status
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct HazardCard: View {
    let hazard: Hazard
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                HStack {
                    Text(hazard.code)
                        .font(RMTheme.Typography.captionBold)
                        .foregroundColor(.white)
                        .padding(.horizontal, RMTheme.Spacing.sm)
                        .padding(.vertical, RMTheme.Spacing.xs)
                        .background(severityColor)
                        .clipShape(Capsule())
                    
                    Spacer()
                    
                    Text(hazard.severity)
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(severityColor)
                }
                
                Text(hazard.description)
                    .font(RMTheme.Typography.bodySmall)
                    .foregroundColor(RMTheme.Colors.textPrimary)
            }
        }
    }
    
    private var severityColor: Color {
        switch hazard.severity {
        case "Critical": return RMTheme.Colors.error
        case "High": return RMTheme.Colors.warning
        case "Medium": return RMTheme.Colors.info
        case "Low": return RMTheme.Colors.success
        default: return RMTheme.Colors.textTertiary
        }
    }
}

// MARK: - Controls Tab

struct ControlsTab: View {
    let jobId: String
    @State private var controls: [Control] = []
    @State private var isLoading = true
    @State private var didLoad = false // Deduplication gate
    
    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: RMTheme.Spacing.sectionSpacing) {
                if controls.isEmpty {
                    RMEmptyState(
                        icon: "checkmark.shield",
                        title: "No Controls",
                        message: "Controls will appear here based on selected hazards"
                    )
                    .padding(.top, RMTheme.Spacing.xxl)
                } else {
                    ForEach(controls) { control in
                        ControlCard(control: control, jobId: jobId)
                            .padding(.horizontal, RMTheme.Spacing.pagePadding)
                    }
                }
            }
            .padding(.vertical, RMTheme.Spacing.lg)
        }
        .task(id: jobId) { // Use task(id:) to prevent re-fetch on unrelated re-renders
            guard !didLoad else { return } // Deduplication gate
            didLoad = true
            await loadControls()
        }
    }
    
    private func loadControls() async {
        isLoading = true
        defer { isLoading = false }
        
        do {
            controls = try await APIClient.shared.getControls(jobId: jobId)
        } catch {
            // On error, show empty (no demo data)
            print("[ControlsTab] ❌ Failed to load controls: \(error.localizedDescription)")
            controls = []
        }
    }
}

struct Control: Identifiable, Codable {
    let id: String
    let title: String?
    let description: String
    let status: String
    let done: Bool?
    let isCompleted: Bool?
    let createdAt: String?
    let updatedAt: String?
    
    enum CodingKeys: String, CodingKey {
        case id
        case title
        case description
        case status
        case done
        case isCompleted
        case createdAt
        case updatedAt
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        description = try container.decodeIfPresent(String.self, forKey: .description) ?? ""
        status = try container.decodeIfPresent(String.self, forKey: .status) ?? "Pending"
        done = try container.decodeIfPresent(Bool.self, forKey: .done)
        isCompleted = try container.decodeIfPresent(Bool.self, forKey: .isCompleted)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encodeIfPresent(title, forKey: .title)
        try container.encode(description, forKey: .description)
        try container.encode(status, forKey: .status)
        try container.encodeIfPresent(done, forKey: .done)
        try container.encodeIfPresent(isCompleted, forKey: .isCompleted)
        try container.encodeIfPresent(createdAt, forKey: .createdAt)
        try container.encodeIfPresent(updatedAt, forKey: .updatedAt)
    }
}

struct ControlCard: View {
    let control: Control
    let jobId: String
    @StateObject private var cache = OfflineCache.shared
    @State private var showTrustReceipt = false
    @State private var trustAction: TrustAction?
    
    var body: some View {
        RMGlassCard {
            HStack(spacing: RMTheme.Spacing.md) {
                Button {
                    Task {
                        await toggleControl()
                    }
                } label: {
                    Image(systemName: statusIcon)
                        .foregroundColor(statusColor)
                        .font(.system(size: 20))
                }
                .accessibilityLabel(control.status == "Completed" ? "Control completed" : "Control not completed")
                .accessibilityAddTraits(.isButton)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(control.title ?? control.description)
                        .font(RMTheme.Typography.bodySmall)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    
                    if !control.description.isEmpty && control.title != nil {
                        Text(control.description)
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.textSecondary)
                    }
                    
                    if isPendingSync {
                        HStack(spacing: 4) {
                            Image(systemName: "clock.fill")
                                .font(.system(size: 10))
                            Text("Pending sync")
                                .font(RMTheme.Typography.captionSmall)
                        }
                        .foregroundColor(RMTheme.Colors.warning)
                    } else if control.status == "Blocked" {
                        HStack(spacing: 4) {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 10))
                            Text("Blocked")
                                .font(RMTheme.Typography.captionSmall)
                        }
                        .foregroundColor(RMTheme.Colors.error)
                    }
                }
                
                Spacer()
                
                Text(control.status)
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(statusColor)
            }
        }
        .trustReceipt(trustAction, isPresented: $showTrustReceipt)
    }
    
    private var statusIcon: String {
        switch control.status {
        case "Completed": return "checkmark.circle.fill"
        case "Blocked": return "xmark.circle.fill"
        default: return "circle"
        }
    }
    
    private var statusColor: Color {
        switch control.status {
        case "Completed": return RMTheme.Colors.success
        case "Pending": return RMTheme.Colors.warning
        case "Blocked": return RMTheme.Colors.error
        default: return RMTheme.Colors.textTertiary
        }
    }
    
    private var isPendingSync: Bool {
        return cache.queuedItems.contains { item in
            item.type == .control && (item.itemId == control.id || item.id == control.id)
        }
    }
    
    private func toggleControl() async {
        let isOffline = !ServerStatusManager.shared.isOnline
        let wasCompleted = control.status == "Completed"
        let newStatus = wasCompleted ? "Pending" : "Completed"
        
        // Create trust action
        trustAction = TrustAction(
            id: UUID().uuidString,
            type: .controlCompleted,
            title: "Control \(newStatus.lowercased())",
            actor: "Current User", // TODO: Get from session
            role: nil, // TODO: Get from session
            timestamp: Date(),
            jobId: jobId,
            jobTitle: nil,
            details: ["Control": control.description, "Status": newStatus],
            outcome: isOffline ? .pending : .allowed,
            reason: nil
        )
        
        showTrustReceipt = true
        
        // Track analytics
        Analytics.shared.trackControlCompleted(controlId: control.id, wasOffline: isOffline)
        
        // TODO: Call API to update control
    }
}

// MARK: - Evidence Tab

struct EvidenceTab: View {
    let jobId: String
    @StateObject private var uploadManager = BackgroundUploadManager.shared
    @State private var evidence: [EvidenceItem] = []
    @State private var isLoading = true
    @State private var showImagePicker = false
    
    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: RMTheme.Spacing.sectionSpacing) {
                // Upload button
                Button {
                    showImagePicker = true
                } label: {
                    HStack {
                        Image(systemName: "plus.circle.fill")
                        Text("Add Evidence")
                    }
                    .font(RMTheme.Typography.bodyBold)
                    .foregroundColor(.black)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, RMTheme.Spacing.md)
                    .background(RMTheme.Colors.accent)
                    .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
                }
                .padding(.horizontal, RMTheme.Spacing.pagePadding)
                
                // Active uploads
                let activeUploads = uploadManager.uploads.filter { $0.jobId == jobId }
                if !activeUploads.isEmpty {
                    VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                        Text("Uploading")
                            .rmSectionHeader()
                            .padding(.horizontal, RMTheme.Spacing.pagePadding)
                        
                        ForEach(activeUploads) { upload in
                            UploadStatusCard(upload: upload)
                                .padding(.horizontal, RMTheme.Spacing.pagePadding)
                        }
                    }
                }
                
                // Synced evidence
                if evidence.isEmpty && activeUploads.isEmpty {
                    RMEmptyState(
                        icon: "photo",
                        title: "No Evidence",
                        message: "Upload photos and documents to complete readiness"
                    )
                    .padding(.top, RMTheme.Spacing.xxl)
                } else {
                    ForEach(evidence) { item in
                        EvidenceCard(item: item)
                            .padding(.horizontal, RMTheme.Spacing.pagePadding)
                    }
                }
            }
            .padding(.vertical, RMTheme.Spacing.lg)
        }
        .sheet(isPresented: $showImagePicker) {
            RMPhotoPicker(jobId: jobId)
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
                    
                    Spacer()
                    
                    if case .failed = upload.state {
                        Button {
                            Task {
                                try? await uploadManager.retryUpload(upload)
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
                    .foregroundColor(RMTheme.Colors.textSecondary)
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
    
    private var statusText: String {
        switch upload.state {
        case .queued:
            return "Queued"
        case .uploading:
            return "Uploading... \(Int(upload.progress * 100))%"
        case .synced:
            return "Synced"
        case .failed(let error):
            return "Failed: \(error)"
        }
    }
}

struct EvidenceItem: Identifiable, Codable {
    let id: String
    let type: String
    let fileName: String
    let uploadedAt: Date
    
    enum CodingKeys: String, CodingKey {
        case id
        case type
        case fileName = "file_name"
        case uploadedAt = "uploaded_at"
    }
}

struct EvidenceCard: View {
    let item: EvidenceItem
    
    var body: some View {
        RMGlassCard {
            HStack(spacing: RMTheme.Spacing.md) {
                Image(systemName: item.type == "photo" ? "photo.fill" : "doc.fill")
                    .foregroundColor(RMTheme.Colors.accent)
                    .font(.system(size: 24))
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.fileName)
                        .font(RMTheme.Typography.bodySmallBold)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    
                    Text(formatDate(item.uploadedAt))
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                }
                
                Spacer()
            }
        }
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Exports Tab

struct ExportsTab: View {
    let jobId: String
    @StateObject private var exportManager = BackgroundExportManager.shared
    @State private var showShareSheet = false
    @State private var shareURL: URL?
    @State private var showError = false
    @State private var errorMessage = ""
    @State private var showTrustToast = false
    @State private var completedExport: ExportTask?
    @State private var showExportReceipt = false
    
    var activeExports: [ExportTask] {
        exportManager.exports.filter { $0.jobId == jobId && ($0.state == .queued || $0.state == .preparing || $0.state == .downloading) }
    }
    
    var recentExports: [ExportTask] {
        let allExports = exportManager.getAllExportsForJob(jobId: jobId)
        let readyExports = allExports.filter { $0.state == .ready }
        return Array(readyExports.prefix(5))
    }
    
    private var scrollContent: some View {
        VStack(spacing: RMTheme.Spacing.sectionSpacing) {
            // Integrity Surface
            RMIntegritySurface(jobId: jobId)
                .padding(.horizontal, RMTheme.Spacing.pagePadding)
            
            // Generate Buttons
            generateButtonsSection
            
            // Export Queue
            exportQueueSection
            
            // Recent Exports
            recentExportsSection
            
            // Last Export Quick Access
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
                action: {
                    await generateExport(type: .pdf)
                },
                isGenerating: isGenerating(.pdf)
            )
            
            ExportCard(
                title: "Proof Pack",
                description: "ZIP archive with all PDFs, evidence, and verification",
                icon: "archivebox.fill",
                action: {
                    await generateExport(type: .proofPack)
                },
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
        if !recentExports.isEmpty {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                Text("Recent Exports")
                    .rmSectionHeader()
                    .padding(.horizontal, RMTheme.Spacing.pagePadding)
                
                ForEach(recentExports) { export in
                    RecentExportCard(export: export, onView: {
                        if let url = export.fileURL {
                            shareURL = url
                            showShareSheet = true
                        }
                    })
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
        .onAppear {
            // Request notification permission for export completion
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
            errorMessage = error.localizedDescription
            showError = true
        }
    }
}

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

struct RecentExportCard: View {
    let export: ExportTask
    let onView: () -> Void
    
    var body: some View {
        RMGlassCard {
            HStack {
                Image(systemName: export.type == .pdf ? "doc.text.fill" : "archivebox.fill")
                    .foregroundColor(RMTheme.Colors.accent)
                    .font(.system(size: 20))
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(export.type.displayName)
                        .font(RMTheme.Typography.bodySmallBold)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    
                    Text(formatDate(export.createdAt))
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                }
                
                Spacer()
                
                Button {
                    onView()
                } label: {
                    Text("View")
                        .font(RMTheme.Typography.bodySmallBold)
                        .foregroundColor(RMTheme.Colors.accent)
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

// ShareSheet moved to Components/UIKit/ShareSheet.swift

struct ExportCard: View {
    let title: String
    let description: String
    let icon: String
    let action: () async -> Void
    let isGenerating: Bool
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                HStack {
                    Image(systemName: icon)
                        .foregroundColor(RMTheme.Colors.accent)
                        .font(.system(size: 24))
                    
                    Text(title)
                        .rmSectionHeader()
                    
                    Spacer()
                }
                
                Text(description)
                    .font(RMTheme.Typography.bodySmall)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                
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
                            .background(RMTheme.Colors.accent)
                            .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
                    }
                }
                .disabled(isGenerating)
            }
        }
    }
}

#Preview {
    NavigationStack {
        JobDetailView(jobId: "1")
    }
}
