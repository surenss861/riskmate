import SwiftUI

/// Horizontal badge shelf (HolographicBadgeView). Only shows when badges non-empty; gesture coherence already in badge (minDistance 14).
struct DashboardBadgeShelf: View {
    let badges: [DashboardBadgeItem]
    
    var body: some View {
        if badges.isEmpty { EmptyView() }
        else {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: RMTheme.Spacing.md) {
                    ForEach(badges) { badge in
                        HolographicBadgeView(
                            title: badge.title,
                            subtitle: badge.subtitle,
                            icon: badge.icon
                        )
                    }
                }
                .padding(.horizontal, RMTheme.Spacing.pagePadding)
            }
        }
    }
}

struct DashboardBadgeItem: Identifiable {
    let id: String
    let title: String
    let subtitle: String?
    let icon: String
}

#Preview {
    VStack {
        DashboardBadgeShelf(badges: [
            DashboardBadgeItem(id: "1", title: "3-day streak", subtitle: "Logging consistency", icon: "flame.fill"),
            DashboardBadgeItem(id: "2", title: "Audit-ready week", subtitle: "All jobs documented", icon: "checkmark.seal.fill")
        ])
    }
    .padding(.vertical)
    .background(RMTheme.Colors.background)
}
