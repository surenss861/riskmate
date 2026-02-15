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

    private let db = OfflineDatabase.shared
    private let maxRetries = 3

    private init() {}

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
            // No pending ops - optionally fetch server changes
            if let since = db.getLastSyncTimestamp() {
                let _ = try? await fetchChanges(since: since)
            }
            db.setLastSyncTimestamp(Date())
            lastResult = SyncResult(succeeded: 0, failed: 0, conflicts: [], errors: [])
            return lastResult!
        }

        do {
            let batchResponse = try await APIClient.shared.syncBatch(operations: ops)
            for result in batchResponse.results {
                switch result.status {
                case "success":
                    succeeded += 1
                    db.removeSyncOperation(id: result.operationId)
                    if let serverId = result.serverId {
                        // Could update local ID mapping here (e.g. temp -> server id)
                        _ = serverId
                    }
                case "conflict":
                    if let c = result.conflict {
                        conflicts.append(SyncConflict(
                            id: result.operationId,
                            entityType: c.entityType ?? "job",
                            entityId: c.entityId ?? result.operationId,
                            field: c.field ?? "unknown",
                            serverValue: c.server_value?.value,
                            localValue: c.local_value?.value,
                            serverTimestamp: c.serverTimestamp ?? Date(),
                            localTimestamp: c.localTimestamp ?? Date()
                        ))
                        db.insertConflict(
                            id: result.operationId,
                            entityType: c.entityType ?? "job",
                            entityId: c.entityId ?? result.operationId,
                            serverVersion: c.serverValue.map { "\($0)" },
                            localVersion: c.localValue.map { "\($0)" },
                            resolutionStrategy: nil
                        )
                    }
                    failed += 1
                default:
                    failed += 1
                    errors.append(result.error ?? "Unknown error")
                    if RetryManager.shouldRetry(error: NSError(domain: "Sync", code: -1, userInfo: [NSLocalizedDescriptionKey: result.error ?? "sync failed"]), attempt: 0, maxAttempts: maxRetries) {
                        db.incrementRetryCount(operationId: result.operationId)
                    } else {
                        db.removeSyncOperation(id: result.operationId)
                    }
                }
            }
        } catch {
            errors.append(error.localizedDescription)
            // Retry with exponential backoff for entire batch
            try await retryFailedOperations()
        }

        // 2. Download incremental changes
        if let since = db.getLastSyncTimestamp() {
            _ = try? await fetchChanges(since: since)
        }
        db.setLastSyncTimestamp(Date())

        let result = SyncResult(succeeded: succeeded, failed: failed, conflicts: conflicts, errors: errors)
        lastResult = result
        return result
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

    /// Resolve a conflict via backend
    func resolveConflict(operationId: String, strategy: ConflictResolutionStrategy) async throws {
        try await APIClient.shared.resolveSyncConflict(operationId: operationId, strategy: strategy)
        db.removeSyncOperation(id: operationId)
        db.markConflictResolved(id: operationId)
    }

    /// Fetch incremental changes from server
    private func fetchChanges(since: Date) async throws -> [Job] {
        let jobs = try await APIClient.shared.getSyncChanges(since: since)
        // Merge into local cache (OfflineCache) - caller can refresh JobsStore
        if !jobs.isEmpty {
            OfflineCache.shared.cacheJobs(jobs)
        }
        return jobs
    }

    func pendingCount() -> Int {
        db.pendingOperationsCount()
    }
}
