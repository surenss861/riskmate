import SwiftUI

/// Reusable search field: 46pt height, 14pt padding, themed input background/stroke.
/// Matches Work Records style, with improved contrast and optional clear affordance.
struct RMSearchField: View {
    let placeholder: String
    @Binding var text: String

    @FocusState private var isFocused: Bool

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(isFocused ? RMTheme.Colors.textSecondary : RMTheme.Colors.textTertiary)

            TextField("", text: $text, prompt:
                Text(placeholder)
                    .foregroundColor(RMTheme.Colors.textPlaceholder)
            )
            .focused($isFocused)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled(true)
            .foregroundColor(RMTheme.Colors.textPrimary)
            .font(RMTheme.Typography.body)
            .submitLabel(.search)

            if !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Button {
                    text = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(RMTheme.Colors.textTertiary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
                .animation(.none, value: text)
            }
        }
        .padding(.horizontal, 14)
        .frame(height: 46)
        .background(RMTheme.Colors.inputFill)
        .clipShape(
            RoundedRectangle(
                cornerRadius: RMTheme.Radius.sm,
                style: .continuous
            )
        )
        .overlay(
            RoundedRectangle(
                cornerRadius: RMTheme.Radius.sm,
                style: .continuous
            )
            .strokeBorder(
                isFocused ? RMTheme.Colors.inputStrokeFocused : RMTheme.Colors.inputStroke,
                lineWidth: 1
            )
        )
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Search jobs")
    }
}
