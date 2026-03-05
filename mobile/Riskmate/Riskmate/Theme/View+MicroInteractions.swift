import SwiftUI

/// Micro-interactions for premium feel — uses Theme/Motion.swift for canonical timings.
extension View {
    /// Subtle spring animation for pill selection
    func pillSpring() -> some View {
        self.animation(RMMotion.spring, value: UUID())
    }
    
    /// Matched geometry effect for segmented controls/chips
    func matchedGeometry(id: String, in namespace: Namespace.ID) -> some View {
        self.matchedGeometryEffect(id: id, in: namespace)
    }
    
    /// Press feedback: scale + optional haptic. Use on buttons/cards. Use lightImpact: true for cards to avoid "vibratey" feel. Use pressOpacity for chips (e.g. 0.92) for subtle tactile feedback.
    func rmPressable(scale: CGFloat = 0.98, haptic: Bool = false, lightImpact: Bool = false, pressOpacity: CGFloat? = nil) -> some View {
        self.modifier(RMPressableModifier(scale: scale, haptic: haptic, lightImpact: lightImpact, pressOpacity: pressOpacity))
    }
    
    /// Staggered appear: opacity + y offset using RMMotion. Pass index for delay.
    func rmAppearIn(staggerIndex: Int = 0) -> some View {
        self.modifier(RMAppearInModifier(staggerIndex: staggerIndex))
    }
    
    /// Shimmer overlay for skeletons — subtle, uses RMMotion.shimmerDuration.
    func rmShimmer() -> some View {
        self.modifier(RMShimmerModifier())
    }
}

// MARK: - Pressable (scale + haptic + optional press opacity)
private struct RMPressableModifier: ViewModifier {
    let scale: CGFloat
    let haptic: Bool
    let lightImpact: Bool
    var pressOpacity: CGFloat?
    @State private var isPressed = false
    
    func body(content: Content) -> some View {
        content
            .scaleEffect(isPressed ? scale : 1.0)
            .opacity(pressOpacity != nil ? (isPressed ? pressOpacity! : 1.0) : 1.0)
            .animation(.easeOut(duration: 0.08), value: isPressed)
            .simultaneousGesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in
                        if !isPressed {
                            if haptic {
                                if lightImpact { Haptics.impact(.light) }
                                else { Haptics.tap() }
                            }
                            isPressed = true
                        }
                    }
                    .onEnded { _ in
                        isPressed = false
                    }
            )
    }
}

// MARK: - Staggered appear (no y-offset when Reduce Motion)
private struct RMAppearInModifier: ViewModifier {
    let staggerIndex: Int
    @State private var shown = false
    
    func body(content: Content) -> some View {
        content
            .opacity(shown ? 1 : 0)
            .offset(y: (RMMotion.reduceMotion ? 0 : (shown ? 0 : 8)))
            .animation(RMMotion.easeOut.delay(Double(staggerIndex) * RMMotion.staggerStep), value: shown)
            .onAppear { shown = true }
    }
}

// MARK: - Shimmer (skeleton only; Reduce Motion = static pulse, no sweep)
private struct RMShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = 0
    
    func body(content: Content) -> some View {
        content
            .overlay(
                Group {
                    if RMMotion.shimmerDuration > 0 {
                        GeometryReader { geo in
                            LinearGradient(
                                colors: [.clear, .white.opacity(RMMotion.shimmerOpacity), .clear],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                            .frame(width: geo.size.width * 1.5)
                            .offset(x: phase * geo.size.width * 1.5 - geo.size.width * 0.5)
                        }
                    } else {
                        Color.clear
                    }
                }
                .allowsHitTesting(false)
            )
            .onAppear {
                if RMMotion.shimmerDuration > 0 {
                    withAnimation(.linear(duration: RMMotion.shimmerDuration).repeatForever(autoreverses: false)) {
                        phase = 1
                    }
                }
            }
    }
}

/// Animated number transition for KPI deltas
struct AnimatedNumber: View {
    let value: Int
    @State private var displayedValue: Int = 0
    
    var body: some View {
        Text("\(displayedValue)")
            .onChange(of: value) { oldValue, newValue in
                withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) {
                    displayedValue = newValue
                }
            }
            .onAppear {
                displayedValue = value
            }
    }
}

/// Animated delta indicator
struct AnimatedDelta: View {
    let delta: Int
    @State private var displayedDelta: Int = 0
    
    var body: some View {
        HStack(spacing: 2) {
            Image(systemName: delta >= 0 ? "arrow.up" : "arrow.down")
                .font(.system(size: 10))
            
            Text("\(abs(displayedDelta))")
                .font(RMTheme.Typography.captionBold)
        }
        .foregroundColor(delta >= 0 ? RMTheme.Colors.error : RMTheme.Colors.success)
        .onChange(of: delta) { oldValue, newValue in
            withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) {
                displayedDelta = newValue
            }
        }
        .onAppear {
            displayedDelta = delta
        }
    }
}

/// Spring animation for segmented control selection
struct SpringSegmentedControl: View {
    @Binding var selection: String
    let options: [(String, String)] // (value, label)
    @Namespace private var namespace
    
    var body: some View {
        HStack(spacing: 0) {
            ForEach(options, id: \.0) { option in
                Button {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                        selection = option.0
                    }
                } label: {
                    Text(option.1)
                        .font(RMTheme.Typography.bodySmall)
                        .foregroundColor(selection == option.0 ? .black : RMTheme.Colors.textPrimary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, RMTheme.Spacing.sm)
                        .background(
                            Group {
                                if selection == option.0 {
                                    RoundedRectangle(cornerRadius: RMTheme.Radius.sm)
                                        .fill(RMTheme.Colors.accent)
                                        .matchedGeometryEffect(id: "selection", in: namespace)
                                }
                            }
                        )
                }
            }
        }
        .padding(4)
        .background(RMTheme.Colors.inputFill)
        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
    }
}
