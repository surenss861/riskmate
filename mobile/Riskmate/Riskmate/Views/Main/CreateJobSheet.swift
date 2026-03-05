import SwiftUI

// MARK: - Create Job enums (backend client_type / job_type)

enum CreateJobClientType: String, CaseIterable, Identifiable {
    case residential
    case commercial
    case propertyManagement = "property_management"
    case unknown = "other"

    var id: String { rawValue }
    var label: String {
        switch self {
        case .residential: return "Residential"
        case .commercial: return "Commercial"
        case .propertyManagement: return "Property Mgmt"
        case .unknown: return "Other"
        }
    }
}

enum CreateJobJobType: String, CaseIterable, Identifiable {
    case repair
    case install
    case maintenance
    case inspection
    case other

    var id: String { rawValue }
    var label: String { rawValue.capitalized }
}

/// Sheet for creating a new job - works offline (saves to pending) or online (API). Backend requires client_name, client_type, job_type, location.
struct CreateJobSheet: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var jobsStore = JobsStore.shared
    @StateObject private var statusManager = ServerStatusManager.shared

    @State private var clientName = ""
    @State private var location = ""
    @State private var title = ""
    @State private var clientType: CreateJobClientType = .residential
    @State private var jobType: CreateJobJobType = .repair
    @State private var isSaving = false
    @State private var errorMessage: String?

    private var isOffline: Bool { !statusManager.isOnline }
    private var canSave: Bool {
        !clientName.trimmingCharacters(in: .whitespaces).isEmpty &&
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
                        TextField("Location", text: $location)
                            .textContentType(.fullStreetAddress)
                            .autocapitalization(.words)
                        TextField("Title (optional)", text: $title)
                            .textContentType(.jobTitle)
                            .autocapitalization(.words)
                        Picker("Client type", selection: $clientType) {
                            ForEach(CreateJobClientType.allCases) { t in
                                Text(t.label).tag(t)
                            }
                        }
                        Picker("Job type", selection: $jobType) {
                            ForEach(CreateJobJobType.allCases) { t in
                                Text(t.label).tag(t)
                            }
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
        let loc = location.trimmingCharacters(in: .whitespaces)
        let titleTrimmed = title.trimmingCharacters(in: .whitespaces)
        let titleOpt = titleTrimmed.isEmpty ? nil : titleTrimmed

        do {
            let job = try await jobsStore.createJob(
                clientName: name,
                clientType: clientType.rawValue,
                jobType: jobType.rawValue,
                location: loc,
                title: titleOpt
            )
            Haptics.success()
            if !isOffline {
                ToastCenter.shared.show("Job created", systemImage: "checkmark.circle.fill", style: .success)
            }
            dismiss()
            Analytics.shared.trackJobCreated(jobId: job.id, wasOffline: isOffline)
        } catch {
            errorMessage = (error as? APIError)?.message ?? error.localizedDescription
            ToastCenter.shared.show(
                errorMessage ?? "Couldn't create job.",
                systemImage: "exclamationmark.triangle",
                style: .error
            )
        }
    }
}

#Preview {
    CreateJobSheet()
}
