import SwiftUI

/// Canonical auth screen when logged out. Landing = hero + bottom CTAs; form appears on tap.
/// This file does NOT contain "Welcome Back" — hero copy is "Audit-ready proof packs." / "Compliance you can defend."
struct AuthView: View {
    @StateObject private var sessionManager = SessionManager.shared

    @State private var screen: Screen = .landing
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var errorText: String?
    @FocusState private var focusedField: Field?

    enum Screen { case landing, login, signup }
    enum Field { case email, password, confirmPassword }

    private var isSignup: Bool { screen == .signup }

    var body: some View {
        ZStack {
            RMBackground()

            RadialGradient(
                colors: [
                    RMTheme.Colors.accent.opacity(0.14),
                    .clear,
                    .black.opacity(0.65)
                ],
                center: .topLeading,
                startRadius: 80,
                endRadius: 520
            )
            .blendMode(.screen)
            .allowsHitTesting(false)

            VStack(spacing: 0) {

                // HERO
                VStack(alignment: .leading, spacing: 12) {
                    Spacer(minLength: 22)

                    Text("Riskmate")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(RMTheme.Colors.accent)
                        .tracking(0.4)

                    Text("Audit-ready\nproof packs\nfrom everyday\nfield work")
                        .font(.system(size: 40, weight: .bold, design: .serif))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [.white, .white.opacity(0.82)],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .tracking(-0.8)
                        .lineSpacing(-6)
                        .shadow(color: .black.opacity(0.55), radius: 14, x: 0, y: 8)

                    Text("Turn site activity into compliance you can defend — fast.")
                        .font(.system(size: 15, weight: .regular))
                        .foregroundColor(.white.opacity(0.62))
                        .lineSpacing(2)
                        .padding(.top, 2)

                    HStack(spacing: 8) {
                        Circle().fill(.white.opacity(0.85)).frame(width: 6, height: 6)
                        Text("Ledger Contract v1.0 • Frozen")
                            .font(.system(size: 12, weight: .semibold, design: .monospaced))
                            .foregroundColor(.white.opacity(0.88))
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 9)
                    .background(.ultraThinMaterial, in: Capsule())
                    .overlay(
                        Capsule().stroke(.white.opacity(0.14), lineWidth: 1)
                    )
                    .shadow(color: .black.opacity(0.35), radius: 10, x: 0, y: 8)

                    Spacer(minLength: 18)
                }
                .padding(.horizontal, 22)

                // FORM (only when login/signup)
                if screen != .landing {
                    RMGlassCard {
                        VStack(spacing: 12) {
                            HStack {
                                Button {
                                    clearFormState()
                                    withAnimation(RMTheme.Animation.spring) { screen = .landing }
                                } label: {
                                    HStack(spacing: 6) {
                                        Image(systemName: "chevron.left")
                                        Text("Back")
                                    }
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundColor(.white.opacity(0.8))
                                }

                                Spacer()

                                Text(isSignup ? "Create Account" : "Sign In")
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundColor(.white.opacity(0.75))
                            }
                            .padding(.bottom, 2)

                            RMAuthTextField(
                                title: "Email",
                                text: $email,
                                icon: "envelope",
                                isSecure: false,
                                keyboardType: .emailAddress,
                                textContentType: .emailAddress,
                                onSubmit: { focusedField = .password },
                                focused: Binding(
                                    get: { focusedField == .email },
                                    set: { $0 ? (focusedField = .email) : (focusedField = nil) }
                                )
                            )

                            RMAuthTextField(
                                title: "Password",
                                text: $password,
                                icon: "lock",
                                isSecure: true,
                                keyboardType: .default,
                                textContentType: isSignup ? .newPassword : .password,
                                onSubmit: {
                                    if isSignup { focusedField = .confirmPassword }
                                    else { handleSubmit() }
                                },
                                focused: Binding(
                                    get: { focusedField == .password },
                                    set: { $0 ? (focusedField = .password) : (focusedField = nil) }
                                )
                            )

                            if isSignup {
                                RMAuthTextField(
                                    title: "Confirm Password",
                                    text: $confirmPassword,
                                    icon: "lock",
                                    isSecure: true,
                                    keyboardType: .default,
                                    textContentType: .newPassword,
                                    onSubmit: { handleSubmit() },
                                    focused: Binding(
                                        get: { focusedField == .confirmPassword },
                                        set: { $0 ? (focusedField = .confirmPassword) : (focusedField = nil) }
                                    )
                                )

                                Text("Minimum 6 characters")
                                    .font(.caption)
                                    .foregroundColor(.white.opacity(0.55))
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(.leading, 2)
                            }

                            RMPrimaryButton(
                                title: isSignup ? "Create Account" : "Sign In",
                                isLoading: sessionManager.isLoading,
                                isDisabled: email.isEmpty || password.isEmpty || (isSignup && confirmPassword.isEmpty)
                            ) { handleSubmit() }
                            .padding(.top, 6)

                            if let errorText {
                                HStack(spacing: 8) {
                                    Image(systemName: "exclamationmark.triangle.fill")
                                        .font(.system(size: 12, weight: .semibold))
                                    Text(errorText)
                                        .font(RMTheme.Typography.bodySmallBold)
                                }
                                .foregroundColor(RMTheme.Colors.error)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.top, 4)
                            }

                            Divider().overlay(RMTheme.Colors.divider)
                                .padding(.vertical, 10)

                            HStack(spacing: 6) {
                                Text(isSignup ? "Already have an account?" : "Don't have an account?")
                                    .foregroundColor(RMTheme.Colors.textSecondary)
                                    .font(RMTheme.Typography.body)

                                Button(isSignup ? "Sign In" : "Start Free") {
                                    let generator = UIImpactFeedbackGenerator(style: .light)
                                    generator.impactOccurred()
                                    clearFormState()
                                    withAnimation(RMTheme.Animation.spring) {
                                        screen = isSignup ? .login : .signup
                                    }
                                }
                                .foregroundColor(RMTheme.Colors.accent)
                                .font(RMTheme.Typography.bodyBold)
                            }
                        }
                    }
                    .frame(maxWidth: 420)
                    .padding(.horizontal, 20)
                    .padding(.top, 10)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }

                Spacer(minLength: 0)

                // Bottom CTAs (landing only)
                if screen == .landing {
                    VStack(spacing: 10) {
                        Button {
                            clearFormState()
                            withAnimation(RMTheme.Animation.spring) { screen = .signup }
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { focusedField = .email }
                        } label: {
                            Text("Start Free")
                                .font(.system(size: 17, weight: .semibold))
                                .foregroundColor(.black)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 18)
                                .background(
                                    LinearGradient(
                                        colors: [RMTheme.Colors.accent, RMTheme.Colors.accent.opacity(0.85)],
                                        startPoint: .top,
                                        endPoint: .bottom
                                    ),
                                    in: RoundedRectangle(cornerRadius: 18)
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: 18)
                                        .stroke(.white.opacity(0.18), lineWidth: 1)
                                        .blendMode(.overlay)
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: 18)
                                        .fill(
                                            LinearGradient(
                                                colors: [.white.opacity(0.18), .clear],
                                                startPoint: .top,
                                                endPoint: .center
                                            )
                                        )
                                        .padding(1)
                                        .blendMode(.overlay)
                                )
                                .shadow(color: RMTheme.Colors.accent.opacity(0.25), radius: 18, x: 0, y: 10)
                        }

                        Button {
                            clearFormState()
                            withAnimation(RMTheme.Animation.spring) { screen = .login }
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { focusedField = .email }
                        } label: {
                            Text("Sign In")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundColor(.white.opacity(0.9))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 16)
                                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 18)
                                        .stroke(.white.opacity(0.16), lineWidth: 1)
                                )
                                .shadow(color: .black.opacity(0.45), radius: 18, x: 0, y: 10)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 18)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
        }
        .preferredColorScheme(.dark)
        .scrollDismissesKeyboard(.interactively)
    }

    private func clearFormState() {
        errorText = nil
        email = ""
        password = ""
        confirmPassword = ""
        focusedField = nil
    }

    private func handleSubmit() {
        errorText = nil

        if isSignup {
            if password != confirmPassword { errorText = "Passwords do not match"; return }
            if password.count < 6 { errorText = "Password must be at least 6 characters"; return }
        }

        Task {
            do {
                if isSignup { try await sessionManager.signup(email: email, password: password) }
                else { try await sessionManager.login(email: email, password: password) }
            } catch {
                errorText = error.localizedDescription
            }
        }
    }
}

#Preview {
    AuthView()
}
