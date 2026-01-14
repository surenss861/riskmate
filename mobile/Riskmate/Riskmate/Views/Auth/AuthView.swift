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
            
            VStack {
                Spacer()
                
                RMGlassCard {
                    VStack(spacing: 18) {
                        // Logo
                        RiskMateLogo(size: .large, showText: true)
                            .padding(.bottom, 4)
                        
                        // Title Section
                        VStack(spacing: 6) {
                            Text(isSignup ? "Create Account" : "Welcome Back")
                                .font(.system(size: 34, weight: .bold))
                                .foregroundColor(.white)
                            
                            Text(isSignup ? "Start protecting every job before it starts" : "Sign in to your RiskMate account")
                                .font(.system(size: 16, weight: .medium))
                                .foregroundColor(.white.opacity(0.65))
                        }
                        .padding(.bottom, 8)
                        
                        // Form Fields
                        VStack(spacing: 12) {
                            RMTextField(
                                title: "Email",
                                text: $email,
                                keyboardType: .emailAddress,
                                textContentType: .emailAddress
                            )
                            
                            RMTextField(
                                title: "Password",
                                text: $password,
                                isSecure: true,
                                textContentType: isSignup ? .newPassword : .password
                            )
                            
                            // Confirm Password (Signup only)
                            if isSignup {
                                RMTextField(
                                    title: "Confirm Password",
                                    text: $confirmPassword,
                                    isSecure: true,
                                    textContentType: .newPassword
                                )
                                
                                Text("Minimum 6 characters")
                                    .font(.system(size: 12, weight: .regular))
                                    .foregroundColor(.white.opacity(0.5))
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(.leading, 4)
                            }
                        }
                        
                        // Submit Button
                        RMPrimaryButton(
                            title: isSignup ? "Sign Up" : "Log In",
                            isLoading: sessionManager.isLoading,
                            isDisabled: email.isEmpty || password.isEmpty || (isSignup && confirmPassword.isEmpty)
                        ) {
                            handleSubmit()
                        }
                        .padding(.top, 6)
                        
                        // Error Message
                        if let errorText = errorText {
                            HStack(spacing: 8) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .font(.system(size: 12))
                                Text(errorText)
                                    .font(.system(size: 13, weight: .semibold))
                            }
                            .foregroundColor(Color.red.opacity(0.95))
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.top, 2)
                        }
                        
                        // Divider
                        Rectangle()
                            .fill(Color.white.opacity(0.10))
                            .frame(height: 1)
                            .padding(.vertical, 10)
                        
                        // Toggle Login/Signup
                        HStack(spacing: 6) {
                            Text(isSignup ? "Already have an account?" : "Don't have an account?")
                                .font(.system(size: 15, weight: .regular))
                                .foregroundColor(.white.opacity(0.65))
                            
                            Button(isSignup ? "Log in" : "Sign up") {
                                withAnimation(.spring(response: 0.35, dampingFraction: 0.9)) {
                                    isSignup.toggle()
                                    errorText = nil
                                    password = ""
                                    confirmPassword = ""
                                }
                            }
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundColor(Color(hex: "#F97316"))
                        }
                        
                        // Terms (Signup only)
                        if isSignup {
                            Text("By signing up, you agree to our Terms and Privacy Policy")
                                .font(.system(size: 12, weight: .regular))
                                .foregroundColor(.white.opacity(0.5))
                                .multilineTextAlignment(.center)
                                .padding(.top, 8)
                        }
                    }
                }
                .padding(.horizontal, 22)
                
                Spacer()
            }
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
