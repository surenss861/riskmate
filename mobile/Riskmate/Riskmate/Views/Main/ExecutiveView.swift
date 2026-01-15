import SwiftUI

/// Executive Dashboard - Defensibility Posture
struct ExecutiveView: View {
    @State private var postureData: ExecutivePostureResponse?
    @State private var isLoading = true
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
                                    
                                    IntegrityBadge(status: data.defensibility.ledgerIntegrity)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, RMTheme.Spacing.md)
                            .padding(.top, RMTheme.Spacing.md)
                            
                            // Risk Posture Banner
                            RiskPostureBanner(posture: data.riskPosture)
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
                                        value: data.exposure.highRiskJobs.count,
                                        delta: data.exposure.highRiskJobs.delta
                                    )
                                    
                                    ExposureCard(
                                        title: "Open Incidents",
                                        value: data.exposure.openIncidents.count,
                                        delta: data.exposure.openIncidents.delta
                                    )
                                    
                                    ExposureCard(
                                        title: "Violations",
                                        value: data.exposure.violations.count,
                                        delta: data.exposure.violations.delta
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
                                        value: data.controls.flaggedJobs
                                    )
                                    
                                    ControlsCard(
                                        title: "Pending Signoffs",
                                        value: data.controls.pendingSignoffs
                                    )
                                    
                                    ControlsCard(
                                        title: "Signed",
                                        value: data.controls.signedJobs
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
                                        value: data.defensibility.ledgerIntegrity.capitalized,
                                        status: data.defensibility.ledgerIntegrity
                                    )
                                    
                                    DefensibilityCard(
                                        title: "Proof Packs",
                                        value: "\(data.defensibility.proofPacksGenerated)",
                                        status: nil
                                    )
                                    
                                    DefensibilityCard(
                                        title: "Enforcement",
                                        value: "\(data.defensibility.enforcementActions)",
                                        status: nil
                                    )
                                    
                                    DefensibilityCard(
                                        title: "Attestations",
                                        value: "\(data.defensibility.attestationsCoverage.signed)/\(data.defensibility.attestationsCoverage.total)",
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
        defer { isLoading = false }
        
        do {
            postureData = try await APIClient.shared.getExecutivePosture()
        } catch {
            print("[ExecutiveView] Failed to load: \(error)")
            // TODO: Show error toast
        }
    }
}

// MARK: - Risk Posture Banner

struct RiskPostureBanner: View {
    let posture: RiskPosture
    
    var bannerColor: Color {
        switch posture.exposureLevel.lowercased() {
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
                    
                    Text(posture.confidenceStatement)
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
