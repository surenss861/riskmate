import SwiftUI

struct DeleteAccountSheet: View {
    @Binding var isPresented: Bool
    let onConfirm: () -> Void
    let isDeleting: Bool
    
    @State private var confirmationText = ""
    @FocusState private var isTextFieldFocused: Bool
    
    private var canDelete: Bool {
        confirmationText.uppercased() == "DELETE"
    }
    
    var body: some View {
        NavigationStack {
            VStack(spacing: RMTheme.Spacing.xl) {
                // Warning icon
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 64))
                    .foregroundColor(RMTheme.Colors.error)
                    .padding(.top, RMTheme.Spacing.xl)
                
                VStack(spacing: RMTheme.Spacing.md) {
                    Text("Delete Account")
                        .font(RMTheme.Typography.title)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    
                    Text("This will permanently delete your account and all associated data. This action cannot be undone.")
                        .font(RMTheme.Typography.body)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, RMTheme.Spacing.lg)
                }
                
                VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                    Text("Type DELETE to confirm:")
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.textTertiary)
                    
                    TextField("DELETE", text: $confirmationText)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .textFieldStyle(.plain)
                        .padding(RMTheme.Spacing.md)
                        .background(RMTheme.Colors.surface.opacity(0.5))
                        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.md))
                        .overlay {
                            RoundedRectangle(cornerRadius: RMTheme.Radius.md)
                                .stroke(canDelete ? RMTheme.Colors.error.opacity(0.5) : RMTheme.Colors.divider.opacity(0.3), lineWidth: 1)
                        }
                        .focused($isTextFieldFocused)
                }
                .padding(.horizontal, RMTheme.Spacing.lg)
                
                Spacer()
                
                VStack(spacing: RMTheme.Spacing.md) {
                    Button {
                        Haptics.warning()
                        onConfirm()
                    } label: {
                        if isDeleting {
                            HStack {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                Text("Deleting...")
                            }
                        } else {
                            Text("Delete Account")
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(RMTheme.Spacing.md)
                    .background(canDelete ? RMTheme.Colors.error : RMTheme.Colors.error.opacity(0.5))
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.md))
                    .disabled(!canDelete || isDeleting)
                    
                    Button {
                        Haptics.tap()
                        isPresented = false
                    } label: {
                        Text("Cancel")
                            .frame(maxWidth: .infinity)
                            .padding(RMTheme.Spacing.md)
                            .background(RMTheme.Colors.surface.opacity(0.5))
                            .foregroundColor(RMTheme.Colors.textPrimary)
                            .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.md))
                    }
                    .disabled(isDeleting)
                }
                .padding(.horizontal, RMTheme.Spacing.lg)
                .padding(.bottom, RMTheme.Spacing.lg)
            }
            .background(RMBackground())
            .navigationTitle("Delete Account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Cancel") {
                        Haptics.tap()
                        isPresented = false
                    }
                    .disabled(isDeleting)
                }
            }
            .onAppear {
                // Focus text field when sheet appears
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    isTextFieldFocused = true
                }
            }
        }
        .preferredColorScheme(.dark)
    }
}
