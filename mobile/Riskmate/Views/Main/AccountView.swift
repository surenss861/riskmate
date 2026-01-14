import SwiftUI

struct AccountView: View {
    @StateObject private var sessionManager = SessionManager.shared
    
    @State private var isEditingOrgName = false
    @State private var editedOrgName = ""
    @State private var showError = false
    @State private var errorMessage = ""
    
    var body: some View {
        NavigationView {
            List {
                if let org = sessionManager.currentOrganization {
                    Section("Organization") {
                        HStack {
                            Text("Name")
                            Spacer()
                            if isEditingOrgName {
                                TextField("Organization Name", text: $editedOrgName)
                                    .textFieldStyle(.plain)
                                    .multilineTextAlignment(.trailing)
                            } else {
                                Text(org.name)
                                    .foregroundColor(.secondary)
                            }
                        }
                        
                        if isEditingOrgName {
                            Button("Save") {
                                saveOrganizationName()
                            }
                            .disabled(editedOrgName.isEmpty || editedOrgName == org.name)
                            
                            Button("Cancel", role: .cancel) {
                                isEditingOrgName = false
                                editedOrgName = org.name
                            }
                        } else {
                            Button("Edit") {
                                editedOrgName = org.name
                                isEditingOrgName = true
                            }
                        }
                    }
                }
                
                Section {
                    Button("Sign Out", role: .destructive) {
                        Task {
                            await sessionManager.logout()
                        }
                    }
                }
            }
            .navigationTitle("Account")
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
    
    private func saveOrganizationName() {
        Task {
            do {
                let updated = try await APIClient.shared.updateOrganization(name: editedOrgName)
                sessionManager.currentOrganization = updated
                isEditingOrgName = false
            } catch {
                errorMessage = error.localizedDescription
                showError = true
            }
        }
    }
}

#Preview {
    AccountView()
}
