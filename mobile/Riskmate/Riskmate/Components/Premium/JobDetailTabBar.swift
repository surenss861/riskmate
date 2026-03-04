import SwiftUI

/// Premium job detail tab bar: scrollable pills, sticky blur background, animated capsule, optional badges.
/// Use in place of plain Picker for Overview / Activity / Signatures / Evidence / Tasks / Comments.
struct JobDetailTabBar: View {
    let tabs: [JobDetailTab]
    @Binding var selection: JobDetailTab
    /// Optional badge counts per tab (e.g. Activity unread, Tasks due soon, Evidence new uploads). Show dot or count when > 0.
    var badgeCounts: [JobDetailTab: Int] = [:]
    @Namespace private var capsuleNamespace

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: RMTheme.Spacing.xs) {
                    ForEach(tabs, id: \.self) { tab in
                        tabButton(tab, proxy: proxy)
                    }
                }
                .padding(.horizontal, RMTheme.Spacing.sm)
                .padding(.vertical, RMTheme.Spacing.xs)
            }
            .background(blurBackground)
            .onChange(of: selection) { _, newValue in
                withAnimation(.easeInOut(duration: 0.2)) {
                    proxy.scrollTo(newValue, anchor: .center)
                }
            }
        }
        .background(RMTheme.Colors.background)
    }

    private var blurBackground: some View {
        VisualEffectBlur(style: .systemThinMaterial)
            .opacity(0.92)
    }

    private func tabButton(_ tab: JobDetailTab, proxy: ScrollViewProxy) -> some View {
        let isSelected = selection == tab
        let count = badgeCounts[tab] ?? 0
        return Button {
            Haptics.tap()
            withAnimation(.spring(response: 0.35, dampingFraction: 0.75)) {
                selection = tab
            }
        } label: {
            HStack(spacing: 4) {
                Text(tab.title)
                    .font(RMTheme.Typography.bodySmall)
                    .fontWeight(isSelected ? .semibold : .regular)
                    .foregroundColor(isSelected ? .black : RMTheme.Colors.textSecondary)
                if count > 0 {
                    Text(count > 99 ? "99+" : "\(count)")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(isSelected ? .black.opacity(0.8) : RMTheme.Colors.accent)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(isSelected ? Color.white.opacity(0.4) : RMTheme.Colors.accent.opacity(0.25)))
                }
            }
            .padding(.horizontal, RMTheme.Spacing.md)
            .padding(.vertical, RMTheme.Spacing.sm)
            .background(
                Group {
                    if isSelected {
                        Capsule()
                            .fill(RMTheme.Colors.accent)
                            .matchedGeometryEffect(id: "jobTabCapsule", in: capsuleNamespace)
                    }
                }
            )
        }
        .buttonStyle(.plain)
        .id(tab)
    }
}

#Preview {
    VStack(spacing: 0) {
        JobDetailTabBar(
            tabs: [.overview, .activity, .signatures, .evidence, .tasks, .comments],
            selection: .constant(JobDetailTab.overview),
            badgeCounts: [.activity: 2, .tasks: 1]
        )
        Spacer()
    }
    .background(RMTheme.Colors.background)
}
