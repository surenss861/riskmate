import SwiftUI

/// Operations header with unified status bar - Apple Home style
struct OperationsHeaderView: View {
    let activeCount: Int
    let highRiskCount: Int
    let missingEvidenceCount: Int
    let lastSync: Date?
    let onKPITap: (KPIType) -> Void
    
    var body: some View {
        // Unified status bar: Live • Active (n) • High Risk (n)
        HStack(spacing: RMSystemTheme.Spacing.sm) {
            // Live indicator (compact)
            HStack(spacing: 4) {
                Circle()
                    .fill(Color.green)
                    .frame(width: 6, height: 6)
                Text("Live")
                    .font(RMSystemTheme.Typography.caption.weight(.medium))
                    .foregroundStyle(RMSystemTheme.Colors.textSecondary)
            }
            
            Text("•")
                .foregroundStyle(RMSystemTheme.Colors.separator)
            
            // Active chip (always shown)
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
                    title: "Needs Evidence",
                    count: missingEvidenceCount,
                    color: Color(.systemOrange),
                    action: { onKPITap(.missingEvidence) }
                )
            }
            
            Spacer()
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
