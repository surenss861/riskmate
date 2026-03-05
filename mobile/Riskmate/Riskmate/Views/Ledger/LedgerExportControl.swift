import SwiftUI

/// Pinned Proof Pack row: context + small Export capsule (calm, not banner). Optional divider below.
struct LedgerExportControl: View {
    var lastExportedAt: Date?
    var dividerOpacity: CGFloat = 0
    var chromeT: CGFloat = 0
    let onExportTapped: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            RMCard(useSolidSurface: true) {
                HStack(spacing: 10) {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(Color.white.opacity(0.06))
                        .frame(width: 36, height: 36)
                        .overlay(
                            Image(systemName: "tray.and.arrow.up.fill")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(Color.white.opacity(0.20))
                        )
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.white.opacity(0.07), lineWidth: 1))

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Proof Pack")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(RMTheme.Colors.textPrimary.opacity(0.92))
                        Text("Includes hashes · Export-ready PDF/JSON")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(RMTheme.Colors.textTertiary.opacity(0.68))
                    }

                    Spacer()

                    Button(action: {
                        Haptics.tap()
                        onExportTapped()
                    }) {
                        Text("Export")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(RMTheme.Colors.textPrimary.opacity(0.88))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(Capsule().fill(Color.white.opacity(0.06)))
                            .overlay(Capsule().stroke(Color.white.opacity(0.07), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .rmPressable(scale: 0.98, pressOpacity: 0.92, haptic: true)
                }
            }
            .padding(.horizontal, RMTheme.Spacing.pagePadding)
            .padding(.top, RMTheme.Spacing.sm + 2)
            .padding(.bottom, 8)
            .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.card, style: .continuous))
            .overlay(alignment: .bottom) {
                Rectangle()
                    .fill(Color.white.opacity(0.06))
                    .frame(height: 1)
            }

            Rectangle()
                .fill(.ultraThinMaterial)
                .opacity(dividerOpacity)
                .frame(height: 1)
                .transaction { $0.animation = .easeOut(duration: 0.15) }
        }
        .background(RMTheme.Colors.background)
    }
}
