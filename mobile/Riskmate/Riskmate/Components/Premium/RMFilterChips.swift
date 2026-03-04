import SwiftUI

/// Quick filter chips for Jobs list: High Risk, Blockers, Needs Signature, Recent.
/// Selection uses RMMotion.spring; chips use rmPressable(scale: 0.98, haptic: true).
enum JobsQuickFilter: String, CaseIterable {
    case highRisk = "highRisk"
    case blockers = "blockers"
    case needsSignature = "needsSignature"
    case recent = "recent"

    var title: String {
        switch self {
        case .highRisk: return "High Risk"
        case .blockers: return "Blockers"
        case .needsSignature: return "Needs Signature"
        case .recent: return "Recent"
        }
    }

    var icon: String {
        switch self {
        case .highRisk: return "exclamationmark.triangle.fill"
        case .blockers: return "hand.raised.fill"
        case .needsSignature: return "signature"
        case .recent: return "clock.fill"
        }
    }
}

struct RMFilterChips: View {
    @Binding var selection: JobsQuickFilter?
    var namespace: Namespace.ID?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: RMTheme.Spacing.sm) {
                ForEach(JobsQuickFilter.allCases, id: \.self) { chip in
                    let isSelected = selection == chip
                    Button {
                        withAnimation(RMMotion.spring) {
                            selection = isSelected ? nil : chip
                        }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: chip.icon)
                                .font(.system(size: 12, weight: .semibold))
                            Text(chip.title)
                                .font(RMTheme.Typography.captionBold)
                        }
                        .foregroundColor(isSelected ? .black : RMTheme.Colors.textSecondary)
                        .padding(.horizontal, RMTheme.Spacing.md)
                        .padding(.vertical, RMTheme.Spacing.sm)
                        .background {
                            Group {
                                if isSelected {
                                    Capsule()
                                        .fill(RMTheme.Colors.accent)
                                } else {
                                    Capsule()
                                        .fill(RMTheme.Colors.inputFill)
                                }
                            }
                            .modifier(OptionalMatchedGeometry(id: "quickChip", isActive: isSelected, namespace: namespace))
                        }
                    }
                    .buttonStyle(.plain)
                    .rmPressable(scale: 0.98, haptic: true)
                }
            }
        }
    }
}

private struct OptionalMatchedGeometry: ViewModifier {
    let id: String
    let isActive: Bool
    let namespace: Namespace.ID?
    func body(content: Content) -> some View {
        if isActive, let ns = namespace {
            content.matchedGeometryEffect(id: id, in: ns)
        } else {
            content
        }
    }
}

#Preview {
    struct PreviewHolder: View {
        @Namespace private var ns
        var body: some View {
            VStack {
                RMFilterChips(selection: .constant(nil), namespace: ns)
                RMFilterChips(selection: .constant(.highRisk), namespace: ns)
            }
            .padding()
            .background(RMTheme.Colors.background)
        }
    }
    return PreviewHolder()
}
