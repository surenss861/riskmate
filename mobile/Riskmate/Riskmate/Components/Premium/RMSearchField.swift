import SwiftUI

/// Reusable search field: 46pt height, 14pt padding, inputFill background. Matches Work Records style (no glow).
struct RMSearchField: View {
    let placeholder: String
    @Binding var text: String

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(RMTheme.Colors.textTertiary)
            TextField(placeholder, text: $text)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled(true)
                .foregroundColor(RMTheme.Colors.textPrimary)
                .font(RMTheme.Typography.body)
        }
        .padding(.horizontal, 14)
        .frame(height: 46)
        .background(RMTheme.Colors.inputFill)
        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: RMTheme.Radius.sm, style: .continuous)
                .strokeBorder(Color.white.opacity(0.06), lineWidth: 1)
        )
    }
}
