import SwiftUI

/// Skeleton loader for premium loading states. Align to final layout; subtle shimmer; use varied widths.
struct RMSkeletonView: View {
    let width: CGFloat?
    let height: CGFloat
    var cornerRadius: CGFloat = RMTheme.Radius.sm
    
    init(width: CGFloat? = nil, height: CGFloat, cornerRadius: CGFloat = RMTheme.Radius.sm) {
        self.width = width
        self.height = height
        self.cornerRadius = cornerRadius
    }
    
    @State private var isAnimating = false
    
    var body: some View {
        Rectangle()
            .fill(RMTheme.Colors.inputFill)
            .frame(width: width, height: height)
            .cornerRadius(cornerRadius)
            .rmShimmer()
    }
}

/// Skeleton with a fixed width multiplier (e.g. 0.7 = 70% of container) for varied, layout-aligned widths.
struct RMSkeletonViewVaried: View {
    let widthFraction: CGFloat?
    let height: CGFloat
    var cornerRadius: CGFloat = RMTheme.Radius.sm
    
    init(widthFraction: CGFloat? = nil, height: CGFloat, cornerRadius: CGFloat = RMTheme.Radius.sm) {
        self.widthFraction = widthFraction
        self.height = height
        self.cornerRadius = cornerRadius
    }
    
    var body: some View {
        GeometryReader { geo in
            RMSkeletonView(
                width: widthFraction.map { geo.size.width * $0 },
                height: height,
                cornerRadius: cornerRadius
            )
        }
        .frame(height: height)
    }
}

// MARK: - Skeleton Card Components

struct RMSkeletonCard: View {
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                RMSkeletonView(width: 100, height: 14)
                RMSkeletonView(width: 160, height: 22)
                RMSkeletonView(width: nil, height: 12)
                RMSkeletonView(width: 220, height: 12)
            }
            .padding(RMTheme.Spacing.md)
        }
    }
}

struct RMSkeletonListRow: View {
    /// Title line width (varied per row so it doesn’t look like a template).
    var titleWidth: CGFloat = 200
    var subtitleWidth: CGFloat = 140
    
    var body: some View {
        HStack(spacing: RMTheme.Spacing.md) {
            RMSkeletonView(width: 44, height: 44, cornerRadius: 10)
            VStack(alignment: .leading, spacing: RMTheme.Spacing.xs) {
                RMSkeletonView(width: titleWidth, height: 16)
                RMSkeletonView(width: subtitleWidth, height: 12)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            RMSkeletonView(width: 52, height: 24, cornerRadius: 8)
        }
        .padding(RMTheme.Spacing.md)
        .background(RMTheme.Colors.surface.opacity(0.35))
        .cornerRadius(RMTheme.Radius.md)
    }
}

// MARK: - Skeleton Grids

struct RMSkeletonKPIGrid: View {
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: RMTheme.Spacing.md) {
                ForEach(0..<3) { _ in
                    RMSkeletonCard()
                        .frame(width: 200)
                }
            }
            .padding(.horizontal, RMTheme.Spacing.md)
        }
    }
}

struct RMSkeletonList: View {
    let count: Int
    
    init(count: Int = 5) {
        self.count = count
    }
    
    private static let titleWidths: [CGFloat] = [220, 160, 190, 140, 205, 170, 180, 155]
    private static let subtitleWidths: [CGFloat] = [150, 120, 130, 100, 140, 110, 125, 115]
    
    var body: some View {
        VStack(spacing: RMTheme.Spacing.sm) {
            ForEach(0..<count, id: \.self) { i in
                RMSkeletonListRow(
                    titleWidth: Self.titleWidths[i % Self.titleWidths.count],
                    subtitleWidth: Self.subtitleWidths[i % Self.subtitleWidths.count]
                )
            }
        }
        .padding(.horizontal, RMTheme.Spacing.md)
    }
}
