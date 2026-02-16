import Foundation

/// Represents a conflict between local and server data during sync
struct SyncConflict: Identifiable {
    let id: String
    let entityType: String
    let entityId: String
    let field: String
    let serverValue: AnyHashable?
    let localValue: AnyHashable?
    let serverTimestamp: Date
    let localTimestamp: Date
    /// Original sync operation type when conflict was logged (create_job, update_job, delete_job, etc.); used when resolving without queued op
    let operationType: String?

    /// Display string for server value (for UI)
    var serverValueDisplay: String {
        serverValue.map { "\($0)" } ?? "—"
    }

    /// Display string for local value (for UI)
    var localValueDisplay: String {
        localValue.map { "\($0)" } ?? "—"
    }

    init(
        id: String = UUID().uuidString,
        entityType: String,
        entityId: String,
        field: String,
        serverValue: AnyHashable?,
        localValue: AnyHashable?,
        serverTimestamp: Date,
        localTimestamp: Date,
        operationType: String? = nil
    ) {
        self.id = id
        self.entityType = entityType
        self.entityId = entityId
        self.field = field
        self.serverValue = serverValue
        self.localValue = localValue
        self.serverTimestamp = serverTimestamp
        self.localTimestamp = localTimestamp
        self.operationType = operationType
    }

    /// Create from backend conflict response (accepts Any and converts to Hashable where possible)
    init(
        id: String,
        entityType: String,
        entityId: String,
        field: String,
        serverValue: Any?,
        localValue: Any?,
        serverTimestamp: Date?,
        localTimestamp: Date?,
        operationType: String? = nil
    ) {
        self.id = id
        self.entityType = entityType
        self.entityId = entityId
        self.field = field
        self.serverValue = serverValue as? AnyHashable
        self.localValue = localValue as? AnyHashable
        self.serverTimestamp = serverTimestamp ?? Date()
        self.localTimestamp = localTimestamp ?? Date()
        self.operationType = operationType
    }
}

// MARK: - Conflict Resolution Strategy

enum ConflictResolutionStrategy: String, Codable {
    case serverWins = "server_wins"
    case localWins = "local_wins"
    case merge = "merge"
    case askUser = "ask_user"
}

/// Result of user conflict resolution: strategy plus per-field resolved values for merge.
struct ConflictResolutionOutcome {
    let strategy: ConflictResolutionStrategy
    /// For merge (or per-field resolution): field name -> resolved value. Passed to SyncEngine.resolveConflict(resolvedValue:).
    let perFieldResolvedValues: [String: Any]?
}
