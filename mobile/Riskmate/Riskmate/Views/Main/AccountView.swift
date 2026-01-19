import SwiftUI

struct AccountView: View {
    @StateObject private var sessionManager = SessionManager.shared
    
    @State private var isEditingOrgName = false
    @State private var editedOrgName = ""
    @State private var showError = false
    @State private var errorMessage = ""
    @State private var isLoading = false
    
    private var versionString: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "Unknown"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "Unknown"
        return "\(version) (\(build))"
    }
    
    var body: some View {
        ZStack {
            RMBackground()
            
            List {
                if let org = sessionManager.currentOrganization {
                    Section {
                        HStack {
                            Text("Organization Name")
                                .foregroundColor(RMTheme.Colors.textPrimary)
                            Spacer()
                            if isEditingOrgName {
                                TextField("Organization Name", text: $editedOrgName)
                                    .textFieldStyle(.plain)
                                    .multilineTextAlignment(.trailing)
                                    .foregroundColor(RMTheme.Colors.textPrimary)
                            } else {
                                Text(org.name)
                                    .foregroundColor(RMTheme.Colors.textSecondary)
                            }
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
                }
                
                // Sign Out - own section, destructive style
                Section {
                    Button("Sign Out", role: .destructive) {
                        let generator = UINotificationFeedbackGenerator()
                        generator.notificationOccurred(.warning)
                        Task {
                            await sessionManager.logout()
                        }
                    }
                    .listRowBackground(Color.clear)
                }
                
                // Version info (auditor-friendly)
                Section {
                    HStack {
                        Text("Version")
                            .foregroundColor(RMTheme.Colors.textPrimary)
                        Spacer()
                        Text(versionString)
                            .foregroundColor(RMTheme.Colors.textSecondary)
                            .font(.system(.body, design: .monospaced))
                    }
                    .listRowBackground(RMTheme.Colors.surface.opacity(0.5))
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
}

#Preview {
    AccountView()
}
