import Foundation
import Combine

/// Result of a sync run
struct SyncResult {
    let succeeded: Int
    let failed: Int
    let conflicts: [SyncConflict]
    let errors: [String]
}

/// Core offline sync engine: batch upload, incremental download, conflict detection, retry
@MainActor
final class SyncEngine: ObservableObject {
    static let shared = SyncEngine()

    @Published private(set) var isSyncing: Bool = false
    @Published private(set) var lastResult: SyncResult?
    @Published private(set) var pendingOperations: [SyncOperation] = []
    /// Conflicts from last sync or from DB; UI shows resolution sheet when non-empty
    @Published private(set) var pendingConflicts: [SyncConflict] = []

    private let db = OfflineDatabase.shared
    private let maxRetries = 3
    private var queueObserver: NSObjectProtocol?
    private var reachabilityCancellable: AnyCancellable?
    private var wasOffline: Bool

    private init() {
        wasOffline = !ServerStatusManager.shared.isOnline
        refreshPendingOperations()
        queueObserver = NotificationCenter.default.addObserver(
            forName: OfflineDatabase.syncQueueDidChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.refreshPendingOperations()
        }
        // Auto-sync when backend becomes reachable after being offline
        reachabilityCancellable = ServerStatusManager.shared.$isOnline
            .receive(on: DispatchQueue.main)
            .sink { [weak self] isOnline in
                guard let self = self else { return }
                if self.wasOffline && isOnline {
                    self.wasOffline = false
                    Task { @MainActor in
                        await self.autoSyncOnReconnect()
                    }
                } else if !isOnline {
                    self.wasOffline = true
                }
            }
    }

    private func autoSyncOnReconnect() async {
        guard db.pendingOperationsCount() > 0 else { return }
        do {
            _ = try await syncPendingOperations()
            JobsStore.shared.refreshPendingJobs()
        } catch {
            print("[SyncEngine] Auto-sync on reconnect failed: \(error.localizedDescription)")
        }
    }

    func refreshPendingOperations() {
        pendingOperations = db.getSyncQueue()
    }

    /// Sync all pending operations: upload first, then download changes
    func syncPendingOperations() async throws -> SyncResult {
        guard !isSyncing else {
            return SyncResult(succeeded: 0, failed: 0, conflicts: [], errors: ["Sync already in progress"])
        }
        isSyncing = true
        defer { isSyncing = false }

        var succeeded = 0
        var failed = 0
        var conflicts: [SyncConflict] = []
        var errors: [String] = []

        // 1. Upload local changes (batch)
        let ops = prioritizeOperations()
        guard !ops.isEmpty else {
            // No pending ops - fetch server changes; use distant past when no prior timestamp (first sync)
            let since = db.getLastSyncTimestamp() ?? Date.distantPast
            do {
                _ = try await fetchChanges(since: since)
                db.setLastSyncTimestamp(Date())
            } catch {
                lastResult = SyncResult(succeeded: 0, failed: 0, conflicts: [], errors: [error.localizedDescription])
                throw error
            }
            lastResult = SyncResult(succeeded: 0, failed: 0, conflicts: [], errors: [])
            return lastResult!
        }

        do {
            let batchResponse = try await APIClient.shared.syncBatch(operations: ops)
            for result in batchResponse.results {
                switch result.status {
                case "success":
                    succeeded += 1
                    let op = ops.first { $0.id == result.operationId }
                    let localTempId = op?.entityId ?? result.operationId
                    db.removeSyncOperation(id: result.operationId)
                    // For job create/update/delete: remove pending job, remap to server id when present
                    switch op?.type {
                    case .createJob:
                        db.deletePendingJob(id: localTempId)
                        if let serverId = result.serverId {
                            remapJobInStore(from: localTempId, to: serverId, opData: op?.data)
                            db.remapJobIdInQueuedOperations(tempJobId: localTempId, serverJobId: serverId)
                        }
                    case .updateJob:
                        db.deletePendingUpdatesForEntity(entityType: "job", entityId: localTempId)
                        break // Job id unchanged; sync op removal suffices
                    case .deleteJob:
                        db.deletePendingJob(id: localTempId)
                        removeJobFromStore(id: localTempId)
                    default:
                        if let serverId = result.serverId, let opType = op?.type {
                            handleNonJobSyncSuccess(type: opType, tempId: localTempId, serverId: serverId, opData: op?.data)
                        }
                    }
                case "conflict":
                    let op = ops.first { $0.id == result.operationId }
                    if let strategy = autoStrategy(for: result.conflict, operation: op) {
                        do {
                            var resolvedValue: [String: Any]?
                            let entityType = result.conflict?.entityType ?? op.flatMap { entityTypeFromOperation($0.type) }
                            let entityId = result.conflict?.entityId ?? op?.entityId
                            if strategy == .localWins || strategy == .merge, let op = op,
                               let dict = try? JSONSerialization.jsonObject(with: op.data) as? [String: Any] {
                                resolvedValue = dict
                            }
                            try await resolveConflict(
                                operationId: result.operationId,
                                strategy: strategy,
                                resolvedValue: resolvedValue,
                                entityType: entityType,
                                entityId: entityId,
                                operationType: op?.type.apiTypeString
                            )
                            succeeded += 1
                        } catch {
                            errors.append(error.localizedDescription)
                            if let c = result.conflict {
                                conflicts.append(SyncConflict(
                                    id: result.operationId,
                                    entityType: c.entityType ?? "job",
                                    entityId: c.entityId ?? result.operationId,
                                    field: c.field ?? "unknown",
                                    serverValue: c.serverValue?.value,
                                    localValue: c.localValue?.value,
                                    serverTimestamp: c.serverTimestamp ?? Date(),
                                    localTimestamp: c.localTimestamp ?? Date()
                                ))
                                db.insertConflict(
                                    id: result.operationId,
                                    entityType: c.entityType ?? "job",
                                    entityId: c.entityId ?? result.operationId,
                                    field: c.field,
                                    serverVersion: c.serverValue.map { "\($0)" },
                                    localVersion: c.localValue.map { "\($0)" },
                                    serverTimestamp: c.serverTimestamp,
                                    localTimestamp: c.localTimestamp,
                                    resolutionStrategy: nil
                                )
                            }
                            failed += 1
                            db.recordSyncOperationError(operationId: result.operationId, error: error.localizedDescription)
                        }
                    } else {
                        if let c = result.conflict {
                            conflicts.append(SyncConflict(
                                id: result.operationId,
                                entityType: c.entityType ?? "job",
                                entityId: c.entityId ?? result.operationId,
                                field: c.field ?? "unknown",
                                serverValue: c.serverValue?.value,
                                localValue: c.localValue?.value,
                                serverTimestamp: c.serverTimestamp ?? Date(),
                                localTimestamp: c.localTimestamp ?? Date()
                            ))
                            db.insertConflict(
                                id: result.operationId,
                                entityType: c.entityType ?? "job",
                                entityId: c.entityId ?? result.operationId,
                                field: c.field,
                                serverVersion: c.serverValue.map { "\($0)" },
                                localVersion: c.localValue.map { "\($0)" },
                                serverTimestamp: c.serverTimestamp,
                                localTimestamp: c.localTimestamp,
                                resolutionStrategy: nil
                            )
                        }
                        failed += 1
                        let errMsg = "Conflict: \(result.conflict?.field ?? "unknown")"
                        db.recordSyncOperationError(operationId: result.operationId, error: errMsg)
                    }
                default:
                    failed += 1
                    let errMsg = result.error ?? "Unknown error"
                    errors.append(errMsg)
                    db.incrementRetryCount(operationId: result.operationId, lastError: errMsg)
                    // Keep failed ops in queue until user retries or clears - do NOT remove
                }
            }
            // After processing batch: refresh pending job IDs so offline badge and duplicates clear
            JobsStore.shared.refreshPendingJobs()
        } catch {
            errors.append(error.localizedDescription)
            // Retry with exponential backoff for entire batch
            try await retryFailedOperations()
            let result = SyncResult(succeeded: succeeded, failed: failed, conflicts: conflicts, errors: errors)
            lastResult = result
            if !conflicts.isEmpty { pendingConflicts = conflicts }
            throw error
        }

        // 2. Download incremental changes - use distant past when no prior timestamp (first sync)
        let since = db.getLastSyncTimestamp() ?? Date.distantPast
        do {
            _ = try await fetchChanges(since: since)
            db.setLastSyncTimestamp(Date())
        } catch {
            let result = SyncResult(succeeded: succeeded, failed: failed, conflicts: conflicts, errors: errors + [error.localizedDescription])
            lastResult = result
            throw error
        }

        let result = SyncResult(succeeded: succeeded, failed: failed, conflicts: conflicts, errors: errors)
        lastResult = result
        if !conflicts.isEmpty {
            pendingConflicts = conflicts
        }
        return result
    }

    /// Clear a single conflict from pending after user resolves it
    func clearPendingConflict(operationId: String) {
        pendingConflicts.removeAll { $0.id == operationId }
    }

    /// Refresh pending conflicts from DB (e.g. when opening Sync Queue) so user can resolve any left from a previous session
    func refreshPendingConflictsFromDB() {
        let rows = db.getUnresolvedConflicts()
        pendingConflicts = rows.map { row in
            SyncConflict(
                id: row.id,
                entityType: row.entityType,
                entityId: row.entityId,
                field: row.field ?? "data",
                serverValue: row.serverVersion as? AnyHashable,
                localValue: row.localVersion as? AnyHashable,
                serverTimestamp: row.serverTimestamp ?? Date(),
                localTimestamp: row.localTimestamp ?? Date()
            )
        }
    }

    /// Detect conflicts by comparing local and server data
    func detectConflicts(_ serverData: [Job]) -> [SyncConflict] {
        let pending = db.getPendingJobs()
        var conflicts: [SyncConflict] = []
        for local in pending {
            guard let jobData = try? JSONDecoder().decode(Job.self, from: local.data),
                  let localUpdated = jobData.updatedAt else { continue }
            if let server = serverData.first(where: { $0.id == local.id || $0.id == jobData.id }) {
                let serverUpdated = server.updatedAt ?? server.createdAt
                if serverUpdated != localUpdated {
                    // Timestamp conflict - server was updated after local
                    let localDate = ISO8601DateFormatter().date(from: localUpdated) ?? Date()
                    let serverDate = ISO8601DateFormatter().date(from: serverUpdated) ?? Date()
                    conflicts.append(SyncConflict(
                        entityType: "job",
                        entityId: server.id,
                        field: "updated_at",
                        serverValue: serverUpdated as AnyHashable,
                        localValue: localUpdated as AnyHashable,
                        serverTimestamp: serverDate,
                        localTimestamp: localDate
                    ))
                }
            }
        }
        return conflicts
    }

    /// Return operations in priority order: creates first, then updates, then deletes; by timestamp
    func prioritizeOperations() -> [SyncOperation] {
        let ops = db.getSyncQueue()
        return ops.sorted { a, b in
            if a.priority != b.priority { return a.priority > b.priority }
            return a.clientTimestamp < b.clientTimestamp
        }
    }

    /// Retry failed operations with exponential backoff
    func retryFailedOperations() async throws {
        let ops = prioritizeOperations()
        guard !ops.isEmpty else { return }

        try await RetryManager.retry(maxAttempts: maxRetries) {
            _ = try await self.syncPendingOperations()
        }
    }

    /// Queue a job creation for sync
    func queueCreateJob(_ job: Job) {
        guard let data = try? JSONEncoder().encode(job) else { return }
        let op = SyncOperation(type: .createJob, entityId: job.id, data: data, priority: 10)
        db.enqueueOperation(op)
        db.insertPendingJob(id: job.id, data: data, createdAt: Date())
    }

    /// Queue a job update for sync
    func queueUpdateJob(_ job: Job) {
        guard let data = try? JSONEncoder().encode(job) else { return }
        let op = SyncOperation(type: .updateJob, entityId: job.id, data: data, priority: 5)
        db.enqueueOperation(op)
    }

    /// Queue a job deletion for sync
    func queueDeleteJob(jobId: String) {
        let data = (try? JSONEncoder().encode(["id": jobId])) ?? Data()
        let op = SyncOperation(type: .deleteJob, entityId: jobId, data: data, priority: 1)
        db.enqueueOperation(op)
        db.deletePendingJob(id: jobId)
    }

    // MARK: - Hazard Queue Helpers

    func queueCreateHazard(_ hazard: Hazard, jobId: String) {
        guard let data = try? JSONEncoder().encode(hazard) else { return }
        var payload = data
        if var dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            dict["job_id"] = jobId
            payload = (try? JSONSerialization.data(withJSONObject: dict)) ?? data
        }
        let op = SyncOperation(type: .createHazard, entityId: hazard.id, data: payload, priority: 9)
        db.enqueueOperation(op)
        db.insertPendingHazard(id: hazard.id, jobId: jobId, data: payload)
    }

    func queueUpdateHazard(_ hazard: Hazard, jobId: String) {
        guard let encoded = try? JSONEncoder().encode(hazard),
              var dict = try? JSONSerialization.jsonObject(with: encoded) as? [String: Any] else { return }
        dict["job_id"] = jobId
        dict["hazard_id"] = hazard.id
        let data = (try? JSONSerialization.data(withJSONObject: dict)) ?? Data()
        let op = SyncOperation(type: .updateHazard, entityId: hazard.id, data: data, priority: 4)
        db.enqueueOperation(op)
    }

    func queueDeleteHazard(hazardId: String, jobId: String) {
        let data = (try? JSONEncoder().encode(["id": hazardId, "job_id": jobId])) ?? Data()
        let op = SyncOperation(type: .deleteHazard, entityId: hazardId, data: data, priority: 1)
        db.enqueueOperation(op)
        db.deletePendingHazard(id: hazardId)
    }

    // MARK: - Control Queue Helpers

    func queueCreateControl(_ control: Control, hazardId: String, jobId: String) {
        guard let data = try? JSONEncoder().encode(control) else { return }
        var payload = data
        if var dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            dict["hazard_id"] = hazardId
            dict["job_id"] = jobId
            payload = (try? JSONSerialization.data(withJSONObject: dict)) ?? data
        }
        let op = SyncOperation(type: .createControl, entityId: control.id, data: payload, priority: 9)
        db.enqueueOperation(op)
        db.insertPendingControl(id: control.id, hazardId: hazardId, data: payload)
    }

    func queueUpdateControl(_ control: Control, jobId: String, hazardId: String? = nil) {
        guard let encoded = try? JSONEncoder().encode(control),
              var dict = try? JSONSerialization.jsonObject(with: encoded) as? [String: Any] else { return }
        dict["job_id"] = jobId
        if let hazardId = hazardId {
            dict["hazard_id"] = hazardId
        }
        let data = (try? JSONSerialization.data(withJSONObject: dict)) ?? Data()
        let op = SyncOperation(type: .updateControl, entityId: control.id, data: data, priority: 5)
        db.enqueueOperation(op)
    }

    func queueDeleteControl(controlId: String, hazardId: String, jobId: String) {
        let data = (try? JSONEncoder().encode(["id": controlId, "hazard_id": hazardId, "job_id": jobId])) ?? Data()
        let op = SyncOperation(type: .deleteControl, entityId: controlId, data: data, priority: 1)
        db.enqueueOperation(op)
        db.deletePendingControl(id: controlId)
    }

    /// Resolve a conflict via backend.
    /// For local_wins/merge, pass resolvedValue (entity payload), entityType, entityId, operationType so the server can apply the resolution.
    /// After success: server_wins → refresh entity from response; local_wins/merge → update local cache with resolved/response data.
    /// Only after applying the strategy do we remove the op and mark the conflict resolved.
    func resolveConflict(
        operationId: String,
        strategy: ConflictResolutionStrategy,
        resolvedValue: [String: Any]? = nil,
        entityType: String? = nil,
        entityId: String? = nil,
        operationType: String? = nil
    ) async throws {
        let response = try await APIClient.shared.resolveSyncConflict(
            operationId: operationId,
            strategy: strategy,
            resolvedValue: resolvedValue,
            entityType: entityType,
            entityId: entityId,
            operationType: operationType
        )

        let op = db.getSyncQueue().first { $0.id == operationId }
        let effectiveEntityType = entityType ?? op.flatMap { entityTypeFromOperation($0.type) }
        let effectiveEntityId = entityId ?? op?.entityId

        switch strategy {
        case .serverWins:
            if let job = response.updatedJob {
                OfflineCache.shared.mergeCachedJobs(synced: [job], deletedIds: [])
            }
            if let mit = response.updatedMitigationItem,
               let jobId = mit.jobIdFromData ?? extractJobId(from: op?.data) {
                if mit.hazardId == nil, let hazard = mit.asHazard {
                    OfflineCache.shared.mergeCachedMitigationItems(
                        synced: [(jobId, [hazard], [])],
                        deletedIds: []
                    )
                } else if let control = mit.asControl {
                    OfflineCache.shared.mergeCachedMitigationItems(
                        synced: [(jobId, [], [control])],
                        deletedIds: []
                    )
                }
            }
            if response.updatedJob == nil, response.updatedMitigationItem == nil {
                _ = try await fetchChanges(since: Date().addingTimeInterval(-3600))
            }
        case .localWins, .merge:
            if let job = response.updatedJob {
                OfflineCache.shared.mergeCachedJobs(synced: [job], deletedIds: [])
            } else if let resolved = resolvedValue, effectiveEntityType == "job", let effectiveEntityId = effectiveEntityId {
                if let job = try? decodeJob(from: resolved) {
                    OfflineCache.shared.mergeCachedJobs(synced: [job], deletedIds: [])
                }
            }
            if let mit = response.updatedMitigationItem,
               let jobId = mit.jobIdFromData ?? extractJobId(from: op?.data) {
                if mit.hazardId == nil, let hazard = mit.asHazard {
                    OfflineCache.shared.mergeCachedMitigationItems(
                        synced: [(jobId, [hazard], [])],
                        deletedIds: []
                    )
                } else if let control = mit.asControl {
                    OfflineCache.shared.mergeCachedMitigationItems(
                        synced: [(jobId, [], [control])],
                        deletedIds: []
                    )
                }
            } else if let resolved = resolvedValue, let jobId = resolved["job_id"] as? String ?? resolved["jobId"] as? String {
                if effectiveEntityType == "hazard", let hazard = try? decodeHazard(from: resolved) {
                    OfflineCache.shared.mergeCachedMitigationItems(
                        synced: [(jobId, [hazard], [])],
                        deletedIds: []
                    )
                } else if effectiveEntityType == "control", let control = try? decodeControl(from: resolved) {
                    OfflineCache.shared.mergeCachedMitigationItems(
                        synced: [(jobId, [], [control])],
                        deletedIds: []
                    )
                }
            }
        case .askUser:
            break
        }

        db.removeSyncOperation(id: operationId)
        db.markConflictResolved(id: operationId, resolutionStrategy: strategy.rawValue)
        clearPendingConflict(operationId: operationId)
    }

    /// Automatic resolution for known-simple conflicts; nil means queue user prompt (e.g. photo delete vs offline upload).
    private func autoStrategy(for conflict: BatchConflictDetail?, operation: SyncOperation?) -> ConflictResolutionStrategy? {
        guard let c = conflict else { return nil }
        let entityType = c.entityType ?? "job"
        let field = c.field ?? ""

        if entityType == "job" {
            if field == "status" { return .serverWins }
            let jobDetailFields = ["client_name", "clientName", "description", "address", "site_id", "siteId", "updated_at", "updatedAt"]
            if jobDetailFields.contains(field) { return .localWins }
        }
        if entityType == "hazard" {
            return .merge
        }
        if entityType == "control" {
            return .merge
        }
        return nil
    }

    private func entityTypeFromOperation(_ type: OperationType) -> String? {
        switch type {
        case .createJob, .updateJob, .deleteJob: return "job"
        case .createHazard, .updateHazard, .deleteHazard: return "hazard"
        case .createControl, .updateControl, .deleteControl: return "control"
        }
    }

    private func decodeJob(from dict: [String: Any]) throws -> Job? {
        let data = try JSONSerialization.data(withJSONObject: dict)
        return try? JSONDecoder().decode(Job.self, from: data)
    }

    private func decodeHazard(from dict: [String: Any]) throws -> Hazard? {
        let data = try JSONSerialization.data(withJSONObject: dict)
        return try? JSONDecoder().decode(Hazard.self, from: data)
    }

    private func decodeControl(from dict: [String: Any]) throws -> Control? {
        let data = try JSONSerialization.data(withJSONObject: dict)
        return try? JSONDecoder().decode(Control.self, from: data)
    }

    /// Fetch incremental changes from server (jobs + hazards/controls)
    private func fetchChanges(since: Date) async throws -> [Job] {
        let result = try await APIClient.shared.getSyncChanges(since: since)
        if !result.jobs.isEmpty || !result.deletedJobIds.isEmpty {
            OfflineCache.shared.mergeCachedJobs(synced: result.jobs, deletedIds: result.deletedJobIds)
        }
        if !result.mitigationItems.isEmpty || !result.deletedMitigationIds.isEmpty {
            let byJob = Dictionary(grouping: result.mitigationItems, by: { $0.jobId })
            var toMerge: [(jobId: String, hazards: [Hazard], controls: [Control])] = []
            for (jobId, items) in byJob {
                var hazards: [Hazard] = []
                var controls: [Control] = []
                for item in items {
                    if item.entityType == "hazard", let h = item.data.asHazard {
                        hazards.append(h)
                    } else if item.entityType == "control", let c = item.data.asControl {
                        controls.append(c)
                    }
                }
                if !hazards.isEmpty || !controls.isEmpty {
                    toMerge.append((jobId, hazards, controls))
                }
            }
            OfflineCache.shared.mergeCachedMitigationItems(synced: toMerge, deletedIds: result.deletedMitigationIds)
        }
        return result.jobs
    }

    func pendingCount() -> Int {
        db.pendingOperationsCount()
    }

    /// Retry a specific failed operation: reset its state and run sync
    func retryOperation(operationId: String) {
        db.resetOperationForRetry(operationId: operationId)
        refreshPendingOperations()
        Task {
            do {
                _ = try await syncPendingOperations()
                JobsStore.shared.refreshPendingJobs()
            } catch {
                ToastCenter.shared.show(
                    error.localizedDescription,
                    systemImage: "exclamationmark.triangle",
                    style: .error
                )
            }
        }
    }

    // MARK: - Post-sync Helpers

    private func remapJobInStore(from tempId: String, to serverId: String, opData: Data?) {
        JobsStore.shared.remapJob(from: tempId, to: serverId, jobData: opData)
    }

    private func removeJobFromStore(id: String) {
        JobsStore.shared.removeJob(id: id)
    }

    /// Posted when a hazard or control create sync succeeds; userInfo["jobId"] contains the affected job
    static let hazardsControlsSyncDidSucceedNotification = Notification.Name("SyncEngineHazardsControlsSyncDidSucceed")

    private func handleNonJobSyncSuccess(type: OperationType, tempId: String, serverId: String, opData: Data?) {
        switch type {
        case .createHazard:
            db.deletePendingHazard(id: tempId)
            db.remapHazardIdInQueuedOperations(tempHazardId: tempId, serverHazardId: serverId)
            if let jobId = extractJobId(from: opData) {
                DispatchQueue.main.async {
                    NotificationCenter.default.post(
                        name: Self.hazardsControlsSyncDidSucceedNotification,
                        object: nil,
                        userInfo: ["jobId": jobId]
                    )
                }
            }
        case .updateHazard, .deleteHazard:
            db.deletePendingHazard(id: tempId)
            if let jobId = extractJobId(from: opData) {
                DispatchQueue.main.async {
                    NotificationCenter.default.post(
                        name: Self.hazardsControlsSyncDidSucceedNotification,
                        object: nil,
                        userInfo: ["jobId": jobId]
                    )
                }
            }
        case .createControl:
            db.deletePendingControl(id: tempId)
            db.remapControlIdInQueuedOperations(tempControlId: tempId, serverControlId: serverId)
            if let jobId = extractJobId(from: opData) {
                DispatchQueue.main.async {
                    NotificationCenter.default.post(
                        name: Self.hazardsControlsSyncDidSucceedNotification,
                        object: nil,
                        userInfo: ["jobId": jobId]
                    )
                }
            }
        case .updateControl, .deleteControl:
            db.deletePendingControl(id: tempId)
            if let jobId = extractJobId(from: opData) {
                DispatchQueue.main.async {
                    NotificationCenter.default.post(
                        name: Self.hazardsControlsSyncDidSucceedNotification,
                        object: nil,
                        userInfo: ["jobId": jobId]
                    )
                }
            }
        default:
            break
        }
    }

    private func extractJobId(from opData: Data?) -> String? {
        guard let data = opData,
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        return dict["job_id"] as? String ?? dict["jobId"] as? String
    }
}
