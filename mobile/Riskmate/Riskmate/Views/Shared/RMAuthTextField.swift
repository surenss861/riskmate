import SwiftUI

/// RiskMate auth text field - dark, native, focus ring, icon, reveal toggle
struct RMAuthTextField: View {
    let title: String
    @Binding var text: String
    var icon: String
    var isSecure: Bool = false
    var keyboardType: UIKeyboardType = .default
    var textContentType: UITextContentType? = nil
    
    @FocusState private var focused: Bool
    @State private var reveal: Bool = false
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(.white.opacity(0.55))
                .frame(width: 18)
            
            Group {
                if isSecure && !reveal {
                    SecureField("", text: $text)
                        .textContentType(textContentType ?? .password)
                        .focused($focused)
                } else {
                    TextField("", text: $text)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(keyboardType)
                        .textContentType(textContentType)
                        .focused($focused)
                }
            }
            .foregroundColor(RMTheme.Colors.textPrimary)
            .font(RMTheme.Typography.body)
            .tint(RMTheme.Colors.accent)
            .placeholder(when: text.isEmpty) {
                Text(title)
                    .foregroundColor(RMTheme.Colors.textPlaceholder)
                    .font(RMTheme.Typography.body)
            }
            
            if isSecure {
                Button { reveal.toggle() } label: {
                    Image(systemName: reveal ? "eye.slash" : "eye")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.white.opacity(0.55))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, RMTheme.Spacing.md)
        .padding(.vertical, 14)
        .background(
            RoundedRectangle(cornerRadius: RMTheme.Radius.sm, style: .continuous)
                .fill(RMTheme.Colors.inputFill)
        )
        .overlay(
            RoundedRectangle(cornerRadius: RMTheme.Radius.sm, style: .continuous)
                .stroke(
                    focused
                    ? RMTheme.Colors.inputStrokeFocused
                    : RMTheme.Colors.inputStroke,
                    lineWidth: focused ? 1.6 : 1
                )
        )
        .animation(.spring(response: 0.22, dampingFraction: 0.9), value: focused)
    }
}

// Simple placeholder helper
private extension View {
    @ViewBuilder
    func placeholder<Content: View>(
        when shouldShow: Bool,
        alignment: Alignment = .leading,
        @ViewBuilder content: () -> Content
    ) -> some View {
        ZStack(alignment: alignment) {
            content().opacity(shouldShow ? 1 : 0)
            self
        }
    }
}

#Preview {
    RMBackground()
        .overlay {
            VStack(spacing: 16) {
                RMAuthTextField(
                    title: "Email",
                    text: .constant(""),
                    icon: "envelope"
                )
                RMAuthTextField(
                    title: "Password",
                    text: .constant(""),
                    icon: "lock",
                    isSecure: true
                )
            }
            .padding()
        }
}
