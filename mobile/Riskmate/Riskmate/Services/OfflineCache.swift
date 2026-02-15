import Foundation
import Combine

/// Offline caching service for Riskmate
/// Handles local storage, sync queue, and background uploads
@MainActor
class OfflineCache: ObservableObject {
    static let shared = OfflineCache()
    
    @Published var syncState: SyncState = .synced
    @Published var queuedItems: [QueuedItem] = []
    
    private let cacheDirectory: URL
    private let queueFile: URL
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    
    private init() {
        let fileManager = FileManager.default
        let cacheDir = fileManager.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        cacheDirectory = cacheDir.appendingPathComponent("Riskmate", isDirectory: true)
        queueFile = cacheDirectory.appendingPathComponent("sync-queue.json")
        
        // Create cache directory if needed
        try? fileManager.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
        
        loadQueue()
    }
    
    // MARK: - Sync State
    
    enum SyncState {
        case synced
        case syncing
        case queued(Int) // Number of items in queue
        case error(String)
    }
    
    // MARK: - Queue Management
    
    struct QueuedItem: Identifiable, Codable {
        let id: String
        let type: ItemType
        let action: Action
        let data: Data
        let createdAt: Date
        var retryCount: Int = 0
        var lastRetryAt: Date? = nil // Track last retry for exponential backoff
        
        // For matching queued items to UI elements
        var itemId: String? // The ID of the item being synced (control.id, hazard.id, etc.)
        
        enum ItemType: String, Codable {
            case job
            case evidence
            case control
            case hazard
        }
        
        enum Action: String, Codable {
            case create
            case update
            case delete
        }
    }
    
    // MARK: - Cache Jobs
    
    func cacheJobs(_ jobs: [Job]) {
        let fileURL = cacheDirectory.appendingPathComponent("jobs.json")
        if let data = try? encoder.encode(jobs) {
            try? data.write(to: fileURL)
        }
    }
    
    func getCachedJobs() -> [Job]? {
        let fileURL = cacheDirectory.appendingPathComponent("jobs.json")
        guard let data = try? Data(contentsOf: fileURL) else { return nil }
        return try? decoder.decode([Job].self, from: data)
    }
    
    // MARK: - Cache Readiness
    
    func cacheReadiness(_ readiness: ReadinessResponse) {
        let fileURL = cacheDirectory.appendingPathComponent("readiness.json")
        if let data = try? encoder.encode(readiness) {
            try? data.write(to: fileURL)
        }
    }
    
    func getCachedReadiness() -> ReadinessResponse? {
        let fileURL = cacheDirectory.appendingPathComponent("readiness.json")
        guard let data = try? Data(contentsOf: fileURL) else { return nil }
        return try? decoder.decode(ReadinessResponse.self, from: data)
    }
    
    // MARK: - Cache Audit Events
    
    func cacheAuditEvents(_ events: [AuditEvent]) {
        let fileURL = cacheDirectory.appendingPathComponent("audit-events.json")
        if let data = try? encoder.encode(events) {
            try? data.write(to: fileURL)
        }
    }
    
    func getCachedAuditEvents() -> [AuditEvent]? {
        let fileURL = cacheDirectory.appendingPathComponent("audit-events.json")
        guard let data = try? Data(contentsOf: fileURL) else { return nil }
        return try? decoder.decode([AuditEvent].self, from: data)
    }
    
    // MARK: - Cache Evidence
    
    func cacheEvidence(jobId: String, evidence: [EvidenceItem]) {
        let fileURL = cacheDirectory.appendingPathComponent("evidence-\(jobId).json")
        if let data = try? encoder.encode(evidence) {
            try? data.write(to: fileURL)
        }
    }
    
    func getCachedEvidence(jobId: String) -> [EvidenceItem]? {
        let fileURL = cacheDirectory.appendingPathComponent("evidence-\(jobId).json")
        guard let data = try? Data(contentsOf: fileURL) else { return nil }
        return try? decoder.decode([EvidenceItem].self, from: data)
    }
    
    // MARK: - Queue Operations
    
    func queueJob(_ job: Job, action: QueuedItem.Action) {
        guard let data = try? encoder.encode(job) else { return }
        
        // Jobs go to OfflineDatabase for offline-first sync (handled by SyncEngine)
        let opType: OperationType
        switch action {
        case .create: opType = .createJob
        case .update: opType = .updateJob
        case .delete: opType = .deleteJob
        }
        let op = SyncOperation(type: opType, entityId: job.id, data: data)
        OfflineDatabase.shared.enqueueOperation(op)
        if action == .create {
            OfflineDatabase.shared.insertPendingJob(id: job.id, data: data, createdAt: Date())
        }
        
        // Non-job types (evidence, etc.) still use queuedItems
        updateSyncState()
    }
    
    func queueEvidence(_ evidence: EvidenceUpload, action: QueuedItem.Action) {
        guard let data = try? encoder.encode(evidence) else { return }
        
        let item = QueuedItem(
            id: UUID().uuidString,
            type: .evidence,
            action: action,
            data: data,
            createdAt: Date()
        )
        
        queuedItems.append(item)
        saveQueue()
        updateSyncState()
    }
    
    func removeQueuedItem(_ item: QueuedItem) {
        queuedItems.removeAll { $0.id == item.id }
        saveQueue()
        updateSyncState()
    }
    
    // MARK: - Sync
    
    func sync() async {
        // Include pending ops from OfflineDatabase in "has work" check
        let dbPending = OfflineDatabase.shared.pendingOperationsCount()
        guard !queuedItems.isEmpty || dbPending > 0 else {
            syncState = .synced
            return
        }
        
        let startTime = Date()
        syncState = .syncing

        // 1. Run SyncEngine for database-backed operations (jobs, etc.)
        if dbPending > 0 {
            do {
                _ = try await SyncEngine.shared.syncPendingOperations()
            } catch {
                print("[OfflineCache] SyncEngine failed: \(error.localizedDescription)")
            }
        }
        
        var failedItems: [QueuedItem] = []
        
        for item in queuedItems {
            // Exponential backoff: skip if retried too recently
            if let lastRetry = item.lastRetryAt {
                let backoffSeconds = pow(2.0, Double(item.retryCount)) // 1s, 2s, 4s
                let nextRetryTime = lastRetry.addingTimeInterval(backoffSeconds)
                if Date() < nextRetryTime {
                    failedItems.append(item) // Still in backoff period
                    continue
                }
            }
            
            do {
                try await processQueuedItem(item)
                removeQueuedItem(item)
            } catch {
                var updatedItem = item
                updatedItem.retryCount += 1
                updatedItem.lastRetryAt = Date()
                
                if updatedItem.retryCount < 3 {
                    failedItems.append(updatedItem)
                } else {
                    // Max retries reached, remove from queue
                    print("[OfflineCache] Max retries reached for item \(item.id)")
                    Analytics.shared.trackOfflineSyncFailed(itemType: item.type.rawValue, error: "max_retries")
                }
            }
        }
        
        queuedItems = failedItems
        saveQueue()
        updateSyncState()
        
        // Track time to first successful sync
        if !failedItems.isEmpty && queuedItems.isEmpty {
            let timeToSync = Date().timeIntervalSince(startTime)
            Analytics.shared.trackTimeToFirstSync(seconds: timeToSync)
        }
        
        // Track queue depth
        Analytics.shared.trackOfflineQueueDepth(depth: queuedItems.count)
    }
    
    private func processQueuedItem(_ item: QueuedItem) async throws {
        switch item.type {
        case .job:
            let job = try decoder.decode(Job.self, from: item.data)
            switch item.action {
            case .create:
                _ = try await APIClient.shared.createJob(job)
            case .update:
                _ = try await APIClient.shared.updateJob(job)
            case .delete:
                try await APIClient.shared.deleteJob(job.id)
            }
        case .evidence:
            let evidence = try decoder.decode(EvidenceUpload.self, from: item.data)
            switch item.action {
            case .create:
                _ = try await APIClient.shared.uploadEvidence(evidence)
            case .update:
                _ = try await APIClient.shared.updateEvidence(evidence)
            case .delete:
                try await APIClient.shared.deleteEvidence(evidence.id)
            }
        case .control, .hazard:
            // TODO: Implement control/hazard sync
            break
        }
    }
    
    // MARK: - Private Helpers
    
    private func saveQueue() {
        if let data = try? encoder.encode(queuedItems) {
            try? data.write(to: queueFile)
        }
    }
    
    private func loadQueue() {
        guard let data = try? Data(contentsOf: queueFile) else { return }
        queuedItems = (try? decoder.decode([QueuedItem].self, from: data)) ?? []
        updateSyncState()
    }
    
    private func updateSyncState() {
        let dbCount = OfflineDatabase.shared.pendingOperationsCount()
        let total = queuedItems.count + dbCount
        if total == 0 {
            syncState = .synced
        } else {
            syncState = .queued(total)
        }
    }

    /// Call when pending operations change (e.g. after offline job creation)
    func refreshSyncState() {
        updateSyncState()
    }
}

// MARK: - Supporting Types

struct EvidenceUpload: Codable {
    let id: String
    let jobId: String
    let type: String
    let fileName: String
    let fileData: Data
    let uploadedAt: Date
}

struct AuditEvent: Identifiable, Codable {
    let id: String
    let category: String
    let summary: String
    let timestamp: Date
    var details: String = ""
    var actor: String = ""
    /// String-keyed for safe decode + render; API stringifies values in toAuditEvent().
    var metadata: [String: String] = [:]
}

extension AuditEvent {
    /// Record hash from API; fall back to id for display if missing.
    var recordHash: String? {
        metadataString("hash") ?? metadataString("record_hash")
    }
    var previousHash: String? {
        metadataString("previous_hash")
    }
    var signature: String? {
        metadataString("signature")
    }
    var txHash: String? {
        metadataString("tx_hash") ?? metadataString("anchor_tx")
    }

    /// Safe read from metadata for decode + render. API stringifies primitives in toAuditEvent() so we only need String here.
    private func metadataString(_ key: String) -> String? {
        metadata[key]
    }
}
