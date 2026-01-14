import SwiftUI

/// RiskMate text field - clean iOS feel (still matches web brightness)
struct RMTextField: View {
    let title: String
    @Binding var text: String
    var isSecure: Bool = false
    var keyboardType: UIKeyboardType = .default
    var textContentType: UITextContentType?
    
    @FocusState private var isFocused: Bool
    
    var body: some View {
        Group {
            if isSecure {
                SecureField("", text: $text, prompt: Text(title).foregroundStyle(Color.black.opacity(0.45)))
                    .focused($isFocused)
                    .textContentType(textContentType ?? .password)
            } else {
                TextField("", text: $text, prompt: Text(title).foregroundStyle(Color.black.opacity(0.45)))
                    .focused($isFocused)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(keyboardType)
                    .textContentType(textContentType ?? .emailAddress)
            }
        }
        .font(.system(size: 16, weight: .medium))
        .foregroundStyle(Color(hex: "#0A0A0A"))
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color(hex: "#F2F4F7"))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(isFocused ? Color(hex: "#F97316").opacity(0.55) : Color.black.opacity(0.08), lineWidth: 1.2)
        )
        .animation(.easeOut(duration: 0.16), value: isFocused)
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
