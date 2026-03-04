import SwiftUI

/// Dashboard hero: audit readiness score, risk delta (30d), last synced. Count-up gated so it doesn't replay on re-render; Reduce Motion = final values.
struct DashboardHeroStrip: View {
    let readinessScore: Int
    let delta30d: Int
    let lastSyncedAt: Date?
    var isSkeleton: Bool = false
    /// Optional: when provided, we only count-up when target differs from this (prevents replay on back/forward).
    var lastDisplayedScore: Binding<Int?>? = nil
    var lastDisplayedDelta: Binding<Int?>? = nil
    
    @State private var displayedScore: Int = 0
    @State private var displayedDelta: Int = 0
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: RMTheme.Spacing.xs) {
                        Text("Audit readiness")
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.textTertiary)
                        if isSkeleton {
                            RMSkeletonView(width: 56, height: 32, cornerRadius: RMTheme.Radius.xs, shimmer: false)
                        } else {
                            Text("\(displayedScore)")
                                .font(RMTheme.Typography.title)
                                .foregroundColor(RMTheme.Colors.textPrimary)
                                .contentTransition(.numericText())
                        }
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: RMTheme.Spacing.xs) {
                        Text("Risk delta (30d)")
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.textTertiary)
                        if isSkeleton {
                            RMSkeletonView(width: 48, height: 24, cornerRadius: RMTheme.Radius.xs, shimmer: false)
                        } else {
                            HStack(spacing: 2) {
                                Image(systemName: displayedDelta >= 0 ? "arrow.up.right" : "arrow.down.right")
                                    .font(.system(size: 10, weight: .semibold))
                                Text("\(abs(displayedDelta))")
                                    .font(RMTheme.Typography.bodySmallBold)
                            }
                            .foregroundColor(displayedDelta <= 0 ? RMTheme.Colors.success : RMTheme.Colors.error)
                            .contentTransition(.numericText())
                        }
                    }
                }
                
                if isSkeleton {
                    RMSkeletonView(width: 140, height: 14, cornerRadius: 4, shimmer: false)
                } else if let last = lastSyncedAt {
                    TimelineView(.periodic(from: Date(), by: 10)) { context in
                        Text("Last synced \(relativeTime(last, relativeTo: context.date))")
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.textTertiary)
                    }
                } else {
                    Text("Last synced —")
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.textTertiary)
                }
            }
            .padding(RMTheme.Spacing.md)
        }
        .onAppear {
            if isSkeleton { return }
            if RMMotion.reduceMotion {
                displayedScore = readinessScore
                displayedDelta = delta30d
                lastDisplayedScore?.wrappedValue = readinessScore
                lastDisplayedDelta?.wrappedValue = delta30d
                return
            }
            let alreadyShown = (lastDisplayedScore?.wrappedValue == readinessScore && lastDisplayedDelta?.wrappedValue == delta30d)
            if alreadyShown {
                displayedScore = readinessScore
                displayedDelta = delta30d
                return
            }
            let fromScore = lastDisplayedScore?.wrappedValue ?? 0
            let fromDelta = lastDisplayedDelta?.wrappedValue ?? 0
            displayedScore = fromScore
            displayedDelta = fromDelta
            lastDisplayedScore?.wrappedValue = readinessScore
            lastDisplayedDelta?.wrappedValue = delta30d
            withAnimation(RMMotion.easeOut) {
                displayedScore = readinessScore
                displayedDelta = delta30d
            }
        }
        .onChange(of: readinessScore) { old, new in
            guard !isSkeleton else { return }
            if RMMotion.reduceMotion {
                displayedScore = new
            } else {
                withAnimation(RMMotion.easeOut) {
                    displayedScore = new
                }
            }
            lastDisplayedScore?.wrappedValue = new
        }
        .onChange(of: delta30d) { old, new in
            guard !isSkeleton else { return }
            if RMMotion.reduceMotion {
                displayedDelta = new
            } else {
                withAnimation(RMMotion.easeOut) {
                    displayedDelta = new
                }
            }
            lastDisplayedDelta?.wrappedValue = new
        }
    }
    
    private func relativeTime(_ date: Date, relativeTo now: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: now)
    }
}

#Preview {
    VStack(spacing: 16) {
        DashboardHeroStrip(readinessScore: 78, delta30d: -3, lastSyncedAt: Date().addingTimeInterval(-120))
        DashboardHeroStrip(readinessScore: 0, delta30d: 0, lastSyncedAt: nil, isSkeleton: true)
    }
    .padding()
    .background(RMTheme.Colors.background)
}
