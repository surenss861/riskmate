import SwiftUI

/// Timeline row: left rail + status dot + title/subtitle + hash pill + time. Solid surface, tap affordance.
/// When onTap is non-nil, shows chevron and row tap opens detail; hash pill tap/long-press copy unchanged.
struct LedgerTimelineRow: View {
    let title: String
    let subtitle: String
    let hashPreview: String
    let fullHash: String
    let timeText: String
    let status: LedgerEventStatus
    let isVerified: Bool
    var onTap: (() -> Void)? = nil

    enum LedgerEventStatus {
        case verified
        case warning
        case error

        var dotColor: Color {
            switch self {
            case .verified: return Color.white.opacity(0.9)
            case .warning: return RMTheme.Colors.warning
            case .error: return RMTheme.Colors.error
            }
        }
    }

    var body: some View {
        ledgerRowContent
            .padding(14)
            .background(
                RoundedRectangle(cornerRadius: RMTheme.Radius.card, style: .continuous)
                    .fill(RMTheme.Colors.surface2.opacity(0.92))
                    .overlay(
                        RoundedRectangle(cornerRadius: RMTheme.Radius.card, style: .continuous)
                            .stroke(RMTheme.Colors.border.opacity(RMTheme.Surfaces.strokeOpacity), lineWidth: 1)
                    )
            )
            .contentShape(Rectangle())
            .onTapGesture {
                if let onTap = onTap {
                    Haptics.tap()
                    onTap()
                }
            }
            .rmPressable(scale: 0.99, haptic: false, pressOpacity: 0.94)
    }

    private var ledgerRowContent: some View {
        HStack(alignment: .top, spacing: 0) {
                // Timeline rail (1pt) + dot (8pt); rail starts 6pt above dot, runs through dot center
                ZStack(alignment: .top) {
                    Rectangle()
                        .fill(Color.white.opacity(0.06))
                        .frame(width: 1)
                        .frame(maxHeight: .infinity)
                        .padding(.top, 6)
                    VStack(spacing: 0) {
                        Color.clear.frame(height: 6)
                        Circle()
                            .fill(status.dotColor)
                            .frame(width: 8, height: 8)
                    }
                }
                .frame(width: 16)

                VStack(alignment: .leading, spacing: 4) {
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 4) {
                            Text(title)
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundColor(RMTheme.Colors.textPrimary)
                                .lineLimit(2)
                            if isVerified {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.system(size: 12))
                                    .foregroundColor(Color.white.opacity(0.9))
                            }
                            if status == .warning || status == .error {
                                Text("Needs review")
                                    .font(.system(size: 10, weight: .medium))
                                    .foregroundColor(RMTheme.Colors.textTertiary.opacity(0.9))
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(RMTheme.Colors.surface1.opacity(0.5), in: Capsule())
                            }
                        }
                        Text(subtitle)
                            .font(.system(size: 13, weight: .regular))
                            .foregroundColor(RMTheme.Colors.textSecondary.opacity(0.55))
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    // Time + hash pill on same row for fast scan ("what happened + when" at a glance)
                    HStack(alignment: .center, spacing: RMTheme.Spacing.sm) {
                        Text(timeText)
                            .font(RMTheme.Typography.metadataSmall)
                            .foregroundColor(RMTheme.Colors.textTertiary)
                        Button {
                            copyHash(fullHashToast: false)
                        } label: {
                            HStack(spacing: 6) {
                                Text("SHA-256 · \(hashPreview)")
                                    .font(RMTheme.Typography.metadata)
                                    .foregroundColor(RMTheme.Colors.textSecondary.opacity(0.70))
                                Image(systemName: "doc.on.doc")
                                    .font(.system(size: 10, weight: .medium))
                                    .foregroundColor(RMTheme.Colors.textTertiary)
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(RMTheme.Colors.surface1.opacity(0.65), in: Capsule())
                        }
                        .buttonStyle(.plain)
                        .onLongPressGesture(minimumDuration: 0.4) {
                            copyHash(fullHashToast: true)
                        }
                        Spacer(minLength: 0)
                        if onTap != nil {
                            Image(systemName: "chevron.right")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundColor(RMTheme.Colors.textTertiary)
                                .opacity(isVerified ? 0.15 : 0.28)
                        }
                    }
                    .padding(.top, 3)
                }
                .padding(.leading, RMTheme.Spacing.sm)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func copyHash(fullHashToast: Bool) {
        UIPasteboard.general.string = fullHash
        Haptics.impact(.light)
        ToastCenter.shared.show(
            fullHashToast ? "Copied full hash" : "Copied",
            systemImage: "doc.on.doc",
            style: .success
        )
    }
}

/// Day section header: "Today" / "Yesterday" / "Mar 3" + "N events"
struct LedgerDaySectionHeader: View {
    let title: String
    let eventCount: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(RMTheme.Typography.sectionTitle)
                .foregroundColor(RMTheme.Colors.textPrimary)
            Text("\(eventCount) event\(eventCount == 1 ? "" : "s")")
                .font(RMTheme.Typography.metadata)
                .foregroundColor(RMTheme.Colors.textTertiary)
        }
    }
}
