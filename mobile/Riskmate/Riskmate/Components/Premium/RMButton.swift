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
            Haptics.tap()
            action()
        } label: {
            HStack(spacing: 10) {
                if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 16, weight: .semibold))
                }
                Text(title)
                    .font(RMSystemTheme.Typography.bodyBold)
            }
            .foregroundStyle(foregroundColor)
            .frame(maxWidth: .infinity, minHeight: 44) // System tap target
            .background(
                RoundedRectangle(cornerRadius: RMSystemTheme.Radius.md, style: .continuous)
                    .fill(backgroundColor)
                    .overlay(
                        RoundedRectangle(cornerRadius: RMSystemTheme.Radius.md, style: .continuous)
                            .stroke(borderColor, lineWidth: style == .secondary ? 0.5 : 0)
                    )
            )
            .scaleEffect(pressed ? 0.98 : 1.0)
            .opacity(pressed ? 0.92 : 1.0)
            .animation(.easeOut(duration: 0.2), value: pressed)
        }
        .buttonStyle(.plain)
        .pressEvents { isDown in
            pressed = isDown
        }
    }
    
    private var foregroundColor: Color {
        switch style {
        case .primary:
            return .white
        case .secondary:
            return RMSystemTheme.Colors.accent
        case .danger:
            return .white
        }
    }
    
    private var backgroundColor: Color {
        switch style {
        case .primary:
            return RMSystemTheme.Colors.accent
        case .secondary:
            return RMSystemTheme.Colors.secondaryBackground
        case .danger:
            return RMSystemTheme.Colors.error
        }
    }
    
    private var borderColor: Color {
        switch style {
        case .primary:
            return .clear
        case .secondary:
            return RMSystemTheme.Colors.separator
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
