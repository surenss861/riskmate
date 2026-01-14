import SwiftUI

struct AuthView: View {
    @State private var isLogin = true
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @StateObject private var sessionManager = SessionManager.shared
    
    var body: some View {
        ZStack {
            // Background - must be first and ignore safe area
            DesignSystem.Colors.background
                .ignoresSafeArea(.all)
            
            ScrollView {
                VStack(spacing: 0) {
                    Spacer(minLength: 60)
                    
                    // Card Container
                    VStack(spacing: DesignSystem.Spacing.xl) {
                        // Logo
                        RiskMateLogo(size: .large, showText: true)
                            .padding(.bottom, DesignSystem.Spacing.md)
                        
                        // Title
                        VStack(spacing: DesignSystem.Spacing.sm) {
                            Text(isLogin ? "Welcome Back" : "Create Account")
                                .font(DesignSystem.Typography.title)
                                .foregroundColor(DesignSystem.Colors.textPrimary)
                            
                            Text(isLogin ? "Sign in to your RiskMate account" : "Start protecting every job before it starts")
                                .font(DesignSystem.Typography.bodySmall)
                                .foregroundColor(DesignSystem.Colors.textSecondary)
                        }
                        .padding(.bottom, DesignSystem.Spacing.md)
                        
                        // Error Message
                        if let error = errorMessage {
                            HStack {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundColor(DesignSystem.Colors.error)
                                Text(error)
                                    .font(DesignSystem.Typography.caption)
                                    .foregroundColor(DesignSystem.Colors.error)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(DesignSystem.Spacing.md)
                            .background(DesignSystem.Colors.errorBackground)
                            .overlay(
                                RoundedRectangle(cornerRadius: DesignSystem.Radius.medium)
                                    .stroke(DesignSystem.Colors.errorBorder, lineWidth: 1)
                            )
                            .cornerRadius(DesignSystem.Radius.medium)
                        }
                        
                        // Form Fields
                        VStack(spacing: DesignSystem.Spacing.md) {
                            // Email
                            TextField("Email", text: $email)
                                .textContentType(.emailAddress)
                                .keyboardType(.emailAddress)
                                .autocapitalization(.none)
                                .autocorrectionDisabled()
                                .padding(DesignSystem.Spacing.md)
                                .background(Color.black.opacity(0.4))
                                .foregroundColor(DesignSystem.Colors.textPrimary)
                                .overlay(
                                    RoundedRectangle(cornerRadius: DesignSystem.Radius.medium)
                                        .stroke(DesignSystem.Colors.border, lineWidth: 1)
                                )
                                .cornerRadius(DesignSystem.Radius.medium)
                                .disabled(isLoading)
                            
                            // Password
                            SecureField("Password", text: $password)
                                .textContentType(isLogin ? .password : .newPassword)
                                .padding(DesignSystem.Spacing.md)
                                .background(Color.black.opacity(0.4))
                                .foregroundColor(DesignSystem.Colors.textPrimary)
                                .overlay(
                                    RoundedRectangle(cornerRadius: DesignSystem.Radius.medium)
                                        .stroke(DesignSystem.Colors.border, lineWidth: 1)
                                )
                                .cornerRadius(DesignSystem.Radius.medium)
                                .disabled(isLoading)
                            
                            // Confirm Password (Signup only)
                            if !isLogin {
                                SecureField("Confirm Password", text: $confirmPassword)
                                    .textContentType(.newPassword)
                                    .padding(DesignSystem.Spacing.md)
                                    .background(Color.black.opacity(0.4))
                                    .foregroundColor(DesignSystem.Colors.textPrimary)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: DesignSystem.Radius.medium)
                                            .stroke(DesignSystem.Colors.border, lineWidth: 1)
                                    )
                                    .cornerRadius(DesignSystem.Radius.medium)
                                    .disabled(isLoading)
                                
                                Text("Minimum 6 characters")
                                    .font(DesignSystem.Typography.caption)
                                    .foregroundColor(DesignSystem.Colors.textSecondary)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            
                            // Submit Button
                            Button(action: handleSubmit) {
                                if isLoading {
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: .black))
                                        .frame(maxWidth: .infinity)
                                        .frame(height: 48)
                                } else {
                                    Text(isLogin ? "Log In" : "Sign Up")
                                        .font(DesignSystem.Typography.body)
                                        .fontWeight(.semibold)
                                        .foregroundColor(.black)
                                        .frame(maxWidth: .infinity)
                                        .frame(height: 48)
                                }
                            }
                            .background(DesignSystem.Colors.accent)
                            .cornerRadius(DesignSystem.Radius.medium)
                            .disabled(isLoading || email.isEmpty || password.isEmpty || (!isLogin && confirmPassword.isEmpty))
                            .opacity((isLoading || email.isEmpty || password.isEmpty || (!isLogin && confirmPassword.isEmpty)) ? 0.5 : 1.0)
                        }
                        
                        // Forgot Password (Login only)
                        if isLogin {
                            Button("Forgot password?") {
                                // TODO: Implement forgot password
                            }
                            .font(DesignSystem.Typography.caption)
                            .foregroundColor(DesignSystem.Colors.textSecondary)
                            .padding(.top, DesignSystem.Spacing.sm)
                        }
                        
                        // Divider
                        Divider()
                            .background(DesignSystem.Colors.border)
                            .padding(.vertical, DesignSystem.Spacing.md)
                        
                        // Toggle Login/Signup
                        HStack {
                            Text(isLogin ? "Don't have an account?" : "Already have an account?")
                                .font(DesignSystem.Typography.caption)
                                .foregroundColor(DesignSystem.Colors.textSecondary)
                            
                            Button(isLogin ? "Sign up" : "Log in") {
                                withAnimation {
                                    isLogin.toggle()
                                    errorMessage = nil
                                    password = ""
                                    confirmPassword = ""
                                }
                            }
                            .font(DesignSystem.Typography.caption)
                            .fontWeight(.medium)
                            .foregroundColor(DesignSystem.Colors.accent)
                        }
                        
                        // Terms (Signup only)
                        if !isLogin {
                            Text("By signing up, you agree to our Terms and Privacy Policy")
                                .font(DesignSystem.Typography.caption)
                                .foregroundColor(DesignSystem.Colors.textSecondary)
                                .multilineTextAlignment(.center)
                                .padding(.top, DesignSystem.Spacing.md)
                        }
                    }
                    .padding(DesignSystem.Spacing.xl)
                    .background(
                        DesignSystem.Colors.surface.opacity(0.8)
                            .background(.ultraThinMaterial)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: DesignSystem.Radius.large)
                            .stroke(DesignSystem.Colors.border, lineWidth: 1)
                    )
                    .cornerRadius(DesignSystem.Radius.large)
                    .padding(.horizontal, DesignSystem.Spacing.lg)
                    
                    Spacer(minLength: 60)
                }
            }
        }
    }
    
    private func handleSubmit() {
        errorMessage = nil
        
        if !isLogin && password != confirmPassword {
            errorMessage = "Passwords do not match"
            return
        }
        
        if !isLogin && password.count < 6 {
            errorMessage = "Password must be at least 6 characters"
            return
        }
        
        isLoading = true
        
        Task {
            do {
                if isLogin {
                    try await sessionManager.login(email: email, password: password)
                } else {
                    try await sessionManager.signup(email: email, password: password)
                }
            } catch {
                errorMessage = error.localizedDescription
            }
            
            isLoading = false
        }
    }
}

#Preview {
    AuthView()
}
