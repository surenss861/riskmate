import SwiftUI
import UIKit

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
    var label: String {
        switch self {
        case .repair: return "Repair"
        case .install: return "Install"
        case .maintenance: return "Maintenance"
        case .inspection: return "Inspection"
        case .other: return "Other"
        }
    }
}

/// Sheet for creating a new job - works offline (saves to pending) or online (API). Backend requires client_name, client_type, job_type, location.
struct CreateJobSheet: View {
    private enum Field: Hashable {
        case clientName
        case location
        case title
    }

    @Environment(\.dismiss) private var dismiss
    /// Singletons: use @ObservedObject so SwiftUI doesn't "own" lifecycle (avoids duplicate subscriptions).
    @ObservedObject private var jobsStore = JobsStore.shared
    @ObservedObject private var statusManager = ServerStatusManager.shared

    @State private var clientName = ""
    @State private var location = ""
    @State private var title = ""
    @State private var clientType: CreateJobClientType = .residential
    @State private var jobType: CreateJobJobType = .repair
    @State private var isSaving = false
    @State private var errorMessage: String?

    @FocusState private var focusedField: Field?

    private var isOffline: Bool { !statusManager.isOnline }
    private var trimmedClientName: String { clientName.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var trimmedLocation: String { location.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var trimmedTitle: String {
        let t = title.trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? "" : t
    }

    private var canSave: Bool {
        !trimmedClientName.isEmpty && !trimmedLocation.isEmpty && !isSaving
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
                            .focused($focusedField, equals: .clientName)
                            .textContentType(.organizationName)
                            .textInputAutocapitalization(.words)
                            .autocorrectionDisabled(true)
                            .submitLabel(.next)
                            .onSubmit { focusedField = .location }

                        TextField("Location", text: $location)
                            .focused($focusedField, equals: .location)
                            .textContentType(.fullStreetAddress)
                            .textInputAutocapitalization(.words)
                            .autocorrectionDisabled(true)
                            .submitLabel(.next)
                            .onSubmit { focusedField = .title }

                        TextField("Title (optional)", text: $title)
                            .focused($focusedField, equals: .title)
                            .textContentType(.jobTitle)
                            .textInputAutocapitalization(.sentences)
                            .autocorrectionDisabled(false)
                            .submitLabel(.done)
                            .onSubmit { submit() }

                        LabeledContent("Client type") {
                            Picker("Client type", selection: $clientType) {
                                ForEach(CreateJobClientType.allCases) { type in
                                    Text(type.label).tag(type)
                                }
                            }
                            .pickerStyle(.menu)
                        }
                        .onTapGesture { focusedField = nil }

                        LabeledContent("Job type") {
                            Picker("Job type", selection: $jobType) {
                                ForEach(CreateJobJobType.allCases) { type in
                                    Text(type.label).tag(type)
                                }
                            }
                            .pickerStyle(.menu)
                        }
                        .onTapGesture { focusedField = nil }
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
                    .disabled(isSaving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isOffline ? "Save Offline" : "Save") {
                        submit()
                    }
                    .fontWeight(.semibold)
                    .foregroundColor(canSave ? RMTheme.Colors.accent : RMTheme.Colors.textTertiary)
                    .disabled(!canSave)
                }
            }
            .onAppear {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                    focusedField = .clientName
                }
            }
        }
    }

    private func submit() {
        guard canSave else { return }
        Task { await saveJob() }
    }

    private func saveJob() async {
        guard canSave else { return }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        do {
            let job = try await jobsStore.createJob(
                clientName: trimmedClientName,
                clientType: clientType.rawValue,
                jobType: jobType.rawValue,
                location: trimmedLocation,
                title: trimmedTitle.isEmpty ? nil : trimmedTitle
            )
            if isOffline {
                Haptics.impact(.light)
            } else {
                UINotificationFeedbackGenerator().notificationOccurred(.success)
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
