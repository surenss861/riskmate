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
    /// User/actor identifier for the server version (who last modified on server)
    let serverActor: String?
    /// User/actor identifier for the local version (who made the local change)
    let localActor: String?
    /// Raw server value (e.g. full payload dict) for manual merge; preserved when creating from API, nil when loading from DB.
    let serverValueForMerge: Any?

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
        operationType: String? = nil,
        serverActor: String? = nil,
        localActor: String? = nil
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
        self.serverActor = serverActor
        self.localActor = localActor
        self.serverValueForMerge = nil
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
        operationType: String? = nil,
        serverActor: String? = nil,
        localActor: String? = nil
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
        self.serverActor = serverActor
        self.localActor = localActor
        self.serverValueForMerge = serverValue
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

// MARK: - Hazard/Control Merge Helper (testable)

/// Builds a merged payload for hazard/control dual-add conflicts: start from local payload and selectively keep differing server fields.
enum SyncConflictMerge {

    /// Automatic strategy selection for given entity/field. Nil means ask_user (e.g. evidence/photo deletion).
    /// Strategies: server wins for job status, local wins for job details, merge for hazard/control dual-add.
    static func autoStrategyForConflict(entityType: String, field: String) -> ConflictResolutionStrategy? {
        if entityType == "evidence" || field.contains("photo") || field.contains("evidence") {
            return nil
        }
        if entityType == "job" {
            if field == "status" { return .serverWins }
            // All non-status job fields (job_type, location, risk_score, risk_level, client_name, description, etc.) default to local-wins.
            return .localWins
        }
        if entityType == "hazard" || entityType == "control" {
            return .merge
        }
        return nil
    }
    static func mergeHazardControlPayload(
        localDict: [String: Any],
        serverValue: Any?,
        conflictField: String?
    ) -> [String: Any] {
        var merged = localDict
        guard let serverValue = serverValue else { return merged }
        if let serverDict = serverValue as? [String: Any] {
            for (key, serverVal) in serverDict {
                let localVal = merged[key]
                if localVal == nil || !areEqual(localVal, serverVal) {
                    merged[key] = serverVal
                }
            }
        } else if let field = conflictField {
            merged[field] = serverValue
        }
        return merged
    }

    static func areEqual(_ a: Any?, _ b: Any) -> Bool {
        guard let a = a else { return false }
        if let sa = a as? String, let sb = b as? String { return sa == sb }
        if let na = a as? NSNumber, let nb = b as? NSNumber { return na.isEqual(nb) }
        if let da = a as? [String: Any], let db = b as? [String: Any] {
            guard da.keys.count == db.keys.count else { return false }
            for (k, va) in da {
                guard let vb = db[k], areEqual(va, vb) else { return false }
            }
            return true
        }
        return false
    }
}
