import SwiftUI

struct AccountView: View {
    @StateObject private var sessionManager = SessionManager.shared
    
    @State private var isEditingOrgName = false
    @State private var editedOrgName = ""
    @State private var showError = false
    @State private var errorMessage = ""
    @State private var isLoading = false
    @State private var showSignOutConfirmation = false
    @State private var showDeleteAccountConfirmation = false
    @State private var deleteConfirmationText = ""
    @State private var isDeletingAccount = false
    
    private var versionString: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "Unknown"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "Unknown"
        return "\(version) (\(build))"
    }
    
    private var buildChannel: String {
        #if DEBUG
        return "Development"
        #else
        // Check if TestFlight
        if Bundle.main.appStoreReceiptURL?.lastPathComponent == "sandboxReceipt" {
            return "TestFlight"
        }
        return "Production"
        #endif
    }
    
    var body: some View {
        ZStack {
            RMBackground()
            
            List {
                if let org = sessionManager.currentOrganization {
                    Section {
                        // Organization badge/icon
                        HStack(spacing: RMTheme.Spacing.md) {
                            // Small org badge
                            ZStack {
                                Circle()
                                    .fill(RMTheme.Colors.accent.opacity(0.2))
                                    .frame(width: 40, height: 40)
                                
                                Text(String(org.name.prefix(1)).uppercased())
                                    .font(RMTheme.Typography.title3)
                                    .foregroundColor(RMTheme.Colors.accent)
                            }
                            
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Organization")
                                    .font(RMTheme.Typography.caption)
                                    .foregroundColor(RMTheme.Colors.textTertiary)
                                
                                if isEditingOrgName {
                                    TextField("Organization Name", text: $editedOrgName)
                                        .textFieldStyle(.plain)
                                        .foregroundColor(RMTheme.Colors.textPrimary)
                                        .font(RMTheme.Typography.bodyBold)
                                } else {
                                    Text(org.name)
                                        .foregroundColor(RMTheme.Colors.textPrimary)
                                        .font(RMTheme.Typography.bodyBold)
                                }
                            }
                            
                            Spacer()
                        }
                        .listRowBackground(RMTheme.Colors.surface.opacity(0.5))
                        
                        if isEditingOrgName {
                            Button {
                                let generator = UIImpactFeedbackGenerator(style: .medium)
                                generator.impactOccurred()
                                saveOrganizationName()
                            } label: {
                                if isLoading {
                                    HStack {
                                        ProgressView()
                                            .progressViewStyle(CircularProgressViewStyle(tint: RMTheme.Colors.accent))
                                        Text("Saving...")
                                            .foregroundColor(RMTheme.Colors.accent)
                                    }
                                } else {
                                    Text("Save")
                                        .foregroundColor(RMTheme.Colors.accent)
                                }
                            }
                            .disabled(isLoading || editedOrgName.isEmpty || editedOrgName == org.name)
                            .listRowBackground(RMTheme.Colors.surface.opacity(0.5))
                            
                            Button("Cancel", role: .cancel) {
                                let generator = UIImpactFeedbackGenerator(style: .light)
                                generator.impactOccurred()
                                isEditingOrgName = false
                                editedOrgName = org.name
                            }
                            .listRowBackground(RMTheme.Colors.surface.opacity(0.5))
                        } else {
                            Button {
                                let generator = UIImpactFeedbackGenerator(style: .light)
                                generator.impactOccurred()
                                editedOrgName = org.name
                                isEditingOrgName = true
                            } label: {
                                Text("Edit")
                                    .foregroundColor(RMTheme.Colors.accent)
                            }
                            .listRowBackground(RMTheme.Colors.surface.opacity(0.5))
                        }
                    } header: {
                        Text("Organization")
                            .foregroundColor(RMTheme.Colors.textSecondary)
                    }
                }
                
                Section {
                    NavigationLink {
                        SupportBundleView()
                    } label: {
                        HStack {
                            Image(systemName: "questionmark.circle")
                            Text("Support")
                        }
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    }
                    .listRowBackground(RMTheme.Colors.surface.opacity(0.5))
                    
                    NavigationLink {
                        PrivacyPolicyView()
                    } label: {
                        HStack {
                            Image(systemName: "hand.raised.fill")
                            Text("Privacy Policy")
                        }
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    }
                    .listRowBackground(RMTheme.Colors.surface.opacity(0.5))
                    
                    NavigationLink {
                        TermsOfServiceView()
                    } label: {
                        HStack {
                            Image(systemName: "doc.text.fill")
                            Text("Terms of Service")
                        }
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    }
                    .listRowBackground(RMTheme.Colors.surface.opacity(0.5))
                    
                    #if DEBUG
                    NavigationLink {
                        EntitlementsDebugView()
                    } label: {
                        HStack {
                            Image(systemName: "info.circle.fill")
                            Text("Entitlements Debug")
                        }
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    }
                    .listRowBackground(RMTheme.Colors.surface.opacity(0.5))
                    
                    NavigationLink {
                        EnvironmentDebugView()
                    } label: {
                        HStack {
                            Image(systemName: "server.rack")
                            Text("Environment Debug")
                        }
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    }
                    .listRowBackground(RMTheme.Colors.surface.opacity(0.5))
                    #endif
                }
                
                // Production Toggles (dev/internal only)
                #if DEBUG
                Section {
                    Toggle(isOn: Binding(
                        get: { UserDefaultsManager.Production.sendDiagnostics },
                        set: { UserDefaultsManager.Production.sendDiagnostics = $0 }
                    )) {
                        HStack {
                            Image(systemName: "stethoscope")
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Send Diagnostics")
                                    .foregroundColor(RMTheme.Colors.textPrimary)
                                Text("Include device info in logs")
                                    .font(RMTheme.Typography.caption)
                                    .foregroundColor(RMTheme.Colors.textTertiary)
                            }
                        }
                    }
                    .tint(RMTheme.Colors.accent)
                    .listRowBackground(RMTheme.Colors.surface.opacity(0.5))
                    
                    Button {
                        Haptics.tap()
                        UserDefaultsManager.Production.resetOnboardingAndCoachMarks()
                        let generator = UINotificationFeedbackGenerator()
                        generator.notificationOccurred(.success)
                    } label: {
                        HStack {
                            Image(systemName: "arrow.counterclockwise")
                            Text("Reset Onboarding & Coach Marks")
                                .foregroundColor(RMTheme.Colors.accent)
                        }
                    }
                    .listRowBackground(RMTheme.Colors.surface.opacity(0.5))
                } header: {
                    Text("Development")
                        .foregroundColor(RMTheme.Colors.textSecondary)
                }
                #endif
                
                // Sign Out - own section, destructive style with confirmation
                Section {
                    Divider()
                        .background(RMTheme.Colors.divider.opacity(0.3))
                        .padding(.vertical, 4)
                    
                    Button("Sign Out", role: .destructive) {
                        Haptics.warning()
                        showSignOutConfirmation = true
                    }
                    .listRowBackground(Color.clear)
                    .confirmationDialog("Sign Out", isPresented: $showSignOutConfirmation, titleVisibility: .visible) {
                        Button("Sign Out", role: .destructive) {
                            Haptics.warning()
                            Task {
                                await sessionManager.logout()
                            }
                        }
                        Button("Cancel", role: .cancel) {
                            Haptics.tap()
                        }
                    } message: {
                        Text("You can sign back in anytime. Your data is securely stored.")
                    }
                }
                
                // Delete Account - separate section, most destructive action
                Section {
                    Button("Delete Account", role: .destructive) {
                        Haptics.warning()
                        showDeleteAccountConfirmation = true
                    }
                    .listRowBackground(Color.clear)
                    .disabled(isDeletingAccount)
                } header: {
                    Text("Danger Zone")
                        .foregroundColor(RMTheme.Colors.textSecondary)
                } footer: {
                    Text("Deleting your account will permanently remove all your data. This action cannot be undone.")
                        .foregroundColor(RMTheme.Colors.textTertiary)
                }
                
                // Version info (subtle, professional)
                Section {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text("Version")
                                .foregroundColor(RMTheme.Colors.textTertiary)
                                .font(RMTheme.Typography.caption)
                            Spacer()
                            Text(versionString)
                                .foregroundColor(RMTheme.Colors.textSecondary)
                                .font(.system(.caption, design: .monospaced))
                        }
                        #if DEBUG
                        .onLongPressGesture {
                            // Long-press to show entitlements debug
                            // This will be handled by navigation link below
                        }
                        #endif
                        
                        // Build channel (Production / TestFlight)
                        HStack {
                            Text("Build Channel")
                                .foregroundColor(RMTheme.Colors.textTertiary)
                                .font(RMTheme.Typography.caption)
                            Spacer()
                            Text(buildChannel)
                                .foregroundColor(RMTheme.Colors.textSecondary)
                                .font(.system(.caption, design: .monospaced))
                        }
                    }
                    .listRowBackground(RMTheme.Colors.surface.opacity(0.3))
                }
            }
            .scrollContentBackground(.hidden)
                .navigationTitle("Settings")
                .navigationBarTitleDisplayMode(.large)
            .refreshable {
                await sessionManager.refreshOrganization()
            }
            .alert("Error", isPresented: $showError) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(errorMessage)
            }
            .sheet(isPresented: $showDeleteAccountConfirmation) {
                DeleteAccountSheet(
                    isPresented: $showDeleteAccountConfirmation,
                    onConfirm: {
                        Task {
                            await deleteAccount()
                        }
                    },
                    isDeleting: isDeletingAccount
                )
            }
        }
        .rmNavigationBar(title: "Settings")
        .preferredColorScheme(.dark)
    }
    
    private func saveOrganizationName() {
        isLoading = true
        Task {
            do {
                let updated = try await APIClient.shared.updateOrganization(name: editedOrgName)
                sessionManager.currentOrganization = updated
                isEditingOrgName = false
            } catch {
                errorMessage = error.localizedDescription
                showError = true
            }
            isLoading = false
        }
    }
    
    private func deleteAccount() async {
        isDeletingAccount = true
        Haptics.warning()
        
        do {
            let response = try await APIClient.shared.deactivateAccount(confirmation: "DELETE")
            // Account deletion successful - sign out user
            await sessionManager.logout()
            // Show success message (optional, since we're logging out)
        } catch {
            errorMessage = error.localizedDescription
            showError = true
            isDeletingAccount = false
        }
    }
}

#Preview {
    AccountView()
}
