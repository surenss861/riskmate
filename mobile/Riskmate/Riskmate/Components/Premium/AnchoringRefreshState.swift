import SwiftUI

/// Pull-to-refresh state with "Anchoring..." indicator
struct AnchoringRefreshState: View {
    @Binding var isRefreshing: Bool
    let onRefresh: () async -> Void
    
    var body: some View {
        if isRefreshing {
            HStack(spacing: RiskMateDesignSystem.Spacing.sm) {
                ProgressView()
                    .tint(RiskMateDesignSystem.Colors.accent)
                    .accessibilityLabel("Anchoring")
                
                Text("Anchoring...")
                    .font(RiskMateDesignSystem.Typography.bodySmall)
                    .foregroundColor(RiskMateDesignSystem.Colors.textSecondary)
            }
            .padding(RiskMateDesignSystem.Spacing.md)
            .frame(maxWidth: .infinity)
            .background(RiskMateDesignSystem.Colors.surface.opacity(0.5))
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Anchoring ledger records")
        }
    }
}

/// View modifier to add anchoring refresh state
struct AnchoringRefreshModifier: ViewModifier {
    @Binding var isRefreshing: Bool
    let onRefresh: () async -> Void
    @State private var refreshStartTime: Date?
    
    func body(content: Content) -> some View {
        content
            .refreshable {
                let startTime = Date()
                refreshStartTime = startTime
                isRefreshing = true
                RiskMateDesignSystem.Haptics.tap()
                Analytics.shared.trackRefreshTriggered()
                
                await onRefresh()
                
                // Only show "Anchoring..." if refresh took longer than 0.3s
                // If it completed instantly, don't show state
                let duration = Date().timeIntervalSince(startTime)
                if duration < 0.3 {
                    // Instant refresh - no state needed
                    isRefreshing = false
                } else {
                    // Show state for at least 0.5s total
                    let remainingDelay = max(0, 0.5 - duration)
                    try? await Task.sleep(nanoseconds: UInt64(remainingDelay * 1_000_000_000))
                    isRefreshing = false
                    
                    // Track duration
                    let totalMs = Int((Date().timeIntervalSince(startTime)) * 1000)
                    Analytics.shared.trackRefreshDuration(ms: totalMs)
                }
            }
            .overlay(alignment: .top) {
                if isRefreshing {
                    AnchoringRefreshState(isRefreshing: $isRefreshing, onRefresh: onRefresh)
                        .transition(.move(edge: .top).combined(with: .opacity))
                }
            }
            .onDisappear {
                // Cancel refresh state if view disappears
                isRefreshing = false
            }
    }
}

extension View {
    func anchoringRefresh(isRefreshing: Binding<Bool>, onRefresh: @escaping () async -> Void) -> some View {
        self.modifier(AnchoringRefreshModifier(isRefreshing: isRefreshing, onRefresh: onRefresh))
    }
}
