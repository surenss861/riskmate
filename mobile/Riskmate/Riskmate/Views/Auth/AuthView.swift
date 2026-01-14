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
                            
                            VStack(spacing: 6) {
                                Text(isSignup ? "Create Account" : "Welcome Back")
                                    .font(.largeTitle.weight(.bold))
                                    .foregroundColor(.white)
                                
                                Text(isSignup ? "Start protecting every job before it starts"
                                              : "Sign in to your RiskMate account")
                                    .font(.body)
                                    .foregroundColor(.white.opacity(0.65))
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
                                HStack(spacing: 8) {
                                    Image(systemName: "exclamationmark.triangle.fill")
                                        .font(.system(size: 12))
                                    Text(errorText)
                                        .font(.subheadline.weight(.semibold))
                                }
                                .foregroundColor(Color.red.opacity(0.95))
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.top, 2)
                            }
                            
                            Divider()
                                .overlay(Color.white.opacity(0.10))
                                .padding(.vertical, 10)
                            
                            HStack(spacing: 6) {
                                Text(isSignup ? "Already have an account?" : "Don't have an account?")
                                    .foregroundColor(.white.opacity(0.65))
                                
                                Button(isSignup ? "Log in" : "Sign up") {
                                    withAnimation(.spring(response: 0.35, dampingFraction: 0.9)) {
                                        isSignup.toggle()
                                        errorText = nil
                                        password = ""
                                        confirmPassword = ""
                                    }
                                }
                                .foregroundColor(Color(hex: "#F97316"))
                                .font(.body.weight(.semibold))
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
