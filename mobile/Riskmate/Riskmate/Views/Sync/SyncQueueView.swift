import SwiftUI

/// Shows all pending sync operations - status, retry for failed, manual sync, estimated time
/// Includes queued/uploading evidence from BackgroundUploadManager so banner count matches queue view
struct SyncQueueView: View {
    @StateObject private var syncEngine = SyncEngine.shared
    @StateObject private var uploadManager = BackgroundUploadManager.shared
    @StateObject private var cache = OfflineCache.shared
    @StateObject private var statusManager = ServerStatusManager.shared
    @Environment(\.dismiss) private var dismiss
    @State private var isRetryingUploads = false
    @State private var conflictToResolve: SyncConflict?
    @State private var showConflictHistory = false

    private var pendingOps: [SyncOperation] {
        syncEngine.pendingOperations
    }

    /// Queued/uploading evidence items (same set the banner counts)
    private var queuedUploads: [UploadTask] {
        uploadManager.uploads.filter { upload in
            if case .queued = upload.state { return true }
            if case .uploading = upload.state { return true }
            if case .failed = upload.state { return true }
            return false
        }
    }

    private var hasPendingItems: Bool {
        !pendingOps.isEmpty || !queuedUploads.isEmpty
    }

    /// Uploads that Sync Now can act on: failed (retry) or queued (start)
    private var actionableUploads: [UploadTask] {
        queuedUploads.filter { upload in
            if case .failed = upload.state { return true }
            if case .queued = upload.state { return true }
            return false
        }
    }

    /// Show Sync Now only when it will act on something (pending ops or actionable uploads)
    private var canSyncNow: Bool {
        !pendingOps.isEmpty || !actionableUploads.isEmpty
    }

    private var estimatedSyncTime: String {
        let count = pendingOps.count + queuedUploads.count
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
                        if !hasPendingItems {
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
                                            onRetry: { syncEngine.retryOperation(operationId: op.id) }
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

                                if !queuedUploads.isEmpty {
                                    Section {
                                        ForEach(queuedUploads) { upload in
                                            SyncQueueUploadRow(
                                                upload: upload,
                                                onRetry: {
                                                    Task {
                                                        do {
                                                            try await uploadManager.retryUpload(upload)
                                                        } catch {
                                                            ToastCenter.shared.show(
                                                                error.localizedDescription,
                                                                systemImage: "exclamationmark.triangle",
                                                                style: .error
                                                            )
                                                        }
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
                                        Text("Evidence uploads (\(queuedUploads.count))")
                                    }
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
                    ToolbarItem(placement: .topBarLeading) {
                        Button {
                            Haptics.tap()
                            showConflictHistory = true
                        } label: {
                            Label("Conflicts", systemImage: "arrow.triangle.2.circlepath")
                                .font(RMTheme.Typography.caption)
                        }
                        .foregroundColor(RMTheme.Colors.textSecondary)
                    }
                    ToolbarItem(placement: .primaryAction) {
                        if hasPendingItems {
                            if statusManager.isOnline {
                                if canSyncNow {
                                    Button {
                                        Haptics.tap()
                                        Task {
                                            // 1. Sync pending operations (jobs, hazards, controls)
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
                                            // 2. Retry failed uploads and start queued ones
                                            let toProcess = actionableUploads
                                            if !toProcess.isEmpty {
                                                isRetryingUploads = true
                                                defer { isRetryingUploads = false }
                                                for upload in toProcess {
                                                    do {
                                                        try await uploadManager.retryUpload(upload)
                                                    } catch {
                                                        ToastCenter.shared.show(
                                                            error.localizedDescription,
                                                            systemImage: "exclamationmark.triangle",
                                                            style: .error
                                                        )
                                                    }
                                                }
                                            }
                                        }
                                    } label: {
                                        if syncEngine.isSyncing || isRetryingUploads {
                                            ProgressView()
                                                .scaleEffect(0.9)
                                        } else {
                                            Text("Sync Now")
                                                .fontWeight(.semibold)
                                        }
                                    }
                                    .disabled(syncEngine.isSyncing || isRetryingUploads)
                                    .foregroundColor(RMTheme.Colors.accent)
                                }
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
                .onChange(of: syncEngine.pendingConflicts) { _, new in
                    if conflictToResolve == nil, let first = new.first {
                        conflictToResolve = first
                    }
                }
                .onAppear {
                    syncEngine.refreshPendingOperations()
                    syncEngine.refreshPendingConflictsFromDB()
                    if conflictToResolve == nil, let first = syncEngine.pendingConflicts.first {
                        conflictToResolve = first
                    }
                }
                .sheet(item: $conflictToResolve) { conflict in
                    ConflictResolutionSheet(
                        conflict: conflict,
                        entityLabel: entityLabel(for: conflict),
                        onResolve: { outcome in
                            var op = syncEngine.pendingOperations.first { $0.id == conflict.id }
                            if op == nil {
                                op = OfflineDatabase.shared.getSyncQueue().first { $0.id == conflict.id }
                            }
                            var resolvedValue: [String: Any]?
                            var entityType: String? = conflict.entityType
                            var entityId: String? = conflict.entityId
                            var operationType: String?
                            if outcome.strategy == .localWins || outcome.strategy == .merge {
                                if let op = op {
                                    if let dict = try? JSONSerialization.jsonObject(with: op.data) as? [String: Any] {
                                        resolvedValue = dict
                                        if let perField = outcome.perFieldResolvedValues, !perField.isEmpty {
                                            var merged = dict
                                            for (k, v) in perField { merged[k] = v }
                                            resolvedValue = merged
                                        }
                                    }
                                    entityType = entityType ?? entityTypeFromOperation(op.type)
                                    entityId = entityId ?? op.entityId
                                    operationType = op.type.apiTypeString
                                } else {
                                    // Queued op not found: reconstruct local payload from storage
                                    let et = conflict.entityType
                                    let eid = conflict.entityId
                                    guard !et.isEmpty, !eid.isEmpty else {
                                        throw NSError(domain: "ConflictResolution", code: 1, userInfo: [NSLocalizedDescriptionKey: "Cannot resolve: missing entity info"])
                                    }
                                    var base = syncEngine.getLocalPayloadForConflict(entityType: et, entityId: eid)
                                    if let perField = outcome.perFieldResolvedValues, !perField.isEmpty, var merged = base {
                                        for (k, v) in perField { merged[k] = v }
                                        base = merged
                                    }
                                    resolvedValue = base
                                    entityType = et
                                    entityId = eid
                                    operationType = operationTypeFromEntityType(et)
                                }
                                guard resolvedValue != nil, entityType != nil, entityId != nil else {
                                    throw NSError(domain: "ConflictResolution", code: 2, userInfo: [NSLocalizedDescriptionKey: "Cannot resolve: payload or required metadata missing"])
                                }
                            }
                            try await syncEngine.resolveConflict(
                                operationId: conflict.id,
                                strategy: outcome.strategy,
                                resolvedValue: resolvedValue,
                                entityType: entityType,
                                entityId: entityId,
                                operationType: operationType
                            )
                            conflictToResolve = syncEngine.pendingConflicts.first
                            _ = try? await syncEngine.syncPendingOperations()
                            JobsStore.shared.refreshPendingJobs()
                            NotificationCenter.default.post(name: .syncConflictHistoryDidChange, object: nil)
                            ToastCenter.shared.show("Conflict resolved", systemImage: "checkmark.circle", style: .success)
                        },
                        onCancel: {
                            conflictToResolve = nil
                        }
                    )
                }
                .sheet(isPresented: $showConflictHistory) {
                    ConflictHistoryView()
                }
        }
    }

    private func entityLabel(for conflict: SyncConflict) -> String {
        switch conflict.entityType {
        case "job": return "job"
        case "hazard": return "hazard"
        case "control": return "control"
        default: return conflict.entityType
        }
    }

    private func entityTypeFromOperation(_ type: OperationType) -> String {
        switch type {
        case .createJob, .updateJob, .deleteJob: return "job"
        case .createHazard, .updateHazard, .deleteHazard: return "hazard"
        case .createControl, .updateControl, .deleteControl: return "control"
        }
    }

    private func operationTypeFromEntityType(_ entityType: String) -> String {
        switch entityType {
        case "job": return "update_job"
        case "hazard": return "update_hazard"
        case "control": return "update_control"
        default: return "update_job"
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
        if operation.isFailed {
            if let err = operation.lastError, !err.isEmpty {
                return "Failed"
            }
            if operation.retryCount > 0 {
                return "Retry \(operation.retryCount)x"
            }
            return "Failed"
        }
        return "Pending"
    }

    private var statusColor: Color {
        operation.isFailed ? RMTheme.Colors.error : RMTheme.Colors.textSecondary
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
                if let err = operation.lastError, !err.isEmpty {
                    Text(err)
                        .font(RMTheme.Typography.captionSmall)
                        .foregroundColor(RMTheme.Colors.error)
                        .lineLimit(2)
                }
                if operation.isFailed {
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

/// Row for a queued/uploading/failed evidence upload
struct SyncQueueUploadRow: View {
    let upload: UploadTask
    let onRetry: () -> Void

    private var statusLabel: String {
        switch upload.state {
        case .queued: return "Queued"
        case .uploading:
            if upload.progress > 0, upload.progress < 1 {
                return "Uploading \(Int(upload.progress * 100))%"
            }
            return "Uploading"
        case .synced: return "Synced"
        case .failed: return "Failed"
        }
    }

    private var statusColor: Color {
        switch upload.state {
        case .queued, .uploading: return RMTheme.Colors.textSecondary
        case .synced: return RMTheme.Colors.success
        case .failed: return RMTheme.Colors.error
        }
    }

    private var errorMessage: String? {
        if case .failed(let err) = upload.state { return err }
        return nil
    }

    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                HStack {
                    Text("Evidence: \(upload.fileName)")
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
                if upload.retryCount > 0 {
                    Text("Retry \(upload.retryCount)x")
                        .font(RMTheme.Typography.captionSmall)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                }
                if let err = errorMessage {
                    Text(err)
                        .font(RMTheme.Typography.captionSmall)
                        .foregroundColor(RMTheme.Colors.error)
                        .lineLimit(2)
                }
                if case .failed = upload.state {
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
}

#Preview {
    SyncQueueView()
}
