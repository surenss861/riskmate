import SwiftUI

/// Premium search bar component
struct RMSearchBar: View {
    @Binding var text: String
    let placeholder: String
    
    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(RMTheme.Colors.textTertiary)
                .font(.system(size: 16, weight: .medium))
            
            TextField(placeholder, text: $text)
                .textInputAutocapitalization(.never)
                .foregroundStyle(RMTheme.Colors.textPrimary)
                .font(RMTheme.Typography.body)
        }
        .padding(.horizontal, RMTheme.Spacing.lg)
        .frame(height: 52)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(RMTheme.Colors.inputFill)
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(RMTheme.Colors.inputStroke, lineWidth: 1)
                )
        )
    }
}
