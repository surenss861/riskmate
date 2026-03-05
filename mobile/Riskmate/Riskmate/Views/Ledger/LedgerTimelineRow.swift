import SwiftUI

/// Timeline row: left rail + status dot + title/subtitle + hash pill + time. Solid surface, tap affordance.
struct LedgerTimelineRow: View {
    let title: String
    let subtitle: String
    let hashPreview: String
    let fullHash: String
    let timeText: String
    let status: LedgerEventStatus
    let isVerified: Bool
    let onTap: () -> Void

    enum LedgerEventStatus {
        case verified
        case warning
        case error

        var dotColor: Color {
            switch self {
            case .verified: return RMTheme.Colors.accent
            case .warning: return RMTheme.Colors.warning
            case .error: return RMTheme.Colors.error
            }
        }
    }

    var body: some View {
        Button(action: {
            Haptics.tap()
            onTap()
        }) {
            RMCard(useSolidSurface: true) {
                HStack(alignment: .top, spacing: 0) {
                    // Left timeline rail + dot
                    VStack(spacing: 0) {
                        Circle()
                            .fill(status.dotColor)
                            .frame(width: 8, height: 8)
                        Rectangle()
                            .fill(Color.white.opacity(0.06))
                            .frame(width: 1)
                            .frame(maxHeight: .infinity)
                    }
                    .frame(width: 12)

                    VStack(alignment: .leading, spacing: 6) {
                    HStack(alignment: .top, spacing: RMTheme.Spacing.sm) {
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 4) {
                                Text(title)
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundColor(RMTheme.Colors.textPrimary)
                                    .lineLimit(2)
                                if isVerified {
                                    Image(systemName: "checkmark.circle.fill")
                                        .font(.system(size: 12))
                                        .foregroundColor(RMTheme.Colors.accent)
                                }
                            }
                            Text(subtitle)
                                .font(RMTheme.Typography.secondaryLabelLarge)
                                .foregroundColor(RMTheme.Colors.textSecondary.opacity(0.63))
                                .lineLimit(1)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)

                        Text(timeText)
                            .font(RMTheme.Typography.metadataSmall)
                            .foregroundColor(RMTheme.Colors.textTertiary)
                    }

                    // Hash pill: SHA-256 · 2F3A…9C + copy
                    Button {
                        UIPasteboard.general.string = fullHash
                        Haptics.impact(.light)
                        ToastCenter.shared.show("Copied", systemImage: "doc.on.doc", style: .success)
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
                }
                    .padding(.leading, RMTheme.Spacing.sm)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .rmPressable(scale: 0.99, haptic: false, pressOpacity: 0.94)
        }
        .buttonStyle(.plain)
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
