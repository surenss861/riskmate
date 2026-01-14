import SwiftUI

/// RiskMate auth text field - dark, native, focus ring, icon
struct RMAuthTextField: View {
    let title: String
    let systemImage: String
    @Binding var text: String
    var isSecure: Bool = false
    var keyboardType: UIKeyboardType = .default
    var textContentType: UITextContentType?
    
    @FocusState private var isFocused: Bool
    
    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: systemImage)
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(.white.opacity(0.55))
                .frame(width: 20)
            
            Group {
                if isSecure {
                    SecureField(title, text: $text)
                        .textContentType(textContentType ?? .password)
                        .focused($isFocused)
                } else {
                    TextField(title, text: $text)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(keyboardType)
                        .textContentType(textContentType ?? .emailAddress)
                        .focused($isFocused)
                }
            }
            .foregroundColor(.white)
            .font(.system(size: 16, weight: .medium))
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 14)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color.white.opacity(0.06)) // dark field (native vibe)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(isFocused ? Color(hex: "#F97316").opacity(0.75) : Color.white.opacity(0.10), lineWidth: 1)
        )
        .animation(.easeOut(duration: 0.16), value: isFocused)
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
