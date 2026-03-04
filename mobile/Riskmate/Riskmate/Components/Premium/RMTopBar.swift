import SwiftUI

/// Top app bar for root tab screens: title on left, optional trailing content + notifications + account on right.
/// Anchors the UI and makes the app feel native. Use at the top of Operations, Ledger, Work Records, Account.
struct RMTopBar<Trailing: View>: View {
    let title: String
    /// Optional unread count for notification badge (0 = hide badge).
    var notificationBadge: Int = 0
    @ViewBuilder var trailing: () -> Trailing
    @EnvironmentObject private var quickAction: QuickActionRouter

    init(title: String, notificationBadge: Int = 0, @ViewBuilder trailing: @escaping () -> Trailing) {
        self.title = title
        self.notificationBadge = notificationBadge
        self.trailing = trailing
    }

    var body: some View {
        HStack(spacing: 0) {
            // Left: RiskMate mark + screen title
            HStack(spacing: 6) {
                Text("Riskmate")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(RMTheme.Colors.textSecondary)
                    .tracking(0.4)
                Text("·")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(RMTheme.Colors.textTertiary)
                Text(title)
                    .font(RMTheme.Typography.headline)
                    .foregroundColor(RMTheme.Colors.textPrimary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            // Right: Optional trailing (e.g. Ledger menu) + Notifications + Account
            HStack(spacing: RMTheme.Spacing.sm) {
                trailing()
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
        .padding(.horizontal, RMTheme.Spacing.md)
        .padding(.vertical, RMTheme.Spacing.sm)
        .background {
            RMTheme.Colors.background
        }
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(RMTheme.Colors.border)
                .frame(height: 0.5)
        }
    }
}

extension RMTopBar where Trailing == EmptyView {
    init(title: String, notificationBadge: Int = 0) {
        self.init(title: title, notificationBadge: notificationBadge, trailing: { EmptyView() })
    }
}

#Preview {
    RMTopBar(title: "Operations", notificationBadge: 3)
        .environmentObject(QuickActionRouter.shared)
        .background(RMTheme.Colors.background)
}
