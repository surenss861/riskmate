import SwiftUI

/// Quick action item for expanded FAB (ghost preview = label under icon).
private struct FABQuickAction: Identifiable {
    let id: String
    let icon: String
    let label: String
    let action: () -> Void
}

/// Floating Action Button: tap = Evidence; drag up or long-press = expand to Evidence / Task / Comment / Incident.
/// Haptic on snap; ghost preview (label) on each option.
struct FloatingEvidenceFAB: View {
    let action: () -> Void
    var onTask: (() -> Void)? = nil
    var onComment: (() -> Void)? = nil
    var onIncident: (() -> Void)? = nil

    @State private var isPressed = false
    @State private var isExpanded = false
    @State private var dragOffset: CGFloat = 0
    @State private var glowPulse: Double = 0.0
    @State private var highlightedIndex: Int? = nil
    @State private var hasFiredExpandHapticThisGesture = false
    @Environment(\.scenePhase) private var scenePhase

    private let expandThreshold: CGFloat = 44
    /// Resistance: effective drag = physical * factor (so user must drag farther to expand)
    private let dragResistance: CGFloat = 0.72
    private let fanStaggerStep: Double = 0.05

    private var quickActions: [FABQuickAction] {
        var list = [
            FABQuickAction(id: "evidence", icon: "camera.fill", label: "Evidence", action: action),
        ]
        if let onTask = onTask {
            list.append(FABQuickAction(id: "task", icon: "checkmark.circle.fill", label: "Task", action: onTask))
        }
        if let onComment = onComment {
            list.append(FABQuickAction(id: "comment", icon: "bubble.left.fill", label: "Comment", action: onComment))
        }
        if let onIncident = onIncident {
            list.append(FABQuickAction(id: "incident", icon: "exclamationmark.triangle.fill", label: "Incident", action: onIncident))
        }
        return list
    }

    var body: some View {
        VStack(spacing: 0) {
            // Expanded actions (above main FAB)
            if isExpanded {
                VStack(spacing: RMTheme.Spacing.sm) {
                    ForEach(Array(quickActions.dropFirst().enumerated()), id: \.element.id) { index, item in
                        Button {
                            item.action()
                            withAnimation(RMMotion.spring) { isExpanded = false }
                        } label: {
                            VStack(spacing: 4) {
                                Image(systemName: item.icon)
                                    .font(.system(size: 20, weight: .semibold))
                                Text(item.label)
                                    .font(RMTheme.Typography.caption2)
                            }
                            .foregroundColor(highlightedIndex == index ? .black : .white)
                            .frame(width: 56, height: 52)
                            .background(
                                Circle()
                                    .fill(RMSystemTheme.Colors.accent.opacity(highlightedIndex == index ? 1 : 0.9))
                            )
                        }
                        .buttonStyle(.plain)
                        .rmPressable(scale: 0.96, haptic: true)
                        .opacity(isExpanded ? 1 : 0)
                        .scaleEffect(isExpanded ? 1 : 0.8)
                        .animation(RMMotion.easeOut.delay(Double(index) * fanStaggerStep), value: isExpanded)
                    }
                }
                .padding(.bottom, RMTheme.Spacing.sm)
                .transition(.asymmetric(
                    insertion: .opacity.combined(with: .scale(scale: 0.95)),
                    removal: .opacity.combined(with: .scale(scale: 0.95))
                ))
            }

            // Main FAB
            Button {
                Haptics.impact(.medium)
                Analytics.shared.trackEvidenceCaptureStarted()
                Analytics.shared.trackAddEvidenceTapped()
                if UIAccessibility.isReduceMotionEnabled {
                    action()
                } else {
                    withAnimation(RMMotion.springPress) { isPressed = true }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                        withAnimation(RMMotion.springPress) { isPressed = false }
                        action()
                    }
                }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "camera.fill")
                        .font(.system(size: 18, weight: .semibold))
                    Text("Add Evidence")
                        .font(RMSystemTheme.Typography.bodyBold)
                }
                .foregroundColor(.black)
                .padding(.horizontal, 20)
                .padding(.vertical, 14)
                .background(
                    Capsule()
                        .fill(
                            LinearGradient(
                                colors: [RMSystemTheme.Colors.accent, RMSystemTheme.Colors.accent.opacity(0.8)],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .shadow(
                            color: RMSystemTheme.Colors.accent.opacity((0.34 + glowPulse * 0.17) * 0.85),
                            radius: (12 + glowPulse * 4) * 0.9,
                            x: 0,
                            y: 4
                        )
                )
                .scaleEffect(isPressed ? 0.95 : 1.0)
            }
            .buttonStyle(.plain)
            .simultaneousGesture(
                DragGesture(minimumDistance: 8) // so vertical scroll in scroll views isn’t stolen
                    .onChanged { value in
                        let up = -value.translation.height
                        let effectiveUp = up * dragResistance
                        dragOffset = up
                        if effectiveUp > expandThreshold && !isExpanded {
                            withAnimation(RMMotion.spring) { isExpanded = true }
                            if !hasFiredExpandHapticThisGesture {
                                hasFiredExpandHapticThisGesture = true
                                Haptics.tap()
                            }
                        } else if isExpanded && value.translation.height > 24 {
                            withAnimation(RMMotion.spring) { isExpanded = false }
                        }
                    }
                    .onEnded { _ in
                        dragOffset = 0
                        hasFiredExpandHapticThisGesture = false
                    }
            )
            .onLongPressGesture(minimumDuration: 0.35) {
                if !isExpanded {
                    withAnimation(RMMotion.spring) { isExpanded = true }
                    Haptics.tap()
                }
            }
        }
        .accessibilityLabel("Add Evidence")
        .accessibilityHint("Tap to add evidence. Long-press or drag up for more actions.")
        .onAppear { startGlowAnimation() }
        .onDisappear { stopGlowAnimation() }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .background || newPhase == .inactive { stopGlowAnimation() }
            else if newPhase == .active { startGlowAnimation() }
        }
    }

    private func startGlowAnimation() {
        if UIAccessibility.isReduceMotionEnabled {
            glowPulse = 0.5
        } else {
            withAnimation(.easeInOut(duration: 2.0).repeatForever(autoreverses: true)) {
                glowPulse = 1.0
            }
        }
    }

    private func stopGlowAnimation() {
        withAnimation(.linear(duration: 0.1)) { glowPulse = 0.5 }
    }
}

#Preview {
    ZStack {
        Color.black
        VStack {
            Spacer()
            HStack {
                Spacer()
                FloatingEvidenceFAB(
                    action: {},
                    onTask: {},
                    onComment: {},
                    onIncident: {}
                )
                .padding(.trailing, 20)
                .padding(.bottom, 100)
            }
        }
    }
}
