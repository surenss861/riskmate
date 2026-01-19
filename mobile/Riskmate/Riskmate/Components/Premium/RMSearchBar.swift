import SwiftUI

/// System-native search bar component
struct RMSearchBar: View {
    @Binding var text: String
    let placeholder: String
    
    var body: some View {
        HStack(spacing: RMSystemTheme.Spacing.sm) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(RMSystemTheme.Colors.textTertiary)
                .font(.system(size: 16))
            
            TextField(placeholder, text: $text)
                .textInputAutocapitalization(.never)
                .foregroundStyle(RMSystemTheme.Colors.textPrimary)
                .font(RMSystemTheme.Typography.body)
        }
        .padding(.horizontal, RMSystemTheme.Spacing.md)
        .frame(height: 44) // System tap target
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
