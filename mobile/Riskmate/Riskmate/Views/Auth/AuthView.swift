import SwiftUI

/// Canonical auth screen when logged out. Uses AuthHeroShell (hero + compact card + bottom utility).
/// This is the ONLY login/signup UI; ContentView presents AuthView() when !sessionManager.isAuthenticated.
/// This file does NOT contain "Welcome Back" — headlines are "Audit-ready proof packs." / "Compliance you can defend."
/// If you see "Welcome Back" on device, you are running a different AuthView (wrong target or duplicate file).
struct AuthView: View {
    @StateObject private var sessionManager = SessionManager.shared

    @State private var isSignup = false
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var errorText: String?
    @FocusState private var focusedField: Field?

    enum Field {
        case email, password, confirmPassword
    }

    var body: some View {
        AuthHeroShell(
            title: isSignup ? "Compliance you can defend." : "Audit-ready proof packs.",
            subtitle: isSignup
                ? "Create your org. Invite your team. Export proof."
                : "Secure access to your compliance ledger.",
            pillText: "Ledger Contract v1.0 • Frozen",
            content: {
                VStack(alignment: .leading, spacing: 12) {
                    RMAuthTextField(
                        title: "Email",
                        text: $email,
                        icon: "envelope",
                        isSecure: false,
                        keyboardType: .emailAddress,
                        textContentType: .emailAddress,
                        onSubmit: { if !email.isEmpty { focusedField = .password } },
                        focused: focusBinding(.email)
                    )

                    RMAuthTextField(
                        title: "Password",
                        text: $password,
                        icon: "lock",
                        isSecure: true,
                        keyboardType: .default,
                        textContentType: isSignup ? .newPassword : .password,
                        onSubmit: {
                            if !email.isEmpty && !password.isEmpty { handleSubmit() }
                        },
                        focused: focusBinding(.password)
                    )

                    if isSignup {
                        RMAuthTextField(
                            title: "Confirm Password",
                            text: $confirmPassword,
                            icon: "lock",
                            isSecure: true,
                            keyboardType: .default,
                            textContentType: .newPassword,
                            onSubmit: {
                                if !email.isEmpty && !password.isEmpty && !confirmPassword.isEmpty { handleSubmit() }
                            },
                            focused: focusBinding(.confirmPassword)
                        )
                        Text("Minimum 6 characters")
                            .font(.caption)
                            .foregroundColor(RMTheme.Colors.textTertiary)
                            .padding(.leading, 2)
                    }

                    if let errorText = errorText {
                        HStack(spacing: RMTheme.Spacing.sm) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.system(size: 12, weight: .semibold))
                            Text(errorText)
                                .font(RMTheme.Typography.bodySmallBold)
                        }
                        .foregroundColor(RMTheme.Colors.error)
                    }

                    AuthPrimaryCTA(
                        title: isSignup ? "Create Account" : "Sign In",
                        isLoading: sessionManager.isLoading,
                        isDisabled: email.isEmpty || password.isEmpty || (isSignup && confirmPassword.isEmpty),
                        action: handleSubmit
                    )
                    .padding(.top, 4)
                }
            },
            bottomUtility: {
                VStack(spacing: 10) {
                    HStack {
                        Text(isSignup ? "Already have an account?" : "Don't have an account?")
                            .foregroundColor(RMTheme.Colors.textSecondary)
                            .font(RMTheme.Typography.body)
                        Button(isSignup ? "Log in" : "Sign up") {
                            Haptics.tap()
                            toggleMode()
                        }
                        .foregroundColor(RMTheme.Colors.accent)
                        .font(RMTheme.Typography.bodyBold)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    HStack {
                        if !isSignup {
                            Button(action: { /* TODO: forgot password */ }) {
                                Text("Forgot password?")
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundColor(RMTheme.Colors.textSecondary)
                            }
                        }
                        Spacer()
                        Button(action: { /* TODO: need help */ }) {
                            Text("Need help?")
                                .font(.caption)
                                .foregroundColor(RMTheme.Colors.textTertiary)
                        }
                    }

                    if isSignup {
                        Text("By signing up, you agree to our Terms and Privacy Policy")
                            .font(.caption)
                            .foregroundColor(RMTheme.Colors.textTertiary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }
        )
        .scrollDismissesKeyboard(.interactively)
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                focusedField = .email
            }
        }
    }

    private func focusBinding(_ field: Field) -> Binding<Bool> {
        Binding(
            get: { focusedField == field },
            set: { if $0 { focusedField = field } else { focusedField = nil } }
        )
    }

    private func toggleMode() {
        withAnimation(RMTheme.Animation.spring) {
            isSignup.toggle()
            errorText = nil
            password = ""
            confirmPassword = ""
        }
    }

    private func handleSubmit() {
        errorText = nil

        if isSignup {
            if password != confirmPassword {
                errorText = "Passwords do not match"
                return
            }
            if password.count < 6 {
                errorText = "Password must be at least 6 characters"
                return
            }
        }

        Task {
            do {
                if isSignup {
                    try await sessionManager.signup(email: email, password: password)
                } else {
                    try await sessionManager.login(email: email, password: password)
                }
            } catch {
                errorText = error.localizedDescription
            }
        }
    }
}

#Preview {
    AuthView()
}
