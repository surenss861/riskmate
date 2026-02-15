import SwiftUI

/// Shows all pending sync operations - status, retry for failed, manual sync, estimated time
struct SyncQueueView: View {
    @StateObject private var syncEngine = SyncEngine.shared
    @StateObject private var cache = OfflineCache.shared
    @StateObject private var statusManager = ServerStatusManager.shared
    @Environment(\.dismiss) private var dismiss

    private var pendingOps: [SyncOperation] {
        syncEngine.pendingOperations
    }

    private var estimatedSyncTime: String {
        let count = pendingOps.count
        if count == 0 { return "" }
        let seconds = max(2, count * 2) // ~2 seconds per operation
        if seconds < 60 { return "~\(seconds)s" }
        let mins = seconds / 60
        return "~\(mins) min"
    }

    var body: some View {
        NavigationStack {
            RMBackground()
                .overlay {
                    Group {
                        if pendingOps.isEmpty {
                            VStack(spacing: RMTheme.Spacing.lg) {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.system(size: 48))
                                    .foregroundColor(RMTheme.Colors.success)
                                Text("All synced")
                                    .font(RMTheme.Typography.title2)
                                    .foregroundColor(RMTheme.Colors.textPrimary)
                                Text("No pending operations. Your data is up to date.")
                                    .font(RMTheme.Typography.bodySmall)
                                    .foregroundColor(RMTheme.Colors.textSecondary)
                                    .multilineTextAlignment(.center)
                                    .padding(.horizontal)
                            }
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                        } else {
                            List {
                                Section {
                                    if !estimatedSyncTime.isEmpty {
                                        HStack {
                                            Text("Estimated sync time")
                                                .font(RMTheme.Typography.bodySmall)
                                                .foregroundColor(RMTheme.Colors.textSecondary)
                                            Spacer()
                                            Text(estimatedSyncTime)
                                                .font(RMTheme.Typography.bodySmallBold)
                                                .foregroundColor(RMTheme.Colors.textPrimary)
                                        }
                                    }
                                }

                                Section {
                                    ForEach(pendingOps) { op in
                                        SyncQueueItemRow(
                                            operation: op,
                                            onRetry: {
                                                Task {
                                                    try? await syncEngine.syncPendingOperations()
                                                }
                                            }
                                        )
                                        .listRowBackground(Color.clear)
                                        .listRowInsets(EdgeInsets(
                                            top: RMTheme.Spacing.sm,
                                            leading: RMTheme.Spacing.pagePadding,
                                            bottom: RMTheme.Spacing.sm,
                                            trailing: RMTheme.Spacing.pagePadding
                                        ))
                                    }
                                } header: {
                                    Text("Pending (\(pendingOps.count))")
                                }
                            }
                            .listStyle(.plain)
                            .scrollContentBackground(.hidden)
                        }
                    }
                }
                .navigationTitle("Sync Queue")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Done") {
                            dismiss()
                        }
                        .foregroundColor(RMTheme.Colors.accent)
                    }
                    ToolbarItem(placement: .primaryAction) {
                        if !pendingOps.isEmpty {
                            if statusManager.isOnline {
                                Button {
                                    Haptics.tap()
                                    Task {
                                        do {
                                            _ = try await syncEngine.syncPendingOperations()
                                            JobsStore.shared.refreshPendingJobs()
                                        } catch {
                                            ToastCenter.shared.show(
                                                error.localizedDescription,
                                                systemImage: "exclamationmark.triangle",
                                                style: .error
                                            )
                                        }
                                    }
                                } label: {
                                    if syncEngine.isSyncing {
                                        ProgressView()
                                            .scaleEffect(0.9)
                                    } else {
                                        Text("Sync Now")
                                            .fontWeight(.semibold)
                                    }
                                }
                                .disabled(syncEngine.isSyncing)
                                .foregroundColor(RMTheme.Colors.accent)
                            } else {
                                Button {
                                    Haptics.tap()
                                    Task { await statusManager.checkHealth() }
                                } label: {
                                    Label("Check connection", systemImage: "wifi.slash")
                                        .font(RMTheme.Typography.bodySmallBold)
                                }
                                .foregroundColor(RMTheme.Colors.accent)
                            }
                        }
                    }
                }
                .onChange(of: syncEngine.isSyncing) { _, isSyncing in
                    if !isSyncing {
                        syncEngine.refreshPendingOperations()
                        JobsStore.shared.refreshPendingJobs()
                    }
                }
                .onAppear {
                    syncEngine.refreshPendingOperations()
                }
        }
    }
}

/// Single row for a sync operation
struct SyncQueueItemRow: View {
    let operation: SyncOperation
    let onRetry: () -> Void

    private var operationTitle: String {
        switch operation.type {
        case .createJob: return "Create Job"
        case .updateJob: return "Update Job"
        case .deleteJob: return "Delete Job"
        case .createHazard: return "Add Hazard"
        case .updateHazard: return "Update Hazard"
        case .deleteHazard: return "Delete Hazard"
        case .createControl: return "Add Control"
        case .updateControl: return "Update Control"
        case .deleteControl: return "Delete Control"
        }
    }

    private var entitySummary: String {
        if let dict = try? JSONSerialization.jsonObject(with: operation.data) as? [String: Any] {
            if let name = dict["client_name"] as? String ?? dict["clientName"] as? String {
                return name
            }
            if let desc = dict["description"] as? String, !desc.isEmpty {
                return String(desc.prefix(40))
            }
        }
        return "Created \(relativeTime(operation.clientTimestamp))"
    }

    private var statusLabel: String {
        if let last = operation.lastAttempt, operation.retryCount > 0 {
            return "Retry \(operation.retryCount)x"
        }
        return "Pending"
    }

    private var statusColor: Color {
        operation.retryCount > 0 ? RMTheme.Colors.warning : RMTheme.Colors.textSecondary
    }

    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                HStack {
                    Text(operationTitle)
                        .font(RMTheme.Typography.bodySmallBold)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    Spacer()
                    Text(statusLabel)
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(statusColor)
                        .padding(.horizontal, RMTheme.Spacing.sm)
                        .padding(.vertical, 4)
                        .background(statusColor.opacity(0.2))
                        .clipShape(Capsule())
                }
                Text(entitySummary)
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                    .lineLimit(1)
                if operation.retryCount > 0 {
                    Button {
                        Haptics.tap()
                        onRetry()
                    } label: {
                        Label("Retry", systemImage: "arrow.clockwise")
                            .font(RMTheme.Typography.captionBold)
                            .foregroundColor(RMTheme.Colors.accent)
                    }
                }
            }
        }
    }

    private func relativeTime(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

#Preview {
    SyncQueueView()
}
