import SwiftUI

/// Sheet for editing job details - works offline (queues update) or online (API)
struct EditJobSheet: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var statusManager = ServerStatusManager.shared

    let job: Job
    var jobBinding: Binding<Job?>? = nil
    let onSave: (Job) async throws -> Void

    @State private var clientName: String
    @State private var jobType: String
    @State private var location: String
    @State private var status: String
    @State private var isSaving = false
    @State private var errorMessage: String?

    init(job: Job, jobBinding: Binding<Job?>? = nil, onSave: @escaping (Job) async throws -> Void) {
        self.job = job
        self.jobBinding = jobBinding
        self.onSave = onSave
        _clientName = State(initialValue: job.clientName)
        _jobType = State(initialValue: job.jobType)
        _location = State(initialValue: job.location)
        _status = State(initialValue: job.status)
    }

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
                        Text("Changes will sync when you're back online.")
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
                        TextField("Job type", text: $jobType)
                            .textContentType(.jobTitle)
                        TextField("Location", text: $location)
                            .textContentType(.fullStreetAddress)
                        Picker("Status", selection: $status) {
                            Text("Draft").tag("draft")
                            Text("Active").tag("active")
                            Text("In Progress").tag("in_progress")
                            Text("Completed").tag("completed")
                            Text("Cancelled").tag("cancelled")
                        }
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
            .navigationTitle("Edit Job")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .foregroundColor(RMTheme.Colors.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
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

        let updatedJob = Job(
            id: job.id,
            clientName: name,
            jobType: type,
            location: loc,
            status: status,
            riskScore: job.riskScore,
            riskLevel: job.riskLevel,
            createdAt: job.createdAt,
            updatedAt: ISO8601DateFormatter().string(from: Date()),
            createdBy: job.createdBy,
            evidenceCount: job.evidenceCount,
            evidenceRequired: job.evidenceRequired,
            controlsCompleted: job.controlsCompleted,
            controlsTotal: job.controlsTotal
        )

        do {
            try await onSave(updatedJob)
            jobBinding?.wrappedValue = updatedJob
            Haptics.success()
            if isOffline {
                ToastCenter.shared.show("Changes will sync", systemImage: "wifi.slash", style: .info)
            } else {
                ToastCenter.shared.show("Job updated", systemImage: "checkmark.circle.fill", style: .success)
            }
            dismiss()
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
