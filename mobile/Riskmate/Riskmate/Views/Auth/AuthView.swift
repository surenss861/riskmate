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

    @ViewBuilder
    private var heroBlock: some View {
        VStack(spacing: 12) {
            Text("Riskmate")
                .font(.system(size: 18, weight: .semibold))
                .foregroundColor(RMTheme.Colors.accent)
                .padding(.bottom, 6)

            Text("Audit-ready\nproof packs\nfrom everyday\nfield work")
                .font(.system(size: 38, weight: .semibold, design: .serif))
                .tracking(-0.8)
                .lineSpacing(-3)
                .multilineTextAlignment(.center)
                .foregroundStyle(
                    LinearGradient(
                        colors: [Color.white, Color.white.opacity(0.88)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .shadow(color: .black.opacity(0.42), radius: 16, x: 0, y: 12)

            Text("Turn site activity into compliance you can defend — fast.")
                .font(.system(size: 15, weight: .regular))
                .foregroundColor(Color.white.opacity(0.62))
                .multilineTextAlignment(.center)
                .lineSpacing(2)
                .padding(.top, 2)

            Text("•  Ledger Contract v1.0  •  Frozen")
                .font(.system(size: 12, weight: .medium, design: .monospaced))
                .foregroundColor(Color.white.opacity(0.88))
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(
                    LinearGradient(
                        colors: [Color.white.opacity(0.10), Color.white.opacity(0.02)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .clipShape(Capsule())
                )
                .background(.ultraThinMaterial, in: Capsule())
                .overlay(Capsule().stroke(.white.opacity(0.16), lineWidth: 1))
                .shadow(color: .black.opacity(0.35), radius: 10, x: 0, y: 8)
                .padding(.top, 2)
        }
        .frame(maxWidth: 520)
        .frame(maxWidth: .infinity, alignment: .center)
        .padding(.horizontal, 22)
        .background(
            RadialGradient(
                gradient: Gradient(stops: [
                    .init(color: RMTheme.Colors.accent.opacity(0.06), location: 0.0),
                    .init(color: .clear, location: 0.55),
                    .init(color: .black.opacity(0.0), location: 1.0)
                ]),
                center: .center,
                startRadius: 40,
                endRadius: 280
            )
            .blur(radius: 18)
            .allowsHitTesting(false)
        )
    }

    private func landingCTAs(safeBottom: CGFloat) -> some View {
        VStack(spacing: 12) {
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
                    .background(RMTheme.Colors.accent.opacity(0.95), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .overlay(
                        LinearGradient(
                            gradient: Gradient(colors: [
                                .white.opacity(0.10),
                                .clear
                            ]),
                            startPoint: .top,
                            endPoint: .bottom
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                        .blendMode(.softLight)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .stroke(.white.opacity(0.10), lineWidth: 1)
                    )
                    .shadow(color: RMTheme.Colors.accent.opacity(0.18), radius: 14, x: 0, y: 10)
            }

            Button {
                clearFormState()
                withAnimation(RMTheme.Animation.spring) { screen = .login }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { focusedField = .email }
            } label: {
                Text("Sign In")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(.white.opacity(0.85))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
        }
        .padding(14)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(.white.opacity(0.10), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.35), radius: 22, x: 0, y: 14)
        .padding(.horizontal, 18)
        .padding(.bottom, max(18, safeBottom + 10))
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }

    var body: some View {
        GeometryReader { geo in
            let safeTop = geo.safeAreaInsets.top
            let safeBottom = geo.safeAreaInsets.bottom
            let heroBandHeight = geo.size.height * 0.60

            ZStack {
                RMBackground()

                // Vignette only (no full-screen bloom — micro-bloom lives behind hero)
                LinearGradient(
                    gradient: Gradient(stops: [
                        .init(color: .black.opacity(0.75), location: 0.0),
                        .init(color: .clear, location: 0.35),
                        .init(color: .black.opacity(0.85), location: 1.0)
                    ]),
                    startPoint: .top,
                    endPoint: .bottom
                )
                .allowsHitTesting(false)

                VStack(spacing: 0) {
                    if screen == .landing {
                        // HERO REGION — 60% band, biased up
                        VStack(spacing: 0) {
                            Spacer(minLength: 0)
                            heroBlock
                                .offset(y: -16)
                            Spacer(minLength: 0)
                        }
                        .frame(height: heroBandHeight)
                        .padding(.top, safeTop)

                        Spacer(minLength: 0)

                        // CTA REGION — lighter dock, tighter pill-to-dock gap
                        landingCTAs(safeBottom: safeBottom)
                            .padding(.top, 20)
                    }

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
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .ignoresSafeArea()
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
