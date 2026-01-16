import SwiftUI

/// Executive Dashboard - Defensibility Posture
struct ExecutiveView: View {
    @State private var postureData: ExecutivePostureResponse?
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var isExportingPDF = false
    @State private var isExportingJSON = false
    
    var body: some View {
        RMBackground()
            .overlay {
                if isLoading {
                    ScrollView {
                        VStack(spacing: RMTheme.Spacing.lg) {
                            RMSkeletonCard()
                            RMSkeletonCard()
                            RMSkeletonCard()
                            RMSkeletonCard()
                        }
                        .padding(RMTheme.Spacing.md)
                    }
                } else if let errorMessage = errorMessage {
                    // Error state - show error with retry
                    RMEmptyState(
                        icon: "exclamationmark.triangle.fill",
                        title: "Failed to Load Executive Data",
                        message: errorMessage,
                        action: RMEmptyStateAction(
                            title: "Retry",
                            action: {
                                Task {
                                    await loadPosture()
                                }
                            }
                        )
                    )
                    .padding(RMTheme.Spacing.pagePadding)
                } else if let errorMessage = errorMessage {
                    // Error state - show error with retry
                    RMEmptyState(
                        icon: "exclamationmark.triangle.fill",
                        title: "Failed to Load Executive Data",
                        message: errorMessage,
                        action: RMEmptyStateAction(
                            title: "Retry",
                            action: {
                                Task {
                                    await loadPosture()
                                }
                            }
                        )
                    )
                    .padding(RMTheme.Spacing.pagePadding)
                } else if let data = postureData {
                    ScrollView(showsIndicators: false) {
                        VStack(spacing: RMTheme.Spacing.lg) {
                            // Header
                            VStack(alignment: .leading, spacing: RMTheme.Spacing.xs) {
                                Text("Defensibility Posture")
                                    .font(RMTheme.Typography.largeTitle)
                                    .foregroundColor(RMTheme.Colors.textPrimary)
                                
                                Text("Audit-ready proof from everyday field work")
                                    .font(RMTheme.Typography.bodySmall)
                                    .foregroundColor(RMTheme.Colors.textSecondary)
                                
                                HStack {
                                    Text("Ledger Contract v1.0")
                                        .font(RMTheme.Typography.caption)
                                        .foregroundColor(RMTheme.Colors.textTertiary)
                                        .padding(.horizontal, RMTheme.Spacing.sm)
                                        .padding(.vertical, RMTheme.Spacing.xs)
                                        .background(RMTheme.Colors.surface)
                                        .clipShape(Capsule())
                                    
                                    Spacer()
                                    
                                    IntegrityBadge(status: data.ledgerIntegrity)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, RMTheme.Spacing.md)
                            .padding(.top, RMTheme.Spacing.md)
                            
                            // Risk Posture Banner
                            RiskPostureBanner(
                                exposureLevel: data.exposureLevel,
                                confidenceStatement: data.confidenceStatement
                            )
                                .padding(.horizontal, RMTheme.Spacing.md)
                            
                            // Exposure Assessment
                            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                                Text("Exposure Assessment")
                                    .font(RMTheme.Typography.title3)
                                    .foregroundColor(RMTheme.Colors.textPrimary)
                                    .padding(.horizontal, RMTheme.Spacing.md)
                                
                                HStack(spacing: RMTheme.Spacing.md) {
                                    ExposureCard(
                                        title: "High Risk Jobs",
                                        value: data.highRiskJobs,
                                        delta: data.deltas?.highRiskJobs
                                    )
                                    
                                    ExposureCard(
                                        title: "Open Incidents",
                                        value: data.openIncidents,
                                        delta: data.deltas?.openIncidents
                                    )
                                    
                                    ExposureCard(
                                        title: "Violations",
                                        value: data.recentViolations,
                                        delta: data.deltas?.violations
                                    )
                                }
                                .padding(.horizontal, RMTheme.Spacing.md)
                            }
                            
                            // Controls Status
                            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                                Text("Controls Status")
                                    .font(RMTheme.Typography.title3)
                                    .foregroundColor(RMTheme.Colors.textPrimary)
                                    .padding(.horizontal, RMTheme.Spacing.md)
                                
                                HStack(spacing: RMTheme.Spacing.md) {
                                    ControlsCard(
                                        title: "Flagged",
                                        value: data.flaggedJobs
                                    )
                                    
                                    ControlsCard(
                                        title: "Pending Signoffs",
                                        value: data.pendingSignoffs
                                    )
                                    
                                    ControlsCard(
                                        title: "Signed",
                                        value: data.signedJobs
                                    )
                                }
                                .padding(.horizontal, RMTheme.Spacing.md)
                            }
                            
                            // Defensibility Posture
                            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                                Text("Defensibility Posture")
                                    .font(RMTheme.Typography.title3)
                                    .foregroundColor(RMTheme.Colors.textPrimary)
                                    .padding(.horizontal, RMTheme.Spacing.md)
                                
                                HStack(spacing: RMTheme.Spacing.md) {
                                    DefensibilityCard(
                                        title: "Ledger Integrity",
                                        value: data.ledgerIntegrity.capitalized,
                                        status: data.ledgerIntegrity
                                    )
                                    
                                    DefensibilityCard(
                                        title: "Proof Packs",
                                        value: "\(data.proofPacksGenerated)",
                                        status: nil
                                    )
                                    
                                    // Note: enforcementActions and attestationsCoverage not in flat model
                                    // These would need to be added to the backend response or removed
                                    DefensibilityCard(
                                        title: "Enforcement",
                                        value: "0", // Enforcement actions not in current API response
                                        status: nil
                                    )
                                    
                                    DefensibilityCard(
                                        title: "Attestations",
                                        value: "\(data.signedJobs)/\(data.signedJobs + data.pendingSignoffs)", // Approximate
                                        status: nil
                                    )
                                }
                                .padding(.horizontal, RMTheme.Spacing.md)
                            }
                            
                            // Export Actions
                            ExportActionsCard(
                                isExportingPDF: $isExportingPDF,
                                isExportingJSON: $isExportingJSON,
                                onExportPDF: {
                                    // TODO: Export PDF brief
                                },
                                onExportJSON: {
                                    // TODO: Export API payload
                                }
                            )
                            .padding(.horizontal, RMTheme.Spacing.md)
                            .padding(.bottom, RMTheme.Spacing.lg)
                        }
                    }
                } else {
                    RMEmptyState(
                        icon: "exclamationmark.triangle",
                        title: "Failed to Load",
                        message: "Unable to load executive posture data"
                    )
                }
            }
            .navigationTitle("Executive")
            .navigationBarTitleDisplayMode(.large)
            .task {
                await loadPosture()
            }
            .refreshable {
                await loadPosture()
            }
    }
    
    private func loadPosture() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        
        do {
            postureData = try await APIClient.shared.getExecutivePosture(timeRange: "30d")
            errorMessage = nil // Clear any previous error
        } catch {
            let errorDesc = error.localizedDescription
            print("[ExecutiveView] ❌ Failed to load: \(errorDesc)")
            errorMessage = errorDesc
            postureData = nil // Clear on error - never show stale data
        }
    }
}

// MARK: - Risk Posture Banner

struct RiskPostureBanner: View {
    let exposureLevel: String
    let confidenceStatement: String
    
    var bannerColor: Color {
        switch exposureLevel.lowercased() {
        case "low": return RMTheme.Colors.success
        case "moderate": return RMTheme.Colors.warning
        case "high": return RMTheme.Colors.error
        default: return RMTheme.Colors.surface
        }
    }
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                HStack {
                    Image(systemName: "checkmark.shield.fill")
                        .foregroundColor(bannerColor)
                    
                    Text(confidenceStatement)
                        .font(RMTheme.Typography.bodyBold)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                }
                
                Text("Generated from immutable records")
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(RMTheme.Colors.textSecondary)
            }
        }
        .overlay {
            RoundedRectangle(cornerRadius: RMTheme.Radius.xl)
                .stroke(bannerColor.opacity(0.3), lineWidth: 2)
        }
    }
}

// MARK: - Exposure Card

struct ExposureCard: View {
    let title: String
    let value: Int
    let delta: Int?
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                Text(title)
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                
                HStack(alignment: .firstTextBaseline, spacing: RMTheme.Spacing.xs) {
                    Text("\(value)")
                        .font(RMTheme.Typography.title2)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    
                    if let delta = delta, delta != 0 {
                        HStack(spacing: 2) {
                            Image(systemName: delta > 0 ? "arrow.up" : "arrow.down")
                                .font(.system(size: 10, weight: .bold))
                            Text("\(abs(delta))")
                                .font(RMTheme.Typography.captionSmall)
                        }
                        .foregroundColor(delta > 0 ? RMTheme.Colors.error : RMTheme.Colors.success)
                    }
                }
            }
        }
    }
}

// MARK: - Controls Card

struct ControlsCard: View {
    let title: String
    let value: Int
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                Text(title)
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                
                Text("\(value)")
                    .font(RMTheme.Typography.title2)
                    .foregroundColor(RMTheme.Colors.textPrimary)
            }
        }
    }
}

// MARK: - Defensibility Card

struct DefensibilityCard: View {
    let title: String
    let value: String
    let status: String?
    
    var statusColor: Color? {
        guard let status = status else { return nil }
        switch status.lowercased() {
        case "verified": return RMTheme.Colors.success
        case "unverified": return RMTheme.Colors.warning
        case "error": return RMTheme.Colors.error
        default: return nil
        }
    }
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                Text(title)
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                
                Text(value)
                    .font(RMTheme.Typography.title3)
                    .foregroundColor(statusColor ?? RMTheme.Colors.textPrimary)
            }
        }
    }
}

// MARK: - Integrity Badge

struct IntegrityBadge: View {
    let status: String
    
    var color: Color {
        switch status.lowercased() {
        case "verified": return RMTheme.Colors.success
        case "unverified": return RMTheme.Colors.warning
        case "error": return RMTheme.Colors.error
        default: return RMTheme.Colors.textTertiary
        }
    }
    
    var icon: String {
        switch status.lowercased() {
        case "verified": return "checkmark.shield.fill"
        case "unverified": return "exclamationmark.shield.fill"
        case "error": return "xmark.shield.fill"
        default: return "questionmark.shield.fill"
        }
    }
    
    var body: some View {
        HStack(spacing: RMTheme.Spacing.xs) {
            Image(systemName: icon)
                .font(.system(size: 12))
            Text(status.capitalized)
                .font(RMTheme.Typography.captionBold)
        }
        .foregroundColor(.white)
        .padding(.horizontal, RMTheme.Spacing.sm)
        .padding(.vertical, RMTheme.Spacing.xs)
        .background(color)
        .clipShape(Capsule())
    }
}

// MARK: - Export Actions Card

struct ExportActionsCard: View {
    @Binding var isExportingPDF: Bool
    @Binding var isExportingJSON: Bool
    let onExportPDF: () -> Void
    let onExportJSON: () -> Void
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                Text("Open Full Governance Record")
                    .font(RMTheme.Typography.title3)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                
                HStack(spacing: RMTheme.Spacing.md) {
                    Button {
                        let generator = UIImpactFeedbackGenerator(style: .medium)
                        generator.impactOccurred()
                        onExportPDF()
                    } label: {
                        HStack {
                            if isExportingPDF {
                                ProgressView()
                                    .tint(.black)
                            } else {
                                Image(systemName: "doc.fill")
                                Text("Export PDF Brief")
                            }
                        }
                        .font(RMTheme.Typography.bodyBold)
                        .foregroundColor(.black)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, RMTheme.Spacing.md)
                        .background(RMTheme.Colors.accent)
                        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.md))
                    }
                    .disabled(isExportingPDF)
                    
                    Button {
                        let generator = UIImpactFeedbackGenerator(style: .medium)
                        generator.impactOccurred()
                        onExportJSON()
                    } label: {
                        HStack {
                            if isExportingJSON {
                                ProgressView()
                                    .tint(RMTheme.Colors.textPrimary)
                            } else {
                                Image(systemName: "square.and.arrow.up")
                                Text("API Payload")
                            }
                        }
                        .font(RMTheme.Typography.bodyBold)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, RMTheme.Spacing.md)
                        .background(RMTheme.Colors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.md))
                        .overlay {
                            RoundedRectangle(cornerRadius: RMTheme.Radius.md)
                                .stroke(RMTheme.Colors.border, lineWidth: 1)
                        }
                    }
                    .disabled(isExportingJSON)
                }
            }
        }
    }
}

#Preview {
    NavigationStack {
        ExecutiveView()
    }
}
