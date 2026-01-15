import SwiftUI

/// Evidence requirements badge showing remaining evidence needed
struct RMEvidenceRequirementsBadge: View {
    let required: Int
    let uploaded: Int
    let onTap: () -> Void
    
    var remaining: Int {
        max(0, required - uploaded)
    }
    
    var body: some View {
        if remaining > 0 {
            Button {
                onTap()
            } label: {
                HStack(spacing: RMTheme.Spacing.xs) {
                    Image(systemName: "photo.badge.plus")
                        .font(.system(size: 12))
                    
                    Text("Evidence Remaining: \(remaining)")
                        .font(RMTheme.Typography.captionBold)
                }
                .foregroundColor(.black)
                .padding(.horizontal, RMTheme.Spacing.sm)
                .padding(.vertical, RMTheme.Spacing.xs)
                .background(RMTheme.Colors.warning)
                .clipShape(Capsule())
            }
            .accessibilityLabel("Evidence remaining: \(remaining) of \(required)")
            .accessibilityHint("Tap to view evidence requirements")
        }
    }
}

/// Proof readiness meter showing job readiness status
struct RMProofReadinessMeter: View {
    let readiness: ProofReadiness
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                HStack {
                    Text("Proof Readiness")
                        .rmSectionHeader()
                    
                    Spacer()
                    
                    StatusBadge(status: readiness.status.displayName)
                }
                
                VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                    ReadinessRow(
                        label: "Evidence",
                        status: readiness.evidenceStatus,
                        count: readiness.evidenceCount,
                        required: readiness.evidenceRequired
                    )
                    
                    ReadinessRow(
                        label: "Controls",
                        status: readiness.controlsStatus,
                        count: readiness.controlsCompleted,
                        required: readiness.controlsRequired
                    )
                    
                    if readiness.needsAttestation {
                        HStack {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(RMTheme.Colors.warning)
                            Text("Needs attestation")
                                .font(RMTheme.Typography.bodySmall)
                                .foregroundColor(RMTheme.Colors.textPrimary)
                        }
                    }
                }
            }
        }
    }
}

struct ProofReadiness {
    let status: ReadinessStatus
    let evidenceCount: Int
    let evidenceRequired: Int
    let evidenceStatus: ReadinessItemStatus
    let controlsCompleted: Int
    let controlsRequired: Int
    let controlsStatus: ReadinessItemStatus
    let needsAttestation: Bool
}

enum ReadinessStatus {
    case ready
    case needsEvidence
    case needsAttestation
    case needsControls
    
    var displayName: String {
        switch self {
        case .ready: return "Ready"
        case .needsEvidence: return "Needs Evidence"
        case .needsAttestation: return "Needs Attestation"
        case .needsControls: return "Needs Controls"
        }
    }
    
    var color: Color {
        switch self {
        case .ready: return RMTheme.Colors.success
        case .needsEvidence, .needsAttestation, .needsControls: return RMTheme.Colors.warning
        }
    }
}

enum ReadinessItemStatus {
    case complete
    case partial
    case missing
    
    var icon: String {
        switch self {
        case .complete: return "checkmark.circle.fill"
        case .partial: return "circle.lefthalf.filled"
        case .missing: return "circle"
        }
    }
    
    var color: Color {
        switch self {
        case .complete: return RMTheme.Colors.success
        case .partial: return RMTheme.Colors.warning
        case .missing: return RMTheme.Colors.error
        }
    }
}

struct ReadinessRow: View {
    let label: String
    let status: ReadinessItemStatus
    let count: Int
    let required: Int
    
    var body: some View {
        HStack {
            Image(systemName: status.icon)
                .foregroundColor(status.color)
                .font(.system(size: 16))
            
            Text(label)
                .font(RMTheme.Typography.bodySmall)
                .foregroundColor(RMTheme.Colors.textPrimary)
            
            Spacer()
            
            Text("\(count)/\(required)")
                .font(RMTheme.Typography.bodySmallBold)
                .foregroundColor(status.color)
        }
    }
}
