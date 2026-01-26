import SwiftUI

/// Dev-only debugging screen to show environment + entitlements truth state
/// Shows backend URL, Supabase URL, org_id, entitlements JSON
/// Accessible via EntitlementsDebugView (dev builds only)
struct EnvironmentDebugView: View {
    @StateObject private var entitlements = EntitlementsManager.shared
    @State private var entitlementsJSON: String = ""
    
    var body: some View {
        ZStack {
            RMBackground()
            
            List {
                Section("Environment") {
                    EntitlementsDebugRow(label: "Backend URL", value: AppConfig.shared.backendURL)
                    EntitlementsDebugRow(label: "Supabase URL", value: AppConfig.shared.supabaseURL)
                    EntitlementsDebugRow(label: "Supabase Key Prefix", value: String(AppConfig.shared.supabaseAnonKey.prefix(20)) + "...")
                }
                
                if let data = entitlements.entitlements {
                    Section("Organization") {
                        EntitlementsDebugRow(label: "Organization ID", value: data.organization_id)
                        EntitlementsDebugRow(label: "User ID", value: data.user_id)
                        EntitlementsDebugRow(label: "Role", value: data.role)
                    }
                    
                    Section("Subscription") {
                        EntitlementsDebugRow(label: "Plan Code", value: data.plan_code)
                        EntitlementsDebugRow(label: "Status", value: data.status)
                        EntitlementsDebugRow(label: "Cancel at Period End", value: data.flags.cancel_at_period_end ? "Yes" : "No")
                        if let periodEnd = data.flags.current_period_end {
                            EntitlementsDebugRow(label: "Current Period End", value: formatDate(periodEnd))
                        } else {
                            EntitlementsDebugRow(label: "Current Period End", value: "None")
                        }
                    }
                    
                    Section("Limits") {
                        EntitlementsDebugRow(label: "Seats Limit", value: formatLimit(data.limits.seats.limit))
                        EntitlementsDebugRow(label: "Seats Used", value: "\(data.limits.seats.used)")
                        EntitlementsDebugRow(label: "Seats Available", value: formatLimit(data.limits.seats.available))
                        EntitlementsDebugRow(label: "Jobs Monthly Limit", value: formatLimit(data.limits.jobs_monthly.limit))
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
                    
                    Section("Raw JSON") {
                        Text(entitlementsJSON)
                            .font(.system(.caption, design: .monospaced))
                            .foregroundColor(RMTheme.Colors.textSecondary)
                            .textSelection(.enabled)
                    }
                } else {
                    Section {
                        if entitlements.isLoading {
                            HStack {
                                ProgressView()
                                Text("Loading entitlements...")
                                    .foregroundColor(RMTheme.Colors.textSecondary)
                            }
                        } else if let error = entitlements.lastError {
                            Text("Error: \(error)")
                                .foregroundColor(RMTheme.Colors.error)
                        } else {
                            Text("No entitlements loaded")
                                .foregroundColor(RMTheme.Colors.textTertiary)
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .refreshable {
                await entitlements.refresh(force: true)
                updateJSON()
            }
            .task {
                await entitlements.refresh(force: true)
                updateJSON()
            }
        }
        .navigationTitle("Environment Debug")
        .navigationBarTitleDisplayMode(.inline)
    }
    
    private func updateJSON() {
        guard let data = entitlements.entitlements else {
            entitlementsJSON = "No entitlements"
            return
        }
        
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        if let jsonData = try? encoder.encode(data),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            entitlementsJSON = jsonString
        } else {
            entitlementsJSON = "Failed to encode JSON"
        }
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
