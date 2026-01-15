import SwiftUI

struct AuthView: View {
    @StateObject private var sessionManager = SessionManager.shared
    
    @State private var isSignup = false
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var errorText: String?
    
    var body: some View {
        ZStack {
            RMBackground()
            
            ScrollView(showsIndicators: false) {
                VStack(spacing: 18) {
                    Spacer(minLength: 28)
                    
                    RMGlassCard {
                        VStack(spacing: 16) {
                            RiskMateLogo(size: .large, showText: true)
                                .padding(.bottom, 2)
                            
                            VStack(spacing: RMTheme.Spacing.xs) {
                                Text(isSignup ? "Create Account" : "Welcome Back")
                                    .font(RMTheme.Typography.largeTitle)
                                    .foregroundColor(RMTheme.Colors.textPrimary)
                                
                                Text(isSignup ? "Start protecting every job before it starts"
                                              : "Sign in to your RiskMate account")
                                    .font(RMTheme.Typography.body)
                                    .foregroundColor(RMTheme.Colors.textSecondary)
                            }
                            .padding(.bottom, 8)
                            
                            VStack(spacing: 12) {
                                RMAuthTextField(
                                    title: "Email",
                                    text: $email,
                                    icon: "envelope",
                                    isSecure: false,
                                    keyboardType: .emailAddress,
                                    textContentType: .emailAddress
                                )
                                
                                RMAuthTextField(
                                    title: "Password",
                                    text: $password,
                                    icon: "lock",
                                    isSecure: true,
                                    keyboardType: .default,
                                    textContentType: isSignup ? .newPassword : .password
                                )
                                
                                if isSignup {
                                    RMAuthTextField(
                                        title: "Confirm Password",
                                        text: $confirmPassword,
                                        icon: "lock",
                                        isSecure: true,
                                        keyboardType: .default,
                                        textContentType: .newPassword
                                    )
                                    
                                    Text("Minimum 6 characters")
                                        .font(.caption)
                                        .foregroundColor(.white.opacity(0.55))
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .padding(.leading, 2)
                                }
                            }
                            
                            RMPrimaryButton(
                                title: isSignup ? "Sign Up" : "Log In",
                                isLoading: sessionManager.isLoading,
                                isDisabled: email.isEmpty || password.isEmpty || (isSignup && confirmPassword.isEmpty)
                            ) {
                                handleSubmit()
                            }
                            .padding(.top, 6)
                            
                            if let errorText = errorText {
                                HStack(spacing: RMTheme.Spacing.sm) {
                                    Image(systemName: "exclamationmark.triangle.fill")
                                        .font(.system(size: 12, weight: .semibold))
                                    Text(errorText)
                                        .font(RMTheme.Typography.bodySmallBold)
                                }
                                .foregroundColor(RMTheme.Colors.error)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.top, RMTheme.Spacing.xs)
                            }
                            
                            Divider()
                                .overlay(RMTheme.Colors.divider)
                                .padding(.vertical, RMTheme.Spacing.sm)
                            
                            HStack(spacing: RMTheme.Spacing.xs) {
                                Text(isSignup ? "Already have an account?" : "Don't have an account?")
                                    .foregroundColor(RMTheme.Colors.textSecondary)
                                    .font(RMTheme.Typography.body)
                                
                                Button(isSignup ? "Log in" : "Sign up") {
                                    let generator = UIImpactFeedbackGenerator(style: .light)
                                    generator.impactOccurred()
                                    withAnimation(RMTheme.Animation.spring) {
                                        isSignup.toggle()
                                        errorText = nil
                                        password = ""
                                        confirmPassword = ""
                                    }
                                }
                                .foregroundColor(RMTheme.Colors.accent)
                                .font(RMTheme.Typography.bodyBold)
                            }
                            
                            if isSignup {
                                Text("By signing up, you agree to our Terms and Privacy Policy")
                                    .font(.caption)
                                    .foregroundColor(.white.opacity(0.55))
                                    .multilineTextAlignment(.center)
                                    .padding(.top, 8)
                            }
                        }
                    }
                    .frame(maxWidth: 420) // feels premium on iPad too
                    .padding(.horizontal, 20)
                    
                    Spacer(minLength: 44)
                }
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .preferredColorScheme(.dark)
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
