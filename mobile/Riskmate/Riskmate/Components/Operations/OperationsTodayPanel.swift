import SwiftUI

/// Today panel: calm / attention / warning. Animates background tint + subtle icon shift. Tap → JobsList with chip.
struct OperationsTodayPanel: View {
    let blockerCount: Int
    let highRiskCount: Int
    let overdueTasksCount: Int
    let lastUpdated: Date?
    let onTapBlockers: () -> Void
    let onTapHighRisk: () -> Void
    
    private var state: PanelState {
        if blockerCount > 3 || highRiskCount > 5 { return .warning }
        if blockerCount > 0 { return .attention }
        return .calm
    }
    
    var body: some View {
        Button {
            Haptics.impact(.light)
            if blockerCount > 0 {
                onTapBlockers()
            } else if highRiskCount > 0 {
                onTapHighRisk()
            } else {
                onTapHighRisk()
            }
        } label: {
            HStack(spacing: RMTheme.Spacing.md) {
                iconView
                VStack(alignment: .leading, spacing: 4) {
                    Text(state.headline)
                        .font(RMTheme.Typography.bodySmallBold)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    Text(state.subheadline(blockerCount: blockerCount, highRiskCount: highRiskCount, overdueCount: overdueTasksCount, lastUpdated: lastUpdated))
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                }
                Spacer()
                countsView
            }
            .padding(RMTheme.Spacing.md)
            .background(backgroundTint)
            .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
            .animation(RMMotion.easeOut, value: state)
        }
        .buttonStyle(.plain)
    }
    
    private var iconView: some View {
        Image(systemName: state.iconName)
            .font(.system(size: 22, weight: .semibold))
            .foregroundColor(state.iconColor)
            .offset(y: RMMotion.reduceMotion ? 0 : state.iconOffset)
            .animation(RMMotion.easeOut, value: state)
    }
    
    private var countsView: some View {
        HStack(spacing: RMTheme.Spacing.sm) {
            if blockerCount > 0 {
                countBadge("\(blockerCount)", label: "Blockers", color: RMTheme.Colors.error)
            }
            if highRiskCount > 0 {
                countBadge("\(highRiskCount)", label: "High risk", color: RMTheme.Colors.warning)
            }
            if overdueTasksCount > 0 && state != .calm {
                countBadge("\(overdueTasksCount)", label: "Overdue", color: RMTheme.Colors.textSecondary)
            }
        }
        .animation(RMMotion.easeOut, value: blockerCount)
        .animation(RMMotion.easeOut, value: highRiskCount)
    }
    
    private func countBadge(_ value: String, label: String, color: Color) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(RMTheme.Typography.bodySmallBold)
                .foregroundColor(color)
            Text(label)
                .font(RMTheme.Typography.caption2)
                .foregroundColor(RMTheme.Colors.textTertiary)
        }
    }
    
    private var backgroundTint: Color {
        switch state {
        case .calm: return RMTheme.Colors.success.opacity(0.08)
        case .attention: return RMTheme.Colors.warning.opacity(0.12)
        case .warning: return RMTheme.Colors.error.opacity(0.12)
        }
    }
}

private enum PanelState {
    case calm
    case attention
    case warning
    
    var iconName: String {
        switch self {
        case .calm: return "checkmark.circle.fill"
        case .attention: return "exclamationmark.circle.fill"
        case .warning: return "exclamationmark.triangle.fill"
        }
    }
    
    var iconColor: Color {
        switch self {
        case .calm: return RMTheme.Colors.success
        case .attention: return RMTheme.Colors.warning
        case .warning: return RMTheme.Colors.error
        }
    }
    
    /// Subtle icon shift (2–4px); Reduce Motion = 0
    var iconOffset: CGFloat {
        switch self {
        case .calm: return 0
        case .attention: return 2
        case .warning: return 4
        }
    }
    
    var headline: String {
        switch self {
        case .calm: return "Today looks clear"
        case .attention: return "Needs attention"
        case .warning: return "Urgent items"
        }
    }
    
    func subheadline(blockerCount: Int, highRiskCount: Int, overdueCount: Int, lastUpdated: Date?) -> String {
        switch self {
        case .calm:
            return "All caught up"
        case .attention, .warning:
            var parts: [String] = []
            if blockerCount > 0 { parts.append("\(blockerCount) blocker\(blockerCount == 1 ? "" : "s")") }
            if highRiskCount > 0 { parts.append("\(highRiskCount) high risk") }
            if overdueCount > 0 { parts.append("\(overdueCount) overdue") }
            if parts.isEmpty { return "All caught up" }
            return parts.joined(separator: " · ")
        }
    }
}

#Preview {
    VStack(spacing: 12) {
        OperationsTodayPanel(
            blockerCount: 0,
            highRiskCount: 0,
            overdueTasksCount: 0,
            lastUpdated: Date(),
            onTapBlockers: {},
            onTapHighRisk: {}
        )
        OperationsTodayPanel(
            blockerCount: 2,
            highRiskCount: 3,
            overdueTasksCount: 1,
            lastUpdated: Date(),
            onTapBlockers: {},
            onTapHighRisk: {}
        )
    }
    .padding()
    .background(RMTheme.Colors.background)
}
