import Foundation
import UIKit
import UserNotifications
import Combine

/// Background export manager for PDF and Proof Pack generation
/// Handles queue, progress, local caching, and auto-share
@MainActor
class BackgroundExportManager: NSObject, ObservableObject {
    static let shared = BackgroundExportManager()
    
    @Published var exports: [ExportTask] = []
    
    private let exportsDirectory: URL
    private let exportsKey = "com.riskmate.backgroundExports"
    private let lastExportKey = "com.riskmate.lastExport"
    
    private override init() {
        let fileManager = FileManager.default
        let supportDir = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        exportsDirectory = supportDir.appendingPathComponent("Riskmate/Exports", isDirectory: true)
        
        super.init()
        
        // Create exports directory
        try? fileManager.createDirectory(at: exportsDirectory, withIntermediateDirectories: true)
        
        loadExports()
    }
    
    // MARK: - Export Management
    
    /// Start exporting PDF or Proof Pack
    func export(
        jobId: String,
        type: ExportType,
        initiatedFromForeground: Bool = true
    ) async throws {
        let exportId = UUID().uuidString
        
        // Check for duplicate export
        if exports.contains(where: { $0.jobId == jobId && $0.type == type && ($0.state == .queued || $0.state == .preparing || $0.state == .downloading) }) {
            print("[BackgroundExportManager] Duplicate export detected, skipping")
            return
        }
        
        // Track analytics
        Analytics.shared.trackExportStarted(jobId: jobId, type: type.rawValue)
        
        let export = ExportTask(
            id: exportId,
            jobId: jobId,
            type: type,
            state: .queued,
            progress: 0.0,
            createdAt: Date(),
            initiatedFromForeground: initiatedFromForeground
        )
        
        exports.append(export)
        saveExports()
        
        // Start export process
        await startExport(export)
    }
    
    private static let pollIntervalSeconds: Double = 2.5
    private static let exportTimeoutSeconds: Double = 300 // 5 minutes

    private func startExport(_ export: ExportTask) async {
        updateExportState(export.id, state: .preparing)

        do {
            // 1. Create export job on server (async contract: POST returns id, not file)
            let serverExportId = try await APIClient.shared.createExport(jobId: export.jobId, type: export.type)

            // 2. Poll until ready or failed
            let exportRecord = try await pollExportUntilReady(exportId: serverExportId)
            guard exportRecord.state.lowercased() == "ready",
                  let downloadURLString = exportRecord.downloadUrl, !downloadURLString.isEmpty else {
                let reason = exportRecord.failureReason ?? "Export did not complete"
                throw NSError(domain: "BackgroundExportManager", code: -1, userInfo: [NSLocalizedDescriptionKey: reason])
            }

            // 3. Download file from signed URL
            let fileURL = try await APIClient.shared.downloadExportFile(url: downloadURLString, type: export.type)

            // 4. Move to permanent location
            let permanentURL = try saveExportFile(
                sourceURL: fileURL,
                jobId: export.jobId,
                type: export.type,
                exportId: export.id
            )

            saveLastExport(jobId: export.jobId, type: export.type, url: permanentURL)
            updateExportState(export.id, state: .ready, fileURL: permanentURL)

            Analytics.shared.trackExportSucceeded(jobId: export.jobId, type: export.type.rawValue)
            Task {
                try? await APIClient.shared.logEvent(
                    eventType: "export.generated",
                    entityType: "export",
                    entityId: serverExportId,
                    metadata: [
                        "job_id": export.jobId,
                        "type": export.type.rawValue,
                        "export_id": serverExportId
                    ]
                )
            }
            await EntitlementsManager.shared.refresh()

            if export.initiatedFromForeground {
                await triggerShare(export: export, fileURL: permanentURL)
            } else {
                await showExportReadyNotification(export: export, fileURL: permanentURL)
            }

        } catch {
            let errorMessage = error.localizedDescription
            updateExportState(export.id, state: .failed(errorMessage))
            Analytics.shared.trackExportFailed(jobId: export.jobId, type: export.type.rawValue, error: errorMessage)
            CrashReporting.shared.captureError(error)
        }
    }

    /// Poll GET /api/exports/:id until state is ready or failed, or timeout.
    private func pollExportUntilReady(exportId: String) async throws -> Export {
        let deadline = Date().addingTimeInterval(Self.exportTimeoutSeconds)
        while true {
            let record = try await APIClient.shared.getExport(exportId: exportId)
            let state = record.state.lowercased()
            if state == "ready" || state == "failed" {
                return record
            }
            if Date() >= deadline {
                throw NSError(domain: "BackgroundExportManager", code: -2, userInfo: [NSLocalizedDescriptionKey: "Export timed out. Check export history in a few minutes."])
            }
            try await Task.sleep(nanoseconds: UInt64(Self.pollIntervalSeconds * 1_000_000_000))
        }
    }
    
    private func saveExportFile(sourceURL: URL, jobId: String, type: ExportType, exportId: String) throws -> URL {
        let fileExtension = type == .pdf ? "pdf" : "zip"
        let fileName = "\(type.rawValue)-\(jobId)-\(exportId).\(fileExtension)"
        let destinationURL = exportsDirectory.appendingPathComponent(fileName)
        
        // Copy file to permanent location - handle errors explicitly
        do {
            // Remove existing file if it exists
            if FileManager.default.fileExists(atPath: destinationURL.path) {
                try FileManager.default.removeItem(at: destinationURL)
            }
            try FileManager.default.copyItem(at: sourceURL, to: destinationURL)
        } catch {
            print("[BackgroundExportManager] Failed to save export file: \(error.localizedDescription)")
            throw error
        }
        
        return destinationURL
    }
    
    private func saveLastExport(jobId: String, type: ExportType, url: URL) {
        let key = "\(lastExportKey)_\(jobId)_\(type.rawValue)"
        let lastExport = LastExport(
            jobId: jobId,
            type: type,
            fileURL: url,
            generatedAt: Date()
        )
        
        if let data = try? JSONEncoder().encode(lastExport) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }
    
    func getLastExport(jobId: String, type: ExportType) -> LastExport? {
        let key = "\(lastExportKey)_\(jobId)_\(type.rawValue)"
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(LastExport.self, from: data)
    }
    
    func getAllExportsForJob(jobId: String) -> [ExportTask] {
        return exports.filter { $0.jobId == jobId }
            .sorted { $0.createdAt > $1.createdAt }
    }
    
    // MARK: - State Management
    
    @MainActor
    private func updateExportState(_ exportId: String, state: ExportState, fileURL: URL? = nil, progress: Double? = nil) {
        if let index = exports.firstIndex(where: { $0.id == exportId }) {
            exports[index].state = state
            if let fileURL = fileURL {
                exports[index].fileURL = fileURL
            }
            if let progress = progress {
                exports[index].progress = progress
            }
            saveExports()
        }
    }
    
    // MARK: - Share & Notifications
    
    private func triggerShare(export: ExportTask, fileURL: URL) async {
        // This will be handled by the view that initiated the export
        // The view should observe the export state and trigger share sheet
    }
    
    private func showExportReadyNotification(export: ExportTask, fileURL: URL) async {
        let content = UNMutableNotificationContent()
        content.title = "Export Ready"
        content.body = "\(export.type.displayName) for job is ready to share"
        content.sound = .default
        content.userInfo = [
            "exportId": export.id,
            "jobId": export.jobId,
            "type": export.type.rawValue,
            "fileURL": fileURL.path
        ]
        
        let request = UNNotificationRequest(
            identifier: "export_\(export.id)",
            content: content,
            trigger: nil
        )
        
        try? await UNUserNotificationCenter.current().add(request)
    }
    
    // MARK: - Persistence
    
    private func saveExports() {
        if let data = try? JSONEncoder().encode(exports) {
            UserDefaults.standard.set(data, forKey: exportsKey)
        }
    }
    
    private func loadExports() {
        guard let data = UserDefaults.standard.data(forKey: exportsKey),
              let loaded = try? JSONDecoder().decode([ExportTask].self, from: data) else {
            return
        }
        exports = loaded
    }
}

// MARK: - Models

struct ExportTask: Identifiable, Codable, Equatable {
    let id: String
    let jobId: String
    let type: ExportType
    var state: ExportState
    var progress: Double
    let createdAt: Date
    var fileURL: URL?
    let initiatedFromForeground: Bool
    
    enum CodingKeys: String, CodingKey {
        case id, jobId, type, state, progress, createdAt, initiatedFromForeground
        case fileURL = "file_url"
    }
    
    init(id: String, jobId: String, type: ExportType, state: ExportState, progress: Double, createdAt: Date, fileURL: URL? = nil, initiatedFromForeground: Bool) {
        self.id = id
        self.jobId = jobId
        self.type = type
        self.state = state
        self.progress = progress
        self.createdAt = createdAt
        self.fileURL = fileURL
        self.initiatedFromForeground = initiatedFromForeground
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        jobId = try container.decode(String.self, forKey: .jobId)
        type = try container.decode(ExportType.self, forKey: .type)
        state = try container.decode(ExportState.self, forKey: .state)
        progress = try container.decode(Double.self, forKey: .progress)
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        initiatedFromForeground = try container.decode(Bool.self, forKey: .initiatedFromForeground)
        
        if let urlString = try? container.decode(String.self, forKey: .fileURL) {
            fileURL = URL(fileURLWithPath: urlString)
        }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(jobId, forKey: .jobId)
        try container.encode(type, forKey: .type)
        try container.encode(state, forKey: .state)
        try container.encode(progress, forKey: .progress)
        try container.encode(createdAt, forKey: .createdAt)
        try container.encode(initiatedFromForeground, forKey: .initiatedFromForeground)
        if let fileURL = fileURL {
            try container.encode(fileURL.path, forKey: .fileURL)
        }
    }
    
    static func == (lhs: ExportTask, rhs: ExportTask) -> Bool {
        return lhs.id == rhs.id &&
               lhs.jobId == rhs.jobId &&
               lhs.type == rhs.type &&
               lhs.state == rhs.state &&
               lhs.progress == rhs.progress &&
               lhs.createdAt == rhs.createdAt &&
               lhs.fileURL?.absoluteString == rhs.fileURL?.absoluteString &&
               lhs.initiatedFromForeground == rhs.initiatedFromForeground
    }
}

enum ExportType: String, Codable {
    case pdf
    case proofPack
    
    var displayName: String {
        switch self {
        case .pdf: return "Risk Snapshot PDF"
        case .proofPack: return "Proof Pack"
        }
    }
}

enum ExportState: Codable, Equatable {
    case queued
    case preparing
    case downloading
    case ready
    case failed(String)
    
    enum CodingKeys: String, CodingKey {
        case type
        case error
    }
    
    static func == (lhs: ExportState, rhs: ExportState) -> Bool {
        switch (lhs, rhs) {
        case (.queued, .queued),
             (.preparing, .preparing),
             (.downloading, .downloading),
             (.ready, .ready):
            return true
        case (.failed(let lhsError), .failed(let rhsError)):
            return lhsError == rhsError
        default:
            return false
        }
    }

    /// Use this instead of `== .failed` to avoid ambiguity with other `.failed` types (e.g. gesture phase).
    var isFailed: Bool {
        if case .failed = self { return true }
        return false
    }
    
    enum StateType: String, Codable {
        case queued
        case preparing
        case downloading
        case ready
        case failed
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(StateType.self, forKey: .type)
        
        switch type {
        case .queued:
            self = .queued
        case .preparing:
            self = .preparing
        case .downloading:
            self = .downloading
        case .ready:
            self = .ready
        case .failed:
            let error = try container.decode(String.self, forKey: .error)
            self = .failed(error)
        }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        
        switch self {
        case .queued:
            try container.encode(StateType.queued, forKey: .type)
        case .preparing:
            try container.encode(StateType.preparing, forKey: .type)
        case .downloading:
            try container.encode(StateType.downloading, forKey: .type)
        case .ready:
            try container.encode(StateType.ready, forKey: .type)
        case .failed(let error):
            try container.encode(StateType.failed, forKey: .type)
            try container.encode(error, forKey: .error)
        }
    }
}

struct LastExport: Codable {
    let jobId: String
    let type: ExportType
    let fileURL: URL
    let generatedAt: Date
    
    enum CodingKeys: String, CodingKey {
        case jobId, type, generatedAt
        case fileURL = "file_url"
    }
    
    init(jobId: String, type: ExportType, fileURL: URL, generatedAt: Date) {
        self.jobId = jobId
        self.type = type
        self.fileURL = fileURL
        self.generatedAt = generatedAt
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        jobId = try container.decode(String.self, forKey: .jobId)
        type = try container.decode(ExportType.self, forKey: .type)
        generatedAt = try container.decode(Date.self, forKey: .generatedAt)
        
        if let urlString = try? container.decode(String.self, forKey: .fileURL) {
            fileURL = URL(fileURLWithPath: urlString)
        } else {
            throw DecodingError.dataCorruptedError(forKey: .fileURL, in: container, debugDescription: "fileURL is required")
        }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(jobId, forKey: .jobId)
        try container.encode(type, forKey: .type)
        try container.encode(generatedAt, forKey: .generatedAt)
        try container.encode(fileURL.path, forKey: .fileURL)
    }
}
