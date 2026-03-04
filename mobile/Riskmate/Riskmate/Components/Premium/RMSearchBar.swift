import SwiftUI

/// System-native search bar component
struct RMSearchBar: View {
    @Binding var text: String
    let placeholder: String
    var showMic: Bool = true
    var voiceHint: String? = "Try saying: \"Show high risk jobs\""
    
    var body: some View {
        HStack(spacing: RMSystemTheme.Spacing.sm) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(RMSystemTheme.Colors.textTertiary)
                .font(.system(size: 16))
            
            TextField(placeholder, text: $text)
                .textInputAutocapitalization(.never)
                .foregroundStyle(RMSystemTheme.Colors.textPrimary)
                .font(RMSystemTheme.Typography.body)
            if showMic {
                Button {
                    Haptics.tap()
                    if let hint = voiceHint {
                        ToastCenter.shared.show(hint, systemImage: "mic.fill", style: .info)
                    }
                } label: {
                    Image(systemName: "mic.fill")
                        .font(.system(size: 18))
                        .foregroundStyle(RMTheme.Colors.accent)
                }
                .accessibilityLabel("Voice search hint")
            }
        }
        .padding(.horizontal, RMSystemTheme.Spacing.md)
        .frame(height: 44)
        .background(
            RoundedRectangle(cornerRadius: RMSystemTheme.Radius.md, style: .continuous)
                .fill(RMSystemTheme.Colors.secondaryBackground)
                .overlay(
                    RoundedRectangle(cornerRadius: RMSystemTheme.Radius.md, style: .continuous)
                        .stroke(RMSystemTheme.Colors.separator, lineWidth: 0.5)
                )
        )
    }
}
