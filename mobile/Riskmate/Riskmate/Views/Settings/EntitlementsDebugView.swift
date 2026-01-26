import SwiftUI

/// Dev-only debugging screen to show subscription truth state
/// Shows org_id, role, plan_code, status, cancel_at_period_end, period_end
/// Accessible via long-press on version info in AccountView (dev builds only)
struct EntitlementsDebugView: View {
    @State private var entitlements: EntitlementsResponse?
    @State private var isLoading = true
    @State private var errorMessage: String?
    
    var body: some View {
        ZStack {
            RMBackground()
            
            if isLoading {
                VStack(spacing: RMTheme.Spacing.lg) {
                    ProgressView()
                    Text("Loading entitlements...")
                        .font(RMTheme.Typography.body)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                }
            } else if let error = errorMessage {
                RMEmptyState(
                    icon: "exclamationmark.triangle.fill",
                    title: "Error",
                    message: error
                )
                .padding(RMTheme.Spacing.pagePadding)
            } else if let data = entitlements?.data {
                List {
                    Section("Organization") {
                        DebugRow(label: "Organization ID", value: data.organization_id)
                        DebugRow(label: "User ID", value: data.user_id)
                        DebugRow(label: "Role", value: data.role)
                    }
                    
                    Section("Subscription") {
                        DebugRow(label: "Plan Code", value: data.plan_code)
                        DebugRow(label: "Status", value: data.status)
                        DebugRow(label: "Cancel at Period End", value: data.flags.cancel_at_period_end ? "Yes" : "No")
                        if let periodEnd = data.flags.current_period_end {
                            DebugRow(label: "Current Period End", value: formatDate(periodEnd))
                        } else {
                            DebugRow(label: "Current Period End", value: "None")
                        }
                    }
                    
                    Section("Limits") {
                        DebugRow(label: "Seats Limit", value: formatLimit(data.limits.seats.limit))
                        DebugRow(label: "Seats Used", value: "\(data.limits.seats.used)")
                        DebugRow(label: "Seats Available", value: formatLimit(data.limits.seats.available))
                        DebugRow(label: "Jobs Monthly Limit", value: formatLimit(data.limits.jobs_monthly.limit))
                    }
                    
                    Section("Features") {
                        if data.features.isEmpty {
                            Text("No features enabled")
                                .foregroundColor(RMTheme.Colors.textTertiary)
                                .font(RMTheme.Typography.caption)
                        } else {
                            ForEach(data.features, id: \.self) { feature in
                                HStack {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundColor(RMTheme.Colors.success)
                                    Text(feature)
                                        .foregroundColor(RMTheme.Colors.textPrimary)
                                }
                            }
                        }
                    }
                    
                    Section("Flags") {
                        DebugRow(label: "Legal Accepted", value: data.flags.legal_accepted ? "Yes" : "No")
                        DebugRow(label: "Must Reset Password", value: data.flags.must_reset_password ? "Yes" : "No")
                    }
                }
                .scrollContentBackground(.hidden)
                .refreshable {
                    await loadEntitlements()
                }
            }
        }
        .navigationTitle("Entitlements Debug")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await loadEntitlements()
        }
    }
    
    private func loadEntitlements() async {
        isLoading = true
        errorMessage = nil
        
        do {
            let response = try await APIClient.shared.getEntitlements()
            entitlements = response
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    private func formatLimit(_ value: Int?) -> String {
        if let val = value {
            return "\(val)"
        }
        return "Unlimited"
    }
    
    private func formatDate(_ dateString: String) -> String {
        let formatter = ISO8601DateFormatter()
        if let date = formatter.date(from: dateString) {
            let displayFormatter = DateFormatter()
            displayFormatter.dateStyle = .medium
            displayFormatter.timeStyle = .short
            return displayFormatter.string(from: date)
        }
        return dateString
    }
}

private struct DebugRow: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text(label)
                .foregroundColor(RMTheme.Colors.textSecondary)
                .font(RMTheme.Typography.caption)
            Spacer()
            Text(value)
                .foregroundColor(RMTheme.Colors.textPrimary)
                .font(RMTheme.Typography.body)
                .textSelection(.enabled)
        }
    }
}

// Entitlements types are defined in APIClient.swift
