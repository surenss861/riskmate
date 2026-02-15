import Foundation
import SQLite3

/// Local SQLite database for offline-first storage: pending jobs, hazards, controls, sync queue, conflicts
final class OfflineDatabase {
    static let shared = OfflineDatabase()

    private var db: OpaquePointer?
    private let dbPath: String
    private let queue = DispatchQueue(label: "com.riskmate.offlinedb", qos: .userInitiated)
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    private init() {
        let fileManager = FileManager.default
        let docDir = fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let dbDir = docDir.appendingPathComponent("Riskmate", isDirectory: true)
        try? fileManager.createDirectory(at: dbDir, withIntermediateDirectories: true)
        dbPath = dbDir.appendingPathComponent("offline.db").path
        openDatabase()
        runMigrations()
    }

    deinit {
        sqlite3_close(db)
    }

    // MARK: - Schema

    private let schemaVersion: Int32 = 1

    private func openDatabase() {
        guard sqlite3_open(dbPath, &db) == SQLITE_OK else {
            print("[OfflineDatabase] Failed to open database at \(dbPath)")
            return
        }
        sqlite3_busy_timeout(db, 5000)
    }

    private func runMigrations() {
        queue.async { [weak self] in
            guard let self = self, let db = self.db else { return }
            let current = self.getSchemaVersion(db)
            if current < 1 {
                self.createTables(db)
                self.setSchemaVersion(db, 1)
            }
        }
    }

    private func getSchemaVersion(_ db: OpaquePointer?) -> Int32 {
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db, "PRAGMA user_version", -1, &stmt, nil) == SQLITE_OK else { return 0 }
        guard sqlite3_step(stmt) == SQLITE_ROW else { return 0 }
        return sqlite3_column_int(stmt, 0)
    }

    private func setSchemaVersion(_ db: OpaquePointer?, _ v: Int32) {
        sqlite3_exec(db, "PRAGMA user_version = \(v)", nil, nil, nil)
    }

    private func createTables(_ db: OpaquePointer?) {
        let statements = [
            """
            CREATE TABLE IF NOT EXISTS pending_jobs (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                sync_status TEXT DEFAULT 'pending'
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS pending_hazards (
                id TEXT PRIMARY KEY,
                job_id TEXT NOT NULL,
                data TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                sync_status TEXT DEFAULT 'pending'
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS pending_controls (
                id TEXT PRIMARY KEY,
                hazard_id TEXT NOT NULL,
                data TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                sync_status TEXT DEFAULT 'pending'
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS pending_updates (
                id TEXT PRIMARY KEY,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                field TEXT,
                old_value TEXT,
                new_value TEXT,
                timestamp INTEGER NOT NULL,
                sync_status TEXT DEFAULT 'pending'
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS sync_queue (
                operation_id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                priority INTEGER DEFAULT 0,
                retry_count INTEGER DEFAULT 0,
                last_attempt INTEGER,
                data TEXT NOT NULL,
                client_timestamp INTEGER NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS conflict_log (
                id TEXT PRIMARY KEY,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                server_version TEXT,
                local_version TEXT,
                resolution_strategy TEXT,
                resolved_at INTEGER
            )
            """,
        ]
        for sql in statements {
            var err: UnsafeMutablePointer<CChar>?
            if sqlite3_exec(db, sql, nil, nil, &err) != SQLITE_OK, let e = err {
                print("[OfflineDatabase] Migration error: \(String(cString: e))")
                sqlite3_free(err)
            }
        }
    }

    // MARK: - Transactions

    func inTransaction<T>(_ block: () throws -> T) throws -> T {
        try queue.sync {
            guard sqlite3_exec(db, "BEGIN TRANSACTION", nil, nil, nil) == SQLITE_OK else {
                throw OfflineDatabaseError.transactionFailed
            }
            defer { sqlite3_exec(db, "ROLLBACK", nil, nil, nil) }
            let result = try block()
            guard sqlite3_exec(db, "COMMIT", nil, nil, nil) == SQLITE_OK else {
                throw OfflineDatabaseError.transactionFailed
            }
            return result
        }
    }

    // MARK: - Pending Jobs

    func insertPendingJob(id: String, data: Data, createdAt: Date = Date()) {
        queue.async { [weak self] in
            guard let self = self, let db = self.db else { return }
            let sql = "INSERT OR REPLACE INTO pending_jobs (id, data, created_at, sync_status) VALUES (?, ?, ?, 'pending')"
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
            let json = String(data: data, encoding: .utf8) ?? "{}"
            let created = Int64(createdAt.timeIntervalSince1970 * 1000)
            sqlite3_bind_text(stmt, 1, (id as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 2, (json as NSString).utf8String, -1, nil)
            sqlite3_bind_int64(stmt, 3, created)
            sqlite3_step(stmt)
        }
    }

    func getPendingJobs() -> [PendingJobRow] {
        queue.sync {
            guard let db = db else { return [] }
            let sql = "SELECT id, data, created_at, sync_status FROM pending_jobs ORDER BY created_at ASC"
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return [] }
            var rows: [PendingJobRow] = []
            while sqlite3_step(stmt) == SQLITE_ROW {
                let id = String(cString: sqlite3_column_text(stmt, 0))
                let dataStr = String(cString: sqlite3_column_text(stmt, 1))
                let created = Int64(sqlite3_column_int64(stmt, 2))
                let status = String(cString: sqlite3_column_text(stmt, 3))
                rows.append(PendingJobRow(
                    id: id,
                    data: dataStr.data(using: .utf8) ?? Data(),
                    createdAt: Date(timeIntervalSince1970: Double(created) / 1000),
                    syncStatus: status
                ))
            }
            return rows
        }
    }

    func deletePendingJob(id: String) {
        queue.async { [weak self] in
            guard let self = self, let db = self.db else { return }
            let sql = "DELETE FROM pending_jobs WHERE id = ?"
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
            sqlite3_bind_text(stmt, 1, (id as NSString).utf8String, -1, nil)
            sqlite3_step(stmt)
        }
    }

    // MARK: - Sync Queue

    static let syncQueueDidChangeNotification = Notification.Name("OfflineDatabaseSyncQueueDidChange")

    func enqueueOperation(_ op: SyncOperation) {
        queue.async { [weak self] in
            guard let self = self, let db = self.db else { return }
            let sql = """
                INSERT OR REPLACE INTO sync_queue (operation_id, type, entity_id, priority, retry_count, last_attempt, data, client_timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
            let dataStr = String(data: op.data, encoding: .utf8) ?? "{}"
            let clientTs = Int64(op.clientTimestamp.timeIntervalSince1970 * 1000)
            sqlite3_bind_text(stmt, 1, (op.id as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 2, (op.type.rawValue as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 3, (op.entityId as NSString).utf8String, -1, nil)
            sqlite3_bind_int(stmt, 4, Int32(op.priority))
            sqlite3_bind_int(stmt, 5, Int32(op.retryCount))
            if let la = op.lastAttempt {
                sqlite3_bind_int64(stmt, 6, Int64(la.timeIntervalSince1970 * 1000))
            } else {
                sqlite3_bind_null(stmt, 6)
            }
            sqlite3_bind_text(stmt, 7, (dataStr as NSString).utf8String, -1, nil)
            sqlite3_bind_int64(stmt, 8, clientTs)
            sqlite3_step(stmt)
            DispatchQueue.main.async {
                NotificationCenter.default.post(name: Self.syncQueueDidChangeNotification, object: nil)
            }
        }
    }

    func getSyncQueue() -> [SyncOperation] {
        queue.sync {
            guard let db = db else { return [] }
            let sql = "SELECT operation_id, type, entity_id, priority, retry_count, last_attempt, data, client_timestamp FROM sync_queue ORDER BY priority DESC, client_timestamp ASC"
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return [] }
            var ops: [SyncOperation] = []
            while sqlite3_step(stmt) == SQLITE_ROW {
                let id = String(cString: sqlite3_column_text(stmt, 0))
                let typeStr = String(cString: sqlite3_column_text(stmt, 1))
                let entityId = String(cString: sqlite3_column_text(stmt, 2))
                let priority = Int(sqlite3_column_int(stmt, 3))
                let retryCount = Int(sqlite3_column_int(stmt, 4))
                let lastAttempt: Date? = sqlite3_column_type(stmt, 5) == SQLITE_NULL ? nil : Date(timeIntervalSince1970: Double(sqlite3_column_int64(stmt, 5)) / 1000)
                let dataStr = String(cString: sqlite3_column_text(stmt, 6))
                let clientTs = Date(timeIntervalSince1970: Double(sqlite3_column_int64(stmt, 7)) / 1000)
                let data = dataStr.data(using: .utf8) ?? Data()
                guard let type = OperationType(rawValue: typeStr) else { continue }
                ops.append(SyncOperation(
                    id: id,
                    type: type,
                    entityId: entityId,
                    data: data,
                    priority: priority,
                    retryCount: retryCount,
                    lastAttempt: lastAttempt,
                    clientTimestamp: clientTs
                ))
            }
            return ops
        }
    }

    func removeSyncOperation(id: String) {
        queue.async { [weak self] in
            guard let self = self, let db = self.db else { return }
            let sql = "DELETE FROM sync_queue WHERE operation_id = ?"
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
            sqlite3_bind_text(stmt, 1, (id as NSString).utf8String, -1, nil)
            sqlite3_step(stmt)
            DispatchQueue.main.async {
                NotificationCenter.default.post(name: Self.syncQueueDidChangeNotification, object: nil)
            }
        }
    }

    func incrementRetryCount(operationId: String) {
        queue.async { [weak self] in
            guard let self = self, let db = self.db else { return }
            let sql = "UPDATE sync_queue SET retry_count = retry_count + 1, last_attempt = ? WHERE operation_id = ?"
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
            sqlite3_bind_int64(stmt, 1, Int64(Date().timeIntervalSince1970 * 1000))
            sqlite3_bind_text(stmt, 2, (operationId as NSString).utf8String, -1, nil)
            sqlite3_step(stmt)
            DispatchQueue.main.async {
                NotificationCenter.default.post(name: Self.syncQueueDidChangeNotification, object: nil)
            }
        }
    }

    // MARK: - Conflict Log

    func insertConflict(
        id: String,
        entityType: String,
        entityId: String,
        serverVersion: String?,
        localVersion: String?,
        resolutionStrategy: String?
    ) {
        queue.async { [weak self] in
            guard let self = self, let db = self.db else { return }
            let sql = "INSERT OR REPLACE INTO conflict_log (id, entity_type, entity_id, server_version, local_version, resolution_strategy) VALUES (?, ?, ?, ?, ?, ?)"
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
            sqlite3_bind_text(stmt, 1, (id as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 2, (entityType as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 3, (entityId as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 4, (serverVersion as NSString?)?.utf8String, -1, nil)
            sqlite3_bind_text(stmt, 5, (localVersion as NSString?)?.utf8String, -1, nil)
            sqlite3_bind_text(stmt, 6, (resolutionStrategy as NSString?)?.utf8String, -1, nil)
            sqlite3_step(stmt)
        }
    }

    func getUnresolvedConflicts() -> [ConflictLogRow] {
        queue.sync {
            guard let db = db else { return [] }
            let sql = "SELECT id, entity_type, entity_id, server_version, local_version, resolution_strategy FROM conflict_log WHERE resolved_at IS NULL"
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return [] }
            var rows: [ConflictLogRow] = []
            while sqlite3_step(stmt) == SQLITE_ROW {
                let id = String(cString: sqlite3_column_text(stmt, 0))
                let entityType = String(cString: sqlite3_column_text(stmt, 1))
                let entityId = String(cString: sqlite3_column_text(stmt, 2))
                let serverV = sqlite3_column_type(stmt, 3) == SQLITE_NULL ? nil : String(cString: sqlite3_column_text(stmt, 3))
                let localV = sqlite3_column_type(stmt, 4) == SQLITE_NULL ? nil : String(cString: sqlite3_column_text(stmt, 4))
                let strat = sqlite3_column_type(stmt, 5) == SQLITE_NULL ? nil : String(cString: sqlite3_column_text(stmt, 5))
                rows.append(ConflictLogRow(id: id, entityType: entityType, entityId: entityId, serverVersion: serverV, localVersion: localV, resolutionStrategy: strat))
            }
            return rows
        }
    }

    func markConflictResolved(id: String) {
        queue.async { [weak self] in
            guard let self = self, let db = self.db else { return }
            let sql = "UPDATE conflict_log SET resolved_at = ? WHERE id = ?"
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
            sqlite3_bind_int64(stmt, 1, Int64(Date().timeIntervalSince1970 * 1000))
            sqlite3_bind_text(stmt, 2, (id as NSString).utf8String, -1, nil)
            sqlite3_step(stmt)
        }
    }

    // MARK: - Last Sync Timestamp (for incremental download)

    private let lastSyncKey = "last_sync_timestamp"

    func setLastSyncTimestamp(_ date: Date) {
        UserDefaults.standard.set(date.timeIntervalSince1970, forKey: lastSyncKey)
    }

    func getLastSyncTimestamp() -> Date? {
        let ts = UserDefaults.standard.double(forKey: lastSyncKey)
        guard ts > 0 else { return nil }
        return Date(timeIntervalSince1970: ts)
    }

    // MARK: - Pending Hazards / Controls (stub for Phase 1 - same pattern as jobs)

    func insertPendingHazard(id: String, jobId: String, data: Data) {
        queue.async { [weak self] in
            guard let self = self, let db = self.db else { return }
            let sql = "INSERT OR REPLACE INTO pending_hazards (id, job_id, data, created_at, sync_status) VALUES (?, ?, ?, ?, 'pending')"
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
            let json = String(data: data, encoding: .utf8) ?? "{}"
            sqlite3_bind_text(stmt, 1, (id as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 2, (jobId as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 3, (json as NSString).utf8String, -1, nil)
            sqlite3_bind_int64(stmt, 4, Int64(Date().timeIntervalSince1970 * 1000))
            sqlite3_step(stmt)
        }
    }

    func insertPendingControl(id: String, hazardId: String, data: Data) {
        queue.async { [weak self] in
            guard let self = self, let db = self.db else { return }
            let sql = "INSERT OR REPLACE INTO pending_controls (id, hazard_id, data, created_at, sync_status) VALUES (?, ?, ?, ?, 'pending')"
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
            let json = String(data: data, encoding: .utf8) ?? "{}"
            sqlite3_bind_text(stmt, 1, (id as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 2, (hazardId as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 3, (json as NSString).utf8String, -1, nil)
            sqlite3_bind_int64(stmt, 4, Int64(Date().timeIntervalSince1970 * 1000))
            sqlite3_step(stmt)
        }
    }

    func deletePendingHazard(id: String) {
        queue.async { [weak self] in
            guard let self = self, let db = self.db else { return }
            let sql = "DELETE FROM pending_hazards WHERE id = ?"
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
            sqlite3_bind_text(stmt, 1, (id as NSString).utf8String, -1, nil)
            sqlite3_step(stmt)
        }
    }

    func deletePendingControl(id: String) {
        queue.async { [weak self] in
            guard let self = self, let db = self.db else { return }
            let sql = "DELETE FROM pending_controls WHERE id = ?"
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
            sqlite3_bind_text(stmt, 1, (id as NSString).utf8String, -1, nil)
            sqlite3_step(stmt)
        }
    }

    func getPendingHazards(jobId: String) -> [Data] {
        queue.sync {
            guard let db = db else { return [] }
            let sql = "SELECT data FROM pending_hazards WHERE job_id = ? ORDER BY created_at ASC"
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return [] }
            sqlite3_bind_text(stmt, 1, (jobId as NSString).utf8String, -1, nil)
            var result: [Data] = []
            while sqlite3_step(stmt) == SQLITE_ROW {
                let dataStr = String(cString: sqlite3_column_text(stmt, 0))
                if let d = dataStr.data(using: .utf8) { result.append(d) }
            }
            return result
        }
    }

    func getPendingControls(jobId: String) -> [Data] {
        queue.sync {
            guard let db = db else { return [] }
            let sql = "SELECT data FROM pending_controls ORDER BY created_at ASC"
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return [] }
            var result: [Data] = []
            while sqlite3_step(stmt) == SQLITE_ROW {
                let dataStr = String(cString: sqlite3_column_text(stmt, 0))
                guard let d = dataStr.data(using: .utf8),
                      let dict = (try? JSONSerialization.jsonObject(with: d)) as? [String: Any],
                      (dict["job_id"] as? String) == jobId else { continue }
                result.append(d)
            }
            return result
        }
    }

    // MARK: - Pending Updates (field-level changes for offline job edits)

    /// Insert or replace a pending update for an entity field
    func insertOrUpdatePendingUpdate(entityType: String, entityId: String, field: String, oldValue: String?, newValue: String, timestamp: Date = Date()) {
        queue.async { [weak self] in
            guard let self = self, let db = self.db else { return }
            let id = "\(entityType):\(entityId):\(field)"
            let sql = """
                INSERT OR REPLACE INTO pending_updates (id, entity_type, entity_id, field, old_value, new_value, timestamp, sync_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
            """
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
            let ts = Int64(timestamp.timeIntervalSince1970 * 1000)
            sqlite3_bind_text(stmt, 1, (id as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 2, (entityType as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 3, (entityId as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 4, (field as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 5, (oldValue as NSString?)?.utf8String, -1, nil)
            sqlite3_bind_text(stmt, 6, (newValue as NSString).utf8String, -1, nil)
            sqlite3_bind_int64(stmt, 7, ts)
            sqlite3_step(stmt)
        }
    }

    /// Get pending updates for an entity
    func getPendingUpdates(entityType: String, entityId: String) -> [PendingUpdateRow] {
        queue.sync {
            guard let db = db else { return [] }
            let sql = "SELECT id, entity_type, entity_id, field, old_value, new_value, timestamp, sync_status FROM pending_updates WHERE entity_type = ? AND entity_id = ? ORDER BY timestamp ASC"
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return [] }
            sqlite3_bind_text(stmt, 1, (entityType as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 2, (entityId as NSString).utf8String, -1, nil)
            var rows: [PendingUpdateRow] = []
            while sqlite3_step(stmt) == SQLITE_ROW {
                let id = String(cString: sqlite3_column_text(stmt, 0))
                let entityTypeCol = String(cString: sqlite3_column_text(stmt, 1))
                let entityIdCol = String(cString: sqlite3_column_text(stmt, 2))
                let field = String(cString: sqlite3_column_text(stmt, 3))
                let oldVal = sqlite3_column_type(stmt, 4) == SQLITE_NULL ? nil : String(cString: sqlite3_column_text(stmt, 4))
                let newVal = String(cString: sqlite3_column_text(stmt, 5))
                let ts = Int64(sqlite3_column_int64(stmt, 6))
                let status = String(cString: sqlite3_column_text(stmt, 7))
                rows.append(PendingUpdateRow(id: id, entityType: entityTypeCol, entityId: entityIdCol, field: field, oldValue: oldVal, newValue: newVal, timestamp: Date(timeIntervalSince1970: Double(ts) / 1000), syncStatus: status))
            }
            return rows
        }
    }

    /// Delete pending updates for an entity (called when sync succeeds)
    func deletePendingUpdatesForEntity(entityType: String, entityId: String) {
        queue.async { [weak self] in
            guard let self = self, let db = self.db else { return }
            let sql = "DELETE FROM pending_updates WHERE entity_type = ? AND entity_id = ?"
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
            sqlite3_bind_text(stmt, 1, (entityType as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 2, (entityId as NSString).utf8String, -1, nil)
            sqlite3_step(stmt)
        }
    }

    func pendingOperationsCount() -> Int {
        queue.sync {
            guard let db = db else { return 0 }
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, "SELECT COUNT(*) FROM sync_queue", -1, &stmt, nil) == SQLITE_OK else { return 0 }
            guard sqlite3_step(stmt) == SQLITE_ROW else { return 0 }
            return Int(sqlite3_column_int(stmt, 0))
        }
    }
}

// MARK: - Supporting Types

struct PendingJobRow {
    let id: String
    let data: Data
    let createdAt: Date
    let syncStatus: String
}

struct ConflictLogRow {
    let id: String
    let entityType: String
    let entityId: String
    let serverVersion: String?
    let localVersion: String?
    let resolutionStrategy: String?
}

struct PendingUpdateRow {
    let id: String
    let entityType: String
    let entityId: String
    let field: String
    let oldValue: String?
    let newValue: String
    let timestamp: Date
    let syncStatus: String
}

enum OfflineDatabaseError: Error {
    case transactionFailed
}
