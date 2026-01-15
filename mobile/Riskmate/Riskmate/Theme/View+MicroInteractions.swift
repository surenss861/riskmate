import SwiftUI

/// Micro-interactions for premium feel
extension View {
    /// Subtle spring animation for pill selection
    func pillSpring() -> some View {
        self.animation(.spring(response: 0.3, dampingFraction: 0.7), value: UUID())
    }
    
    /// Matched geometry effect for segmented controls/chips
    func matchedGeometry(id: String, in namespace: Namespace.ID) -> some View {
        self.matchedGeometryEffect(id: id, in: namespace)
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
