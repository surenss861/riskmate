import SwiftUI

/// Pinned Export control: one CTA + metadata. Optional "Last exported…" and divider below.
/// chromeT (0...1) drives "attach to scroll": fill 0.92→0.955, shadow 0.26→0.16 (at-rest less floaty), shadow y 6→3.
struct LedgerExportControl: View {
    var lastExportedAt: Date?
    var dividerOpacity: CGFloat = 0
    var chromeT: CGFloat = 0
    let onExportTapped: () -> Void

    private var fillOpacity: CGFloat { 0.92 + (0.955 - 0.92) * chromeT }
    private var shadowOpacity: CGFloat { 0.26 + (0.16 - 0.26) * chromeT }
    private var shadowY: CGFloat { 6 + (3 - 6) * chromeT }

    private var lastExportedText: String? {
        guard let date = lastExportedAt else { return nil }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return "Last exported \(formatter.localizedString(for: date, relativeTo: Date()))"
    }

    private let radius = RMTheme.Radius.card

    var body: some View {
        VStack(spacing: 0) {
            Button(action: {
                Haptics.tap()
                onExportTapped()
            }) {
                HStack(spacing: 10) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(RMTheme.Colors.accent)
                    Text("Export Proof Pack")
                        .font(RMTheme.Typography.sectionTitle)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    Spacer(minLength: 0)
                    Text("Generate")
                        .font(RMTheme.Typography.bodySmallBold)
                        .foregroundColor(RMTheme.Colors.accent)
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(RMTheme.Colors.textTertiary)
                }
                .frame(height: 48)
                .padding(.horizontal, RMTheme.Spacing.cardPadding)
            }
            .buttonStyle(.plain)
            .background(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .fill(RMTheme.Colors.surface2.opacity(fillOpacity))
            )
            .overlay(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .stroke(Color.white.opacity(0.07), lineWidth: 1)
            )
            .overlay(
                VStack(spacing: 0) {
                    Rectangle()
                        .fill(Color.white.opacity(0.06))
                        .frame(height: 1)
                    Spacer(minLength: 0)
                }
                .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
            )
            .shadow(color: .black.opacity(shadowOpacity), radius: 16, x: 0, y: shadowY)
            .padding(.horizontal, RMTheme.Spacing.pagePadding)
            .padding(.top, RMTheme.Spacing.sm)

            Rectangle()
                .fill(.ultraThinMaterial)
                .opacity(dividerOpacity)
                .frame(height: 1)
                .transaction { $0.animation = .easeOut(duration: 0.15) }
        }
        .background(RMTheme.Colors.background)
    }
}
