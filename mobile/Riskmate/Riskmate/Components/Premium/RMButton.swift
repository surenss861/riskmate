import SwiftUI

/// Premium button component with press animations and styles
enum RMButtonStyle {
    case primary
    case secondary
    case danger
}

struct RMButton: View {
    let title: String
    let icon: String?
    let style: RMButtonStyle
    let action: () -> Void
    
    @State private var pressed = false
    
    init(title: String, icon: String? = nil, style: RMButtonStyle = .primary, action: @escaping () -> Void) {
        self.title = title
        self.icon = icon
        self.style = style
        self.action = action
    }
    
    var body: some View {
        Button {
            action()
        } label: {
            HStack(spacing: 10) {
                if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 16, weight: .semibold))
                }
                Text(title)
                    .font(.system(size: 17, weight: .semibold, design: .rounded))
            }
            .foregroundStyle(foregroundColor)
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(backgroundColor)
                    .overlay(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .stroke(borderColor, lineWidth: 1)
                    )
            )
            .scaleEffect(pressed ? 0.98 : 1.0)
            .opacity(pressed ? 0.90 : 1.0)
            .animation(.spring(response: 0.22, dampingFraction: 0.85), value: pressed)
        }
        .buttonStyle(.plain)
        .pressEvents { isDown in
            pressed = isDown
        }
    }
    
    private var foregroundColor: Color {
        switch style {
        case .primary:
            return .black
        case .secondary:
            return RMTheme.Colors.accent
        case .danger:
            return .white
        }
    }
    
    private var backgroundColor: Color {
        switch style {
        case .primary:
            return RMTheme.Colors.accent
        case .secondary:
            return RMTheme.Colors.surface.opacity(0.6)
        case .danger:
            return RMTheme.Colors.error.opacity(0.8)
        }
    }
    
    private var borderColor: Color {
        switch style {
        case .primary:
            return .clear
        case .secondary:
            return RMTheme.Colors.border
        case .danger:
            return .clear
        }
    }
}

// MARK: - Press Events Helper

private struct PressEvents: ViewModifier {
    let onChange: (Bool) -> Void
    
    func body(content: Content) -> some View {
        content
            .simultaneousGesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in onChange(true) }
                    .onEnded { _ in onChange(false) }
            )
    }
}

private extension View {
    func pressEvents(_ onChange: @escaping (Bool) -> Void) -> some View {
        modifier(PressEvents(onChange: onChange))
    }
}
