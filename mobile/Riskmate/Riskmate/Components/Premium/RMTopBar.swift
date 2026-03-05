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
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Riskmate")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(.white.opacity(0.45))
                Text(title)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(.white.opacity(0.95))
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            HStack(spacing: RMTheme.Spacing.sm) {
                trailingContent()
                Button {
                    Haptics.tap()
                    quickAction.openNotificationCenter()
                } label: {
                    ZStack(alignment: .topTrailing) {
                        Image(systemName: "bell.fill")
                            .font(.system(size: 18))
                            .foregroundColor(RMTheme.Colors.textPrimary)
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
                    .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)

                Button {
                    Haptics.tap()
                    quickAction.requestSwitchToSettings()
                } label: {
                    Image(systemName: "person.circle.fill")
                        .font(.system(size: 22))
                        .foregroundColor(RMTheme.Colors.textPrimary)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .frame(height: Self.barHeight, alignment: .bottom)
        .background(.ultraThinMaterial)
        .overlay(Color.black.opacity(0.22))
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Color.white.opacity(0.06))
                .frame(height: 1)
        }
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
