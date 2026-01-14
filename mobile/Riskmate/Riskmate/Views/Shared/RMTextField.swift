import SwiftUI

/// RiskMate text field - matches web app input styling (light fill, dark text)
struct RMTextField: View {
    let title: String
    @Binding var text: String
    var isSecure: Bool = false
    var keyboardType: UIKeyboardType = .default
    var textContentType: UITextContentType?
    
    var body: some View {
        Group {
            if isSecure {
                SecureField(title, text: $text)
                    .textContentType(textContentType ?? .password)
            } else {
                TextField(title, text: $text)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(keyboardType)
                    .textContentType(textContentType ?? .emailAddress)
            }
        }
        .font(.system(size: 16, weight: .medium))
        .foregroundColor(Color(hex: "#0A0A0A"))
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color(hex: "#F2F4F7")) // web-like light input
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Color.black.opacity(0.08), lineWidth: 1)
        )
    }
}

#Preview {
    RMBackground()
        .overlay {
            VStack(spacing: 16) {
                RMTextField(title: "Email", text: .constant(""))
                RMTextField(title: "Password", text: .constant(""), isSecure: true)
            }
            .padding()
        }
}
