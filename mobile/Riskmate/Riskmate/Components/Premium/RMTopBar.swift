import SwiftUI

/// Top app bar for root tab screens: title on left, optional trailing content + notifications + account on right.
/// Anchors the UI and makes the app feel native. Use at the top of Operations, Ledger, Work Records, Account.
struct RMTopBar: View {
    /// Height reserved for the top bar. Use for layout if needed (e.g. content top padding).
    static let barHeight: CGFloat = 56

    let title: String
    /// Optional unread count for notification badge (0 = hide badge).
    var notificationBadge: Int = 0
    @ViewBuilder var trailingContent: () -> AnyView
    @EnvironmentObject private var quickAction: QuickActionRouter

    init<Trailing: View>(title: String, notificationBadge: Int = 0, @ViewBuilder trailing: @escaping () -> Trailing) {
        self.title = title
        self.notificationBadge = notificationBadge
        self.trailingContent = { AnyView(trailing()) }
    }

    var body: some View {
        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 1) {
                Text("Riskmate")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.white.opacity(0.45))
                Text(title)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(.white.opacity(0.95))
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            HStack(spacing: 4) {
                trailingContent()
                Button {
                    Haptics.tap()
                    quickAction.openNotificationCenter()
                } label: {
                    ZStack(alignment: .topTrailing) {
                        Circle()
                            .fill(Color.clear)
                            .frame(width: 44, height: 44)
                            .overlay(
                                Image(systemName: "bell.fill")
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundColor(RMTheme.Colors.textPrimary.opacity(0.88))
                            )
                        if notificationBadge > 0 {
                            Text(notificationBadge > 99 ? "99+" : "\(notificationBadge)")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundColor(.white)
                                .padding(.horizontal, 4)
                                .padding(.vertical, 2)
                                .background(Capsule().fill(RMTheme.Colors.accent))
                                .offset(x: 6, y: -6)
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .rmPressable(scale: 0.98, pressOpacity: 0.90, haptic: true)
                .zIndex(1000)

                Button {
                    Haptics.tap()
                    quickAction.requestSwitchToSettings()
                } label: {
                    Circle()
                        .fill(Color.clear)
                        .frame(width: 44, height: 44)
                        .overlay(
                            Image(systemName: "person.circle.fill")
                                .font(.system(size: 20, weight: .regular))
                                .foregroundColor(RMTheme.Colors.textPrimary.opacity(0.88))
                        )
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .rmPressable(scale: 0.98, pressOpacity: 0.90, haptic: true)
                .zIndex(1000)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .frame(height: Self.barHeight, alignment: .bottom)
        .background(.ultraThinMaterial)
        .overlay(Color.black.opacity(0.22).allowsHitTesting(false))
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Color.white.opacity(0.06))
                .frame(height: 1)
        }
        .zIndex(100)
    }
}

extension RMTopBar {
    init(title: String, notificationBadge: Int = 0) {
        self.init(title: title, notificationBadge: notificationBadge, trailing: { EmptyView() })
    }
}

#Preview {
    RMTopBar(title: "Operations", notificationBadge: 3)
        .environmentObject(QuickActionRouter.shared)
        .background(RMTheme.Colors.background)
}
