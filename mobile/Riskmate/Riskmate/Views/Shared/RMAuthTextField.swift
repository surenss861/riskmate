import SwiftUI

/// RiskMate auth text field - dark, native, focus ring, icon, reveal toggle
struct RMAuthTextField: View {
    let title: String
    @Binding var text: String
    var icon: String
    var isSecure: Bool = false
    var keyboardType: UIKeyboardType = .default
    var textContentType: UITextContentType? = nil
    var onSubmit: (() -> Void)? = nil
    var focused: Binding<Bool>? = nil
    
    @FocusState private var internalFocused: Bool
    @State private var reveal: Bool = false
    @State private var eyeIconScale: CGFloat = 1.0
    
    private var isFocused: Bool {
        focused?.wrappedValue ?? internalFocused
    }
    
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
                        .focused($internalFocused)
                        .submitLabel(.next)
                        .onSubmit {
                            onSubmit?()
                        }
                } else {
                    TextField("", text: $text)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(keyboardType)
                        .textContentType(textContentType)
                        .focused($internalFocused)
                        .submitLabel(.next)
                        .onSubmit {
                            onSubmit?()
                        }
                }
            }
            .onChange(of: internalFocused) { oldValue, newValue in
                // Sync internal focus state to external binding
                focused?.wrappedValue = newValue
            }
            .onAppear {
                // Initial sync from external binding to internal state
                if let focused = focused {
                    internalFocused = focused.wrappedValue
                }
            }
            .task(id: focused?.wrappedValue) {
                // Sync external binding changes to internal state
                if let focused = focused, focused.wrappedValue != internalFocused {
                    internalFocused = focused.wrappedValue
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
                Button {
                    // Haptic + animated scale pop (respects Reduce Motion)
                    Haptics.tap()
                    if UIAccessibility.isReduceMotionEnabled {
                        reveal.toggle()
                    } else {
                        withAnimation(.spring(response: 0.2, dampingFraction: 0.6)) {
                            eyeIconScale = 1.2
                        }
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                            withAnimation(.spring(response: 0.2, dampingFraction: 0.6)) {
                                eyeIconScale = 1.0
                                reveal.toggle()
                            }
                        }
                    }
                } label: {
                    Image(systemName: reveal ? "eye.slash" : "eye")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.white.opacity(0.55))
                        .scaleEffect(eyeIconScale)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(reveal ? "Hide password" : "Show password")
                .accessibilityHint("Double tap to toggle password visibility")
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
                    isFocused
                    ? RMTheme.Colors.inputStrokeFocused
                    : RMTheme.Colors.inputStroke,
                    lineWidth: isFocused ? 1.6 : 1
                )
        )
        .scaleEffect(isFocused ? 1.01 : 1.0) // Subtle card lift on focus
        .shadow(
            color: isFocused ? RMTheme.Colors.accent.opacity(0.15) : Color.clear,
            radius: isFocused ? 8 : 0,
            x: 0,
            y: isFocused ? 2 : 0
        )
        .animation(.spring(response: 0.22, dampingFraction: 0.9), value: isFocused)
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
