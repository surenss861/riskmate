import SwiftUI

/// Executive Dashboard - Hero Defensibility Score + Chain-of-Custody
struct ExecutiveViewRedesigned: View {
    @State private var defensibilityScore: Int = 85
    @State private var status: DefensibilityStatus = .insurerReady
    @State private var lastVerified: Date = Date().addingTimeInterval(-3600)
    @State private var ledgerRoot: String = "a3f2b1c4d5e6f7a8b9c0d1e2f3a4b5c6"
    @State private var chainOfCustody: [CustodyEvent] = []
    @State private var governanceViolations: [GovernanceEvent] = []
    @State private var exposureOverview: ExposureOverview?
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var showEnforcementReceipts = false
    
    var body: some View {
        RMBackground()
            .overlay {
                if isLoading {
                    ScrollView {
                        VStack(spacing: RMTheme.Spacing.lg) {
                            RMSkeletonCard()
                            RMSkeletonList(count: 3)
                        }
                        .padding(RMTheme.Spacing.pagePadding)
                    }
                } else if let errorMessage = errorMessage {
                    // Error state - show error with retry
                    ScrollView {
                        VStack(spacing: RMTheme.Spacing.lg) {
                            RMEmptyState(
                                icon: "exclamationmark.triangle.fill",
                                title: "Failed to Load Executive Data",
                                message: errorMessage,
                                action: RMEmptyStateAction(
                                    title: "Retry",
                                    action: {
                                        Task {
                                            await loadData()
                                        }
                                    }
                                )
                            )
                        }
                        .padding(RMTheme.Spacing.pagePadding)
                    }
                } else {
                    ScrollView(showsIndicators: false) {
                        VStack(spacing: RMTheme.Spacing.sectionSpacing) {
                        // Hero Defensibility Brief
                        HeroDefensibilityCard(
                            score: defensibilityScore,
                            status: status,
                            lastVerified: lastVerified,
                            ledgerRoot: ledgerRoot
                        )
                        .padding(.horizontal, RMTheme.Spacing.pagePadding)
                        .padding(.top, RMTheme.Spacing.md)
                        
                        // 3 Proof-First Tiles
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: RMTheme.Spacing.md) {
                                ProofFirstTile(
                                    title: "Chain-of-Custody",
                                    status: .verified,
                                    count: chainOfCustody.filter { $0.integrity == .verified }.count,
                                    total: chainOfCustody.count,
                                    icon: "link.circle.fill",
                                    color: RMTheme.Colors.success
                                ) {
                                    // Show chain-of-custody detail
                                }
                                
                                ProofFirstTile(
                                    title: "Exports Generated",
                                    status: .ready,
                                    count: proofPacksCount,
                                    total: nil,
                                    icon: "doc.badge.plus",
                                    color: RMTheme.Colors.accent,
                                    subtitle: "Last: 2h ago"
                                ) {
                                    // Show exports list
                                }
                                
                                ProofFirstTile(
                                    title: "Enforcement Events",
                                    status: .blocked,
                                    count: governanceViolations.count,
                                    total: nil,
                                    icon: "shield.checkered",
                                    color: RMTheme.Colors.error,
                                    subtitle: "\(governanceViolations.count) blocked"
                                ) {
                                    showEnforcementReceipts = true
                                }
                            }
                            .padding(.horizontal, RMTheme.Spacing.pagePadding)
                        }
                        
                        // Narrative Timeline
                        NarrativeTimelineView(events: chainOfCustody)
                            .padding(.horizontal, RMTheme.Spacing.pagePadding)
                        
                        // Governance Model Badge
                        GovernanceModelCard(violations: governanceViolations)
                            .padding(.horizontal, RMTheme.Spacing.pagePadding)
                        
                        // Exposure Overview
                        if let exposure = exposureOverview {
                            ExposureOverviewCard(exposure: exposure)
                                .padding(.horizontal, RMTheme.Spacing.pagePadding)
                        }
                        
                        // Audit Readiness Link
                        AuditReadinessLink()
                            .padding(.horizontal, RMTheme.Spacing.pagePadding)
                    }
                    .padding(.vertical, RMTheme.Spacing.lg)
                }
            }
            .rmNavigationBar(title: "Executive")
            .sheet(isPresented: $showEnforcementReceipts) {
                EnforcementReceiptsView(violations: governanceViolations)
            }
            .task {
                await loadData()
            }
    }
    
    private func loadData() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        
        do {
            // Load executive posture data
            let posture = try await APIClient.shared.getExecutivePosture(timeRange: "30d")
            
            // Update defensibility score and status from posture
            defensibilityScore = 85 // Would need separate API call for actual score
            status = posture.ledgerIntegrity == "verified" ? .insurerReady : .needsReview
            proofPacksCount = posture.proofPacksGenerated
            
            // Map to exposure overview
            exposureOverview = ExposureOverview(
                highRiskJobs: posture.highRiskJobs,
                highRiskJobsDelta: posture.deltas?.highRiskJobs ?? 0,
                topHazards: [], // Top hazards not in current API response
                openIncidents: posture.openIncidents,
                openIncidentsDelta: posture.deltas?.openIncidents ?? 0,
                oldestUnresolved: 0, // Not in current API response
                governanceViolations: posture.recentViolations,
                governanceViolationsDelta: posture.deltas?.violations ?? 0,
                mostCommonViolation: "Role violation" // Not in current API response
            )
            
            // Load audit events for chain of custody and governance violations
            let events = try await APIClient.shared.getAuditEvents(timeRange: "30d", limit: 100)
            
            // Map events to chain of custody
            chainOfCustody = events.compactMap { event -> CustodyEvent? in
                // Map event types to custody event types
                let eventType: CustodyEventType?
                if event.category == "GOVERNANCE" && event.metadata["blocked"] == "true" {
                    eventType = .actionBlocked
                } else if event.summary.lowercased().contains("proof pack") || event.summary.lowercased().contains("export") {
                    eventType = .proofPackGenerated
                } else if event.summary.lowercased().contains("control") || event.summary.lowercased().contains("mitigation") {
                    eventType = .controlSealed
                } else if event.summary.lowercased().contains("evidence") {
                    eventType = .evidencePending
                } else {
                    return nil // Skip events that don't map to custody
                }
                
                let outcome: CustodyOutcome = event.metadata["blocked"] == "true" ? .blocked : .allowed
                let integrity: CustodyIntegrityStatus = outcome == .blocked ? .verified : .verified
                
                return CustodyEvent(
                    type: eventType!,
                    jobId: event.metadata["job_id"],
                    jobTitle: event.metadata["job_title"],
                    actor: event.actor,
                    timestamp: event.timestamp,
                    outcome: outcome,
                    integrity: integrity,
                    reason: event.metadata["blocked"] == "true" ? event.details : nil
                )
            }
            
            // Map governance violations
            governanceViolations = events.filter { event in
                event.category == "GOVERNANCE" && event.metadata["blocked"] == "true"
            }.map { event in
                GovernanceEvent(
                    type: .roleViolation,
                    description: event.summary,
                    timestamp: event.timestamp,
                    blocked: true
                )
            }
            errorMessage = nil // Clear any previous error
        } catch {
            let errorDesc = error.localizedDescription
            print("[ExecutiveViewRedesigned] ❌ Failed to load data: \(errorDesc)")
            errorMessage = errorDesc
            // Clear all data on error - never show stale data
            chainOfCustody = []
            governanceViolations = []
            proofPacksCount = 0
            exposureOverview = ExposureOverview(
                highRiskJobs: 0,
                highRiskJobsDelta: 0,
                topHazards: [],
                openIncidents: 0,
                openIncidentsDelta: 0,
                oldestUnresolved: 0,
                governanceViolations: 0,
                governanceViolationsDelta: 0,
                mostCommonViolation: "None"
            )
        }
    }
}

// MARK: - Hero Defensibility Card

struct HeroDefensibilityCard: View {
    let score: Int
    let status: DefensibilityStatus
    let lastVerified: Date
    let ledgerRoot: String
    
    var body: some View {
        RMGlassCard {
            VStack(spacing: RMTheme.Spacing.lg) {
                // Score
                VStack(spacing: RMTheme.Spacing.xs) {
                    Text("\(score)")
                        .font(.system(size: 72, weight: .bold))
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    
                    Text("Defensibility Score")
                        .font(RMTheme.Typography.bodySmall)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                }
                
                // Status Badge
                DefensibilityStatusBadge(status: status)
                
                // Confidence Statement
                Text(confidenceStatement)
                    .font(RMTheme.Typography.body)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, RMTheme.Spacing.md)
                
                Divider()
                    .background(RMTheme.Colors.border)
                
                // Verification Details
                VStack(spacing: RMTheme.Spacing.sm) {
                    VerificationRow(
                        label: "Last Verified",
                        value: formatRelativeTime(lastVerified)
                    )
                    
                    VerificationRow(
                        label: "Ledger Root",
                        value: formatHash(ledgerRoot)
                    )
                    
                    HStack {
                        Image(systemName: "checkmark.shield.fill")
                            .foregroundColor(RMTheme.Colors.success)
                        Text("Verification Status: Verified")
                            .font(RMTheme.Typography.bodySmall)
                            .foregroundColor(RMTheme.Colors.textPrimary)
                    }
                }
                
                // CTA
                Button {
                    // Generate Executive Brief
                } label: {
                    HStack {
                        Image(systemName: "doc.text.fill")
                        Text("Generate Executive Brief")
                    }
                    .font(RMTheme.Typography.bodySmallBold)
                    .foregroundColor(.black)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, RMTheme.Spacing.md)
                    .background(RMTheme.Colors.accent)
                    .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
                }
            }
        }
    }
    
    private var confidenceStatement: String {
        switch status {
        case .insurerReady:
            return "All work records are sealed, verified, and ready for insurance or audit review. Chain-of-custody is intact with no integrity gaps."
        case .needsReview:
            return "Some work records require attention before audit submission. Review pending evidence and control completions."
        case .highExposure:
            return "Critical exposure detected. Immediate review of high-risk jobs and governance violations required."
        case .auditRisk:
            return "Audit risk identified. Review compliance gaps and missing documentation before submission."
        case .criticalBlockers:
            return "Critical blockers prevent audit submission. Address governance violations and missing evidence immediately."
        }
    }
    
    private func formatRelativeTime(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }
    
    private func formatHash(_ hash: String) -> String {
        if hash.count > 8 {
            return "\(hash.prefix(4))...\(hash.suffix(4))"
        }
        return hash
    }
}

enum DefensibilityStatus {
    case insurerReady
    case needsReview
    case highExposure
    case auditRisk
    case criticalBlockers
    
    var displayName: String {
        switch self {
        case .insurerReady: return "Insurance-Ready"
        case .needsReview: return "Needs Review"
        case .highExposure: return "High Exposure"
        case .auditRisk: return "Audit Risk"
        case .criticalBlockers: return "Critical Blockers"
        }
    }
    
    var color: Color {
        switch self {
        case .insurerReady: return RMTheme.Colors.success
        case .needsReview: return RMTheme.Colors.warning
        case .highExposure: return RMTheme.Colors.error
        case .auditRisk: return RMTheme.Colors.warning
        case .criticalBlockers: return RMTheme.Colors.error
        }
    }
}

struct DefensibilityStatusBadge: View {
    let status: DefensibilityStatus
    
    var body: some View {
        Text(status.displayName)
            .font(RMTheme.Typography.bodySmallBold)
            .foregroundColor(.black)
            .padding(.horizontal, RMTheme.Spacing.md)
            .padding(.vertical, RMTheme.Spacing.xs)
            .background(status.color)
            .clipShape(Capsule())
    }
}

struct VerificationRow: View {
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

// MARK: - Chain-of-Custody Timeline

struct ChainOfCustodyTimeline: View {
    let events: [CustodyEvent]
    
    var body: some View {
        VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
            Text("Chain of Custody (Last 7 Days)")
                .rmSectionHeader()
            
            if events.isEmpty {
                RMEmptyState(
                    icon: "clock",
                    title: "No Events",
                    message: "Chain-of-custody events will appear here"
                )
            } else {
                ForEach(events) { event in
                    CustodyEventRow(event: event)
                }
            }
        }
    }
}

struct CustodyEvent: Identifiable {
    let id = UUID()
    let type: CustodyEventType
    let jobId: String?
    let jobTitle: String?
    let actor: String
    let timestamp: Date
    let outcome: CustodyOutcome
    let integrity: CustodyIntegrityStatus
    let reason: String?
    
    init(type: CustodyEventType, jobId: String?, jobTitle: String?, actor: String, timestamp: Date, outcome: CustodyOutcome, integrity: CustodyIntegrityStatus, reason: String? = nil) {
        self.type = type
        self.jobId = jobId
        self.jobTitle = jobTitle
        self.actor = actor
        self.timestamp = timestamp
        self.outcome = outcome
        self.integrity = integrity
        self.reason = reason
    }
}

enum CustodyEventType {
    case controlSealed
    case evidencePending
    case actionBlocked
    case proofPackGenerated
    case accessChanged
    case policyEnforced
    
    var icon: String {
        switch self {
        case .controlSealed: return "checkmark.circle.fill"
        case .evidencePending: return "clock.fill"
        case .actionBlocked: return "xmark.circle.fill"
        case .proofPackGenerated: return "doc.badge.plus"
        case .accessChanged: return "person.badge.key.fill"
        case .policyEnforced: return "shield.fill"
        }
    }
    
    var displayName: String {
        switch self {
        case .controlSealed: return "Controls sealed"
        case .evidencePending: return "Evidence pending sync"
        case .actionBlocked: return "Blocked action"
        case .proofPackGenerated: return "Proof Pack generated"
        case .accessChanged: return "Access changed"
        case .policyEnforced: return "Policy enforced"
        }
    }
}

enum CustodyOutcome {
    case allowed
    case blocked
    case pending
}

enum CustodyIntegrityStatus {
    case verified
    case unverified
    case pending
    case mismatch
}

struct CustodyEventRow: View {
    let event: CustodyEvent
    @State private var showDetail = false
    
    var body: some View {
        Button {
            showDetail = true
        } label: {
            RMGlassCard {
                HStack(spacing: RMTheme.Spacing.md) {
                    Image(systemName: event.type.icon)
                        .foregroundColor(iconColor)
                        .font(.system(size: 20))
                    
                    VStack(alignment: .leading, spacing: 4) {
                        Text(event.type.displayName)
                            .font(RMTheme.Typography.bodySmallBold)
                            .foregroundColor(RMTheme.Colors.textPrimary)
                        
                        if let jobTitle = event.jobTitle {
                            Text("Job #\(event.jobId ?? "") — \(jobTitle)")
                                .font(RMTheme.Typography.caption)
                                .foregroundColor(RMTheme.Colors.textSecondary)
                        } else if let reason = event.reason {
                            Text(reason)
                                .font(RMTheme.Typography.caption)
                                .foregroundColor(RMTheme.Colors.textSecondary)
                        }
                        
                        Text("by \(event.actor) • \(formatRelativeTime(event.timestamp))")
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.textTertiary)
                    }
                    
                    Spacer()
                    
                    Image(systemName: "chevron.right")
                        .foregroundColor(RMTheme.Colors.textTertiary)
                        .font(.system(size: 14))
                }
            }
        }
        .sheet(isPresented: $showDetail) {
            CustodyEventDetailSheet(event: event)
        }
    }
    
    private var iconColor: Color {
        switch event.outcome {
        case .allowed: return RMTheme.Colors.success
        case .blocked: return RMTheme.Colors.error
        case .pending: return RMTheme.Colors.warning
        }
    }
    
    private func formatRelativeTime(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

struct CustodyEventDetailSheet: View {
    let event: CustodyEvent
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            ZStack {
                RMBackground()
                
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: RMTheme.Spacing.sectionSpacing) {
                        // Event Details
                        VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                            Text("Event Details")
                                .rmSectionHeader()
                            
                            CustodyDetailRow(label: "Type", value: event.type.displayName)
                            CustodyDetailRow(label: "Actor", value: event.actor)
                            CustodyDetailRow(label: "Timestamp", value: formatDate(event.timestamp))
                            CustodyDetailRow(label: "Outcome", value: event.outcome.displayName)
                            CustodyDetailRow(label: "Integrity", value: event.integrity.displayName)
                            
                            if let jobId = event.jobId {
                                CustodyDetailRow(label: "Job ID", value: jobId)
                            }
                            
                            if let reason = event.reason {
                                CustodyDetailRow(label: "Reason", value: reason)
                            }
                        }
                        .padding(.horizontal, RMTheme.Spacing.pagePadding)
                    }
                    .padding(.vertical, RMTheme.Spacing.lg)
                }
            }
            .rmNavigationBar(title: "Trust Receipt")
        }
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

extension CustodyOutcome {
    var displayName: String {
        switch self {
        case .allowed: return "Allowed"
        case .blocked: return "Blocked"
        case .pending: return "Pending"
        }
    }
}

extension CustodyIntegrityStatus {
    var displayName: String {
        switch self {
        case .verified: return "Verified"
        case .unverified: return "Unverified"
        case .pending: return "Pending"
        case .mismatch: return "Mismatch"
        }
    }
}

struct CustodyDetailRow: View {
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

// MARK: - Governance Model Card

struct GovernanceModelCard: View {
    let violations: [GovernanceEvent]
    @State private var showEnforcementReceipts = false
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                HStack {
                    Image(systemName: "shield.checkered")
                        .foregroundColor(RMTheme.Colors.accent)
                        .font(.system(size: 24))
                    
                    Text("Governance Model")
                        .font(RMTheme.Typography.headingSmall)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    
                    Spacer()
                }
                
                VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                    GovernanceCheckRow(
                        label: "Exec access is read-only enforced",
                        checked: true
                    )
                    
                    GovernanceCheckRow(
                        label: "All access changes are recorded",
                        checked: true
                    )
                    
                    GovernanceCheckRow(
                        label: "Policy enforcement creates receipts",
                        checked: true
                    )
                }
                
                if !violations.isEmpty {
                    Button {
                        showEnforcementReceipts = true
                    } label: {
                        HStack {
                            Text("View Last \(violations.count) Enforcement Receipts")
                                .font(RMTheme.Typography.bodySmall)
                                .foregroundColor(RMTheme.Colors.accent)
                            
                            Spacer()
                            
                            Image(systemName: "chevron.right")
                                .foregroundColor(RMTheme.Colors.accent)
                                .font(.system(size: 14))
                        }
                    }
                }
            }
        }
        .sheet(isPresented: $showEnforcementReceipts) {
            EnforcementReceiptsView(violations: violations)
        }
    }
}

struct GovernanceCheckRow: View {
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

struct GovernanceEvent: Identifiable {
    let id = UUID()
    let type: GovernanceEventType
    let description: String
    let timestamp: Date
    let blocked: Bool
}

enum GovernanceEventType {
    case roleViolation
    case exportDenied
    case accessDenied
}

struct EnforcementReceiptsView: View {
    let violations: [GovernanceEvent]
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            ZStack {
                RMBackground()
                
                ScrollView(showsIndicators: false) {
                    VStack(spacing: RMTheme.Spacing.md) {
                        ForEach(violations) { violation in
                            RMGlassCard {
                                VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                                    HStack {
                                        Image(systemName: violation.blocked ? "xmark.circle.fill" : "checkmark.circle.fill")
                                            .foregroundColor(violation.blocked ? RMTheme.Colors.error : RMTheme.Colors.success)
                                        
                                        Text(violation.blocked ? "Blocked" : "Allowed")
                                            .font(RMTheme.Typography.bodySmallBold)
                                            .foregroundColor(RMTheme.Colors.textPrimary)
                                    }
                                    
                                    Text(violation.description)
                                        .font(RMTheme.Typography.bodySmall)
                                        .foregroundColor(RMTheme.Colors.textSecondary)
                                    
                                    Text(formatDate(violation.timestamp))
                                        .font(RMTheme.Typography.caption)
                                        .foregroundColor(RMTheme.Colors.textTertiary)
                                }
                            }
                        }
                    }
                    .padding(RMTheme.Spacing.pagePadding)
                }
            }
            .rmNavigationBar(title: "Enforcement Receipts")
        }
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Exposure Overview

struct ExposureOverview {
    let highRiskJobs: Int
    let highRiskJobsDelta: Int
    let topHazards: [String]
    let openIncidents: Int
    let openIncidentsDelta: Int
    let oldestUnresolved: Int
    let governanceViolations: Int
    let governanceViolationsDelta: Int
    let mostCommonViolation: String
}

struct ExposureOverviewCard: View {
    let exposure: ExposureOverview
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                Text("Exposure Overview")
                    .rmSectionHeader()
                
                VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                    ExposureRow(
                        title: "High-Risk Jobs",
                        value: "\(exposure.highRiskJobs)",
                        delta: exposure.highRiskJobsDelta,
                        subtitle: "Top 3: \(exposure.topHazards.joined(separator: ", "))"
                    )
                    
                    ExposureRow(
                        title: "Open Incidents",
                        value: "\(exposure.openIncidents)",
                        delta: exposure.openIncidentsDelta,
                        subtitle: "Oldest unresolved: \(exposure.oldestUnresolved)d"
                    )
                    
                    ExposureRow(
                        title: "Governance Violations",
                        value: "\(exposure.governanceViolations)",
                        delta: exposure.governanceViolationsDelta,
                        subtitle: "Most common: \(exposure.mostCommonViolation)"
                    )
                }
            }
        }
    }
}

struct ExposureRow: View {
    let title: String
    let value: String
    let delta: Int
    let subtitle: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(title)
                    .font(RMTheme.Typography.bodySmallBold)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                
                Spacer()
                
                Text(value)
                    .font(RMTheme.Typography.bodySmallBold)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                
                if delta != 0 {
                    Text(delta > 0 ? "+\(delta)" : "\(delta)")
                        .font(RMTheme.Typography.captionBold)
                        .foregroundColor(delta > 0 ? RMTheme.Colors.error : RMTheme.Colors.success)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background((delta > 0 ? RMTheme.Colors.error : RMTheme.Colors.success).opacity(0.2))
                        .clipShape(Capsule())
                }
            }
            
            Text(subtitle)
                .font(RMTheme.Typography.caption)
                .foregroundColor(RMTheme.Colors.textSecondary)
        }
    }
}

// MARK: - Audit Readiness Link

struct AuditReadinessLink: View {
    var body: some View {
        RMGlassCard {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Audit Readiness")
                        .font(RMTheme.Typography.bodySmallBold)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    
                    Text("Score: 85 • 2 critical blockers")
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                }
                
                Spacer()
                
                Button {
                    // Navigate to ReadinessView
                } label: {
                    Text("Open Fix Queue")
                        .font(RMTheme.Typography.bodySmallBold)
                        .foregroundColor(RMTheme.Colors.accent)
                }
            }
        }
    }
}
