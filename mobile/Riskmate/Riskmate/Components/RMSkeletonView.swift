import SwiftUI

/// Skeleton loader for premium loading states
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
            .fill(
                LinearGradient(
                    colors: [
                        RMTheme.Colors.inputFill,
                        RMTheme.Colors.inputFill.opacity(0.5),
                        RMTheme.Colors.inputFill
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .frame(width: width, height: height)
            .cornerRadius(cornerRadius)
            .overlay {
                // Shimmer effect
                GeometryReader { geometry in
                    LinearGradient(
                        colors: [
                            .clear,
                            .white.opacity(0.1),
                            .clear
                        ],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(width: geometry.size.width * 2)
                    .offset(x: isAnimating ? geometry.size.width : -geometry.size.width)
                }
            }
            .onAppear {
                withAnimation(
                    Animation.linear(duration: 1.5)
                        .repeatForever(autoreverses: false)
                ) {
                    isAnimating = true
                }
            }
    }
}

// MARK: - Skeleton Card Components

struct RMSkeletonCard: View {
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                RMSkeletonView(width: 120, height: 16)
                RMSkeletonView(width: 80, height: 24)
                RMSkeletonView(width: nil, height: 12)
            }
            .padding(RMTheme.Spacing.md)
        }
    }
}

struct RMSkeletonListRow: View {
    var body: some View {
        HStack(spacing: RMTheme.Spacing.md) {
            RMSkeletonView(width: 40, height: 40, cornerRadius: 8)
            
            VStack(alignment: .leading, spacing: RMTheme.Spacing.xs) {
                RMSkeletonView(width: 200, height: 16)
                RMSkeletonView(width: 150, height: 12)
            }
            
            Spacer()
            
            RMSkeletonView(width: 60, height: 20, cornerRadius: 10)
        }
        .padding(RMTheme.Spacing.md)
        .background(RMTheme.Colors.surface.opacity(0.3))
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
    
    var body: some View {
        VStack(spacing: RMTheme.Spacing.sm) {
            ForEach(0..<count, id: \.self) { _ in
                RMSkeletonListRow()
            }
        }
        .padding(.horizontal, RMTheme.Spacing.md)
    }
}
