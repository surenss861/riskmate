import SwiftUI

struct AccountView: View {
    @StateObject private var sessionManager = SessionManager.shared
    
    @State private var isEditingOrgName = false
    @State private var editedOrgName = ""
    @State private var showError = false
    @State private var errorMessage = ""
    @State private var isLoading = false
    
    var body: some View {
        NavigationView {
            ZStack {
                DesignSystem.Colors.background
                    .ignoresSafeArea()
                
                List {
                    if let org = sessionManager.currentOrganization {
                        Section {
                            HStack {
                                Text("Organization Name")
                                    .foregroundColor(DesignSystem.Colors.textPrimary)
                                Spacer()
                                if isEditingOrgName {
                                    TextField("Organization Name", text: $editedOrgName)
                                        .textFieldStyle(.plain)
                                        .multilineTextAlignment(.trailing)
                                        .foregroundColor(DesignSystem.Colors.textPrimary)
                                } else {
                                    Text(org.name)
                                        .foregroundColor(DesignSystem.Colors.textSecondary)
                                }
                            }
                            .listRowBackground(DesignSystem.Colors.surface.opacity(0.5))
                            
                            if isEditingOrgName {
                                Button(action: saveOrganizationName) {
                                    if isLoading {
                                        HStack {
                                            ProgressView()
                                                .progressViewStyle(CircularProgressViewStyle(tint: DesignSystem.Colors.accent))
                                            Text("Saving...")
                                                .foregroundColor(DesignSystem.Colors.accent)
                                        }
                                    } else {
                                        Text("Save")
                                            .foregroundColor(DesignSystem.Colors.accent)
                                    }
                                }
                                .disabled(isLoading || editedOrgName.isEmpty || editedOrgName == org.name)
                                .listRowBackground(DesignSystem.Colors.surface.opacity(0.5))
                                
                                Button("Cancel", role: .cancel) {
                                    isEditingOrgName = false
                                    editedOrgName = org.name
                                }
                                .listRowBackground(DesignSystem.Colors.surface.opacity(0.5))
                            } else {
                                Button("Edit") {
                                    editedOrgName = org.name
                                    isEditingOrgName = true
                                }
                                .foregroundColor(DesignSystem.Colors.accent)
                                .listRowBackground(DesignSystem.Colors.surface.opacity(0.5))
                            }
                        } header: {
                            Text("Organization")
                                .foregroundColor(DesignSystem.Colors.textSecondary)
                        }
                    }
                    
                    Section {
                        Button("Sign Out", role: .destructive) {
                            Task {
                                await sessionManager.logout()
                            }
                        }
                        .listRowBackground(DesignSystem.Colors.surface.opacity(0.5))
                    }
                }
                .scrollContentBackground(.hidden)
                .navigationTitle("Account")
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
        }
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
