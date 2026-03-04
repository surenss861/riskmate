import SwiftUI

/// Top 6–10 dashboard cards with stagger and tap-to-drill. Light haptic only; routes via QuickActionRouter + optional callbacks.
struct DashboardCardGrid: View {
    let items: [DashboardCardItem]
    @EnvironmentObject private var quickAction: QuickActionRouter
    var onNavigateToTeam: (() -> Void)?
    var onNavigateToExports: (() -> Void)?
    
    var body: some View {
        LazyVGrid(columns: [
            GridItem(.flexible(), spacing: RMTheme.Spacing.md),
            GridItem(.flexible(), spacing: RMTheme.Spacing.md)
        ], spacing: RMTheme.Spacing.md) {
            ForEach(Array(items.prefix(10).enumerated()), id: \.element.id) { index, item in
                DashboardGridCard(item: item) {
                    handleRoute(item.route)
                }
                .rmAppearIn(staggerIndex: min(index, 12))
                .rmPressable(scale: 0.98, haptic: true, lightImpact: true)
            }
        }
    }
    
    private func handleRoute(_ route: DashboardCardRoute) {
        switch route {
        case .highRisk:
            quickAction.requestSwitchToWorkRecords(filter: "highRisk")
        case .blockers:
            quickAction.requestSwitchToWorkRecords(filter: "blockers")
        case .ledger:
            quickAction.requestSwitchToLedger()
        case .exports:
            onNavigateToExports?()
        case .team:
            onNavigateToTeam?()
        }
    }
}

private struct DashboardGridCard: View {
    let item: DashboardCardItem
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            RMGlassCard {
                VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                    HStack {
                        Image(systemName: item.icon)
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundColor(RMTheme.Colors.accent)
                        Spacer()
                    }
                    Text(item.value)
                        .font(RMTheme.Typography.title3)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    Text(item.title)
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                }
                .padding(RMTheme.Spacing.md)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    DashboardCardGrid(
        items: [
            DashboardCardItem(id: "1", title: "High Risk", subtitle: "Jobs", icon: "exclamationmark.triangle.fill", value: "3", route: .highRisk),
            DashboardCardItem(id: "2", title: "Blockers", subtitle: "", icon: "hand.raised.fill", value: "1", route: .blockers)
        ]
    )
    .padding()
    .environmentObject(QuickActionRouter.shared)
}
