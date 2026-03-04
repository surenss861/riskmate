import SwiftUI

/// Dashboard card item for the top grid: title, subtitle, icon, value, and route for tap-to-drill.
struct DashboardCardItem: Identifiable {
    let id: String
    let title: String
    let subtitle: String
    let icon: String
    let value: String
    let route: DashboardCardRoute
}

/// Where a dashboard card navigates. Uses QuickActionRouter for tab/sidebar/sheet.
enum DashboardCardRoute {
    case highRisk
    case blockers
    case ledger
    case exports
    case team
}
