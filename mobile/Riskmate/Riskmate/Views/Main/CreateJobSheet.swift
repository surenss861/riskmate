import SwiftUI

/// Sheet for creating a new job - works offline (saves to pending) or online (API)
struct CreateJobSheet: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var jobsStore = JobsStore.shared
    @StateObject private var statusManager = ServerStatusManager.shared

    @State private var clientName = ""
    @State private var jobType = ""
    @State private var location = ""
    @State private var isSaving = false
    @State private var errorMessage: String?

    private var isOffline: Bool { !statusManager.isOnline }
    private var canSave: Bool {
        !clientName.trimmingCharacters(in: .whitespaces).isEmpty &&
        !jobType.trimmingCharacters(in: .whitespaces).isEmpty &&
        !location.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if isOffline {
                    HStack(spacing: RMTheme.Spacing.sm) {
                        Image(systemName: "wifi.slash")
                            .foregroundColor(RMTheme.Colors.warning)
                        Text("You're offline. This job will sync when you're back online.")
                            .font(RMTheme.Typography.bodySmall)
                            .foregroundColor(RMTheme.Colors.textSecondary)
                    }
                    .padding(RMTheme.Spacing.md)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RMTheme.Colors.warning.opacity(0.15))
                    .padding(.horizontal, RMTheme.Spacing.pagePadding)
                    .padding(.top, RMTheme.Spacing.sm)
                }

                Form {
                    Section {
                        TextField("Client name", text: $clientName)
                            .textContentType(.organizationName)
                            .autocapitalization(.words)
                        TextField("Job type", text: $jobType)
                            .textContentType(.jobTitle)
                            .autocapitalization(.words)
                        TextField("Location", text: $location)
                            .textContentType(.fullStreetAddress)
                            .autocapitalization(.words)
                    } header: {
                        Text("Job Details")
                    }

                    if let msg = errorMessage {
                        Section {
                            Text(msg)
                                .font(RMTheme.Typography.caption)
                                .foregroundColor(RMTheme.Colors.error)
                        }
                    }
                }
                .scrollContentBackground(.hidden)
            }
            .background(RMTheme.Colors.background)
            .navigationTitle("New Job")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .foregroundColor(RMTheme.Colors.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isOffline ? "Save Offline" : "Save") {
                        Task { await saveJob() }
                    }
                    .fontWeight(.semibold)
                    .foregroundColor(canSave ? RMTheme.Colors.accent : RMTheme.Colors.textTertiary)
                    .disabled(!canSave || isSaving)
                }
            }
        }
    }

    private func saveJob() async {
        guard canSave else { return }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        let name = clientName.trimmingCharacters(in: .whitespaces)
        let type = jobType.trimmingCharacters(in: .whitespaces)
        let loc = location.trimmingCharacters(in: .whitespaces)

        do {
            let job = try await jobsStore.createJob(clientName: name, jobType: type, location: loc)
            Haptics.success()
            if !isOffline {
                ToastCenter.shared.show("Job created", systemImage: "checkmark.circle.fill", style: .success)
            }
            // "Saved offline" toast is shown by JobsStore.createJob for the offline path
            dismiss()
            Analytics.shared.trackJobCreated(jobId: job.id, wasOffline: isOffline)
        } catch {
            errorMessage = error.localizedDescription
            ToastCenter.shared.show(
                error.localizedDescription,
                systemImage: "exclamationmark.triangle",
                style: .error
            )
        }
    }
}

#Preview {
    CreateJobSheet()
}
