import SwiftUI

/// Operations header with KPI chips - Apple Home style
struct OperationsHeaderView: View {
    let activeCount: Int
    let highRiskCount: Int
    let missingEvidenceCount: Int
    let lastSync: Date?
    let onKPITap: (KPIType) -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: RMSystemTheme.Spacing.sm) {
            // Live Sync Status (green pulse dot + "Live")
            LiveSyncStatus(isOnline: true, lastSync: lastSync)
            
            // KPI Chips
            HStack(spacing: RMSystemTheme.Spacing.sm) {
                KPIChip(
                    title: "Active",
                    count: activeCount,
                    color: Color(.systemBlue),
                    action: { onKPITap(.active) }
                )
                
                if highRiskCount > 0 {
                    KPIChip(
                        title: "High Risk",
                        count: highRiskCount,
                        color: Color(.systemRed),
                        action: { onKPITap(.highRisk) }
                    )
                }
                
                if missingEvidenceCount > 0 {
                    KPIChip(
                        title: "Missing Evidence",
                        count: missingEvidenceCount,
                        color: Color(.systemOrange),
                        action: { onKPITap(.missingEvidence) }
                    )
                }
            }
        }
        .padding(.vertical, RMSystemTheme.Spacing.xs)
    }
    
    private func relativeTime(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

enum KPIType {
    case active
    case highRisk
    case missingEvidence
}

/// Compact KPI chip - tappable, system colors
struct KPIChip: View {
    let title: String
    let count: Int
    let color: Color
    let action: () -> Void
    
    var body: some View {
        Button {
            Haptics.tap()
            action()
        } label: {
            HStack(spacing: 4) {
                Text(title)
                    .font(RMSystemTheme.Typography.caption.weight(.semibold))
                    .foregroundStyle(color)
                
                Text("\(count)")
                    .font(RMSystemTheme.Typography.caption.weight(.bold))
                    .foregroundStyle(color)
            }
            .padding(.horizontal, RMSystemTheme.Spacing.sm)
            .padding(.vertical, 6)
            .background(
                Capsule()
                    .fill(color.opacity(0.15))
            )
        }
        .buttonStyle(.plain)
    }
}
