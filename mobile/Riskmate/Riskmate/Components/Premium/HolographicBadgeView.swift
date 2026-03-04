import SwiftUI

/// Tasteful gamification: holographic badge card with tilt-driven gradient and optional reward animation.
/// Use for "7-day logging streak", "Audit-ready week", "0 overdue tasks", "Proof Pack shipped".
struct HolographicBadgeView: View {
    let title: String
    let subtitle: String?
    let icon: String
    var showRewardAnimation: Bool = false

    @State private var dragOffset: CGSize = .zero
    @State private var showShine: Bool = false

    private var tiltGradient: LinearGradient {
        let x = dragOffset.width
        let y = dragOffset.height
        let magnitude = min(1, sqrt(x * x + y * y) / 80)
        return LinearGradient(
            colors: [
                RMTheme.Colors.accent.opacity(0.5 + magnitude * 0.2),
                Color(hex: "#8B5CF6").opacity(0.4),
                Color(hex: "#06B6D4").opacity(0.35),
                RMTheme.Colors.accent.opacity(0.3),
            ],
            startPoint: UnitPoint(x: 0.5 - x / 200, y: 0.5 - y / 200),
            endPoint: UnitPoint(x: 0.5 + x / 200, y: 0.5 + y / 200)
        )
    }

    var body: some View {
        VStack(spacing: RMTheme.Spacing.sm) {
            ZStack {
                RoundedRectangle(cornerRadius: RMTheme.Radius.md)
                    .fill(tiltGradient)
                    .overlay(
                        RoundedRectangle(cornerRadius: RMTheme.Radius.md)
                            .stroke(
                                LinearGradient(
                                    colors: [
                                        Color.white.opacity(0.4),
                                        Color.white.opacity(0.1),
                                    ],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                lineWidth: 1
                            )
                    )
                    .overlay(
                        Rectangle()
                            .fill(
                                LinearGradient(
                                    colors: [.clear, .white.opacity(showShine ? 0.15 : 0.05)],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .cornerRadius(RMTheme.Radius.md)
                            .allowsHitTesting(false)
                    )
                    .shadow(color: RMTheme.Colors.accent.opacity(0.25), radius: 8, x: 0, y: 4)

                VStack(spacing: 6) {
                    Image(systemName: icon)
                        .font(.system(size: 28, weight: .medium))
                        .foregroundStyle(.white.opacity(0.95))
                    Text(title)
                        .font(RMTheme.Typography.bodySmallBold)
                        .foregroundColor(.white)
                        .multilineTextAlignment(.center)
                    if let sub = subtitle, !sub.isEmpty {
                        Text(sub)
                            .font(RMTheme.Typography.caption2)
                            .foregroundColor(.white.opacity(0.8))
                    }
                }
                .padding(RMTheme.Spacing.md)
            }
            .frame(maxWidth: 140)
            .offset(x: dragOffset.width * 0.15, y: dragOffset.height * 0.1)
            .simultaneousGesture(
                DragGesture(minimumDistance: 14)
                    .onChanged { value in
                        dragOffset = value.translation
                    }
                    .onEnded { _ in
                        withAnimation(RMMotion.easeOut) {
                            dragOffset = .zero
                        }
                    }
            )
            .onAppear {
                withAnimation(.easeInOut(duration: 2).repeatForever(autoreverses: true).delay(0.5)) {
                    showShine = true
                }
            }
        }
    }
}

/// Lightweight streak/badge model for display (persist via UserDefaults or API later).
struct StreakBadge: Identifiable {
    let id: String
    let title: String
    let subtitle: String?
    let icon: String
    let earnedAt: Date?
}

/// Placeholder badges for "Proof Pack shipped", "7-day logging streak", etc.
enum RiskMateBadges {
    static let proofPackShipped = StreakBadge(
        id: "proof_pack",
        title: "Proof Pack shipped",
        subtitle: "Export generated",
        icon: "shippingbox.fill",
        earnedAt: nil
    )
    static let sevenDayStreak = StreakBadge(
        id: "streak_7",
        title: "7-day streak",
        subtitle: "Logging consistency",
        icon: "flame.fill",
        earnedAt: nil
    )
    static let auditReadyWeek = StreakBadge(
        id: "audit_ready",
        title: "Audit-ready week",
        subtitle: "All jobs documented",
        icon: "checkmark.seal.fill",
        earnedAt: nil
    )
    static let zeroOverdue = StreakBadge(
        id: "zero_overdue",
        title: "0 overdue tasks",
        subtitle: "On top of it",
        icon: "checkmark.circle.fill",
        earnedAt: nil
    )
}

#Preview {
    VStack(spacing: 24) {
        HolographicBadgeView(
            title: RiskMateBadges.proofPackShipped.title,
            subtitle: RiskMateBadges.proofPackShipped.subtitle,
            icon: RiskMateBadges.proofPackShipped.icon
        )
        HolographicBadgeView(
            title: RiskMateBadges.sevenDayStreak.title,
            subtitle: RiskMateBadges.sevenDayStreak.subtitle,
            icon: RiskMateBadges.sevenDayStreak.icon
        )
    }
    .padding()
    .background(RMTheme.Colors.background)
}
