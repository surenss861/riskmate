import SwiftUI

/// Evidence progress ring: before/during/after segments + overall. Animates with RMMotion.easeOut (Reduce Motion = immediate).
struct RMEvidenceProgressRing: View {
    var beforePct: Double = 0
    var duringPct: Double = 0
    var afterPct: Double = 0
    var overallPct: Double = 0
    
    private let lineWidth: CGFloat = 6
    private let size: CGFloat = 72
    
    var body: some View {
        ZStack {
            // Background ring
            Circle()
                .stroke(RMTheme.Colors.inputFill, lineWidth: lineWidth)
            
            // Overall progress ring (single arc)
            Circle()
                .trim(from: 0, to: min(1, max(0, overallPct / 100)))
                .stroke(
                    RMTheme.Colors.accent,
                    style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .animation(RMMotion.reduceMotion ? nil : RMMotion.easeOut, value: overallPct)
        }
        .frame(width: size, height: size)
    }
}

#Preview {
    VStack(spacing: 24) {
        RMEvidenceProgressRing(overallPct: 0)
        RMEvidenceProgressRing(overallPct: 60)
        RMEvidenceProgressRing(overallPct: 100)
    }
    .padding()
    .background(RMTheme.Colors.background)
}
