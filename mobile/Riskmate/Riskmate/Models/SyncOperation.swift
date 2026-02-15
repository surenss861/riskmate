import Foundation

/// Type of sync operation for the offline sync engine
enum OperationType: String, Codable {
    case createJob
    case updateJob
    case deleteJob
    case createHazard
    case updateHazard
    case deleteHazard
    case createControl
    case updateControl
    case deleteControl
}

/// A single sync operation queued for upload
struct SyncOperation: Codable, Identifiable {
    let id: String
    let type: OperationType
    let entityId: String
    let data: Data
    let priority: Int
    let retryCount: Int
    let lastAttempt: Date?
    let lastError: String?
    let clientTimestamp: Date

    /// True when the operation has failed (has lastError or retryCount > 0)
    var isFailed: Bool { (lastError != nil && !(lastError?.isEmpty ?? true)) || retryCount > 0 }

    init(
        id: String = UUID().uuidString,
        type: OperationType,
        entityId: String,
        data: Data,
        priority: Int = 0,
        retryCount: Int = 0,
        lastAttempt: Date? = nil,
        lastError: String? = nil,
        clientTimestamp: Date = Date()
    ) {
        self.id = id
        self.type = type
        self.entityId = entityId
        self.data = data
        self.priority = priority
        self.retryCount = retryCount
        self.lastAttempt = lastAttempt
        self.lastError = lastError
        self.clientTimestamp = clientTimestamp
    }

    /// JSON representation for backend batch sync API
    func toBatchRequestItem() -> [String: Any] {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        formatter.timeZone = TimeZone(identifier: "UTC")

        return [
            "id": id,
            "type": type.apiTypeString,
            "entity_id": entityId,
            "data": (try? JSONSerialization.jsonObject(with: data)) ?? [:] as [String: Any],
            "client_timestamp": formatter.string(from: clientTimestamp),
        ]
    }
}

extension OperationType {
    /// Snake_case string for backend API (create_job, update_job, etc.)
    var apiTypeString: String {
        switch self {
        case .createJob: return "create_job"
        case .updateJob: return "update_job"
        case .deleteJob: return "delete_job"
        case .createHazard: return "create_hazard"
        case .updateHazard: return "update_hazard"
        case .deleteHazard: return "delete_hazard"
        case .createControl: return "create_control"
        case .updateControl: return "update_control"
        case .deleteControl: return "delete_control"
        }
    }
}
