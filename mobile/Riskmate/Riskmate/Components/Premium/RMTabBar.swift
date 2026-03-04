import SwiftUI

/// Premium tab bar: blur, spring selection, haptic. Use with ZStack of screens (not system TabView).
struct RMTabBar: View {
    /// Height reserved for the tab bar (content + safe area). Use for bottom padding on tab screens.
    static let barHeight: CGFloat = 80

    @Binding var selection: MainTab
    var namespace: Namespace.ID
    /// Optional badge counts per tab (e.g. notifications, pending sync).
    var badgeCounts: [MainTab: Int] = [:]

    private static let items: [(tab: MainTab, title: String, icon: String)] = [
        (.operations, "Operations", "briefcase.fill"),
        (.ledger, "Ledger", "list.bullet.rectangle"),
        (.workRecords, "Work Records", "doc.text.fill"),
        (.settings, "Settings", "gearshape.fill"),
    ]

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Self.items, id: \.tab) { item in
                tabButton(tab: item.tab, title: item.title, icon: item.icon)
            }
        }
        .padding(.horizontal, RMTheme.Spacing.sm)
        .padding(.vertical, RMTheme.Spacing.xs)
        .background {
            VisualEffectBlur(style: .systemThinMaterial)
                .overlay(RMTheme.Colors.surface.opacity(0.6))
                .ignoresSafeArea(edges: .bottom)
        }
        .overlay(alignment: .top) {
            Rectangle()
                .fill(RMTheme.Colors.border)
                .frame(height: 1)
        }
    }

    private func tabButton(tab: MainTab, title: String, icon: String) -> some View {
        let isSelected = selection == tab
        let count = badgeCounts[tab] ?? 0
        return Button {
            guard selection != tab else { return }
            Haptics.tap()
            withAnimation(RMMotion.spring) {
                selection = tab
            }
        } label: {
            VStack(spacing: 4) {
                ZStack(alignment: .topTrailing) {
                    Image(systemName: icon)
                        .font(.system(size: 22, weight: isSelected ? .semibold : .regular))
                    if count > 0 {
                        Text(count > 99 ? "99+" : "\(count)")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(Capsule().fill(RMTheme.Colors.accent))
                            .offset(x: 8, y: -6)
                    }
                }
                Text(title)
                    .font(RMTheme.Typography.caption2)
                    .lineLimit(1)
            }
            .foregroundColor(isSelected ? RMTheme.Colors.accent : RMTheme.Colors.textSecondary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, RMTheme.Spacing.sm)
            .background {
                if isSelected {
                    Capsule()
                        .fill(RMTheme.Colors.accent.opacity(0.15))
                        .matchedGeometryEffect(id: "tabSelection", in: namespace)
                }
            }
        }
        .buttonStyle(.plain)
    }
}

private struct RMTabBarPreview: View {
    @Namespace private var ns
    var body: some View {
        VStack {
            Spacer()
            RMTabBar(selection: .constant(MainTab.operations), namespace: ns)
        }
        .background(RMTheme.Colors.background)
    }
}

#Preview {
    RMTabBarPreview()
}
