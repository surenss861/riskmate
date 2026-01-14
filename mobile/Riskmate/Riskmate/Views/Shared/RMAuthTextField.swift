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
            .foregroundColor(.white)
            .font(.system(size: 16, weight: .medium))
            .tint(Color(hex: "#F97316"))
            .placeholder(when: text.isEmpty) {
                Text(title)
                    .foregroundColor(.white.opacity(0.38))
                    .font(.system(size: 16, weight: .medium))
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
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color.white.opacity(0.06))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(
                    focused
                    ? Color(hex: "#F97316").opacity(0.55)
                    : Color.white.opacity(0.12),
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
                    systemImage: "envelope",
                    text: .constant("")
                )
                RMAuthTextField(
                    title: "Password",
                    systemImage: "lock",
                    text: .constant(""),
                    isSecure: true
                )
            }
            .padding()
        }
}
