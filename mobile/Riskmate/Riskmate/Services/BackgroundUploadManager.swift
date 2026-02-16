import Foundation
import UIKit
import Combine
import CryptoKit

/// Background upload manager for evidence and documents
/// Handles background URLSession uploads that continue even when app is backgrounded
@MainActor
class BackgroundUploadManager: NSObject, ObservableObject {
    static let shared = BackgroundUploadManager()
    
    @Published var uploads: [UploadTask] = []
    
    private var backgroundSession: URLSession!
    private var backgroundCompletionHandler: (() -> Void)?
    private let uploadsKey = "com.riskmate.backgroundUploads"
    private let taskMappingKey = "com.riskmate.uploadTaskMappings"
    
    private override init() {
        super.init()
        setupBackgroundSession()
        loadUploads()
        reconcileOnLaunch()
    }
    
    // MARK: - Setup
    
    private func setupBackgroundSession() {
        let config = URLSessionConfiguration.background(withIdentifier: "com.riskmate.backgroundUploads")
        config.isDiscretionary = false
        config.sessionSendsLaunchEvents = true
        config.allowsCellularAccess = true
        
        backgroundSession = URLSession(
            configuration: config,
            delegate: self,
            delegateQueue: nil
        )
    }
    
    func setBackgroundCompletionHandler(_ handler: @escaping () -> Void) {
        backgroundCompletionHandler = handler
    }
    
    // MARK: - Upload Management
    
    /// Start uploading evidence in background
    /// - Parameters:
    ///   - category: Photo category: "before", "during", or "after". Defaults to "during" if nil.
    func uploadEvidence(
        jobId: String,
        evidenceId: String,
        fileData: Data,
        fileName: String,
        mimeType: String,
        category: String? = nil
    ) async throws {
        // Check for duplicate upload (idempotency)
        if uploads.contains(where: { upload in
            guard upload.id == evidenceId else { return false }
            switch upload.state {
            case .uploading, .queued:
                return true
            case .synced, .failed:
                return false
            }
        }) {
            print("[BackgroundUploadManager] Duplicate upload detected for \(evidenceId), skipping")
            return
        }
        
        // Get auth token
        guard let token = try await AuthService.shared.getAccessToken() else {
            throw UploadError.noAuthToken
        }
        
        // Generate idempotency key (hash of file data + evidenceId)
        let idempotencyKey = generateIdempotencyKey(fileData: fileData, evidenceId: evidenceId)
        
        // CRITICAL: Background URLSession cannot upload from Data/NSData
        // Must write to disk first, then use fromFile:
        let fileExtension = (fileName as NSString).pathExtension.isEmpty ? "dat" : (fileName as NSString).pathExtension
        let tempFileName = "\(evidenceId)-\(UUID().uuidString).\(fileExtension)"
        let fileURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(tempFileName)
        
        // Create upload task (store file URL and category for retries/display)
        let upload = UploadTask(
            id: evidenceId,
            jobId: jobId,
            fileName: fileName,
            state: .queued,
            progress: 0.0,
            createdAt: Date(),
            idempotencyKey: idempotencyKey,
            fileURL: fileURL.path,
            category: category ?? "during"
        )
        
        // Create multipart form data
        let boundary = UUID().uuidString
        var body = Data()
        let categoryValue = category ?? "during"
        
        // Add category (photo category: before/during/after) — backend reads "category"
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"category\"\r\n\r\n".data(using: .utf8)!)
        body.append(categoryValue.data(using: .utf8)!)
        body.append("\r\n".data(using: .utf8)!)
        
        // Backward compatibility: also send phase for legacy backend support
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"phase\"\r\n\r\n".data(using: .utf8)!)
        body.append(categoryValue.data(using: .utf8)!)
        body.append("\r\n".data(using: .utf8)!)
        
        // Add file data
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(fileName)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(fileData)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        
        // Write multipart body to disk (required for background uploads)
        do {
            try body.write(to: fileURL, options: .atomic)
        } catch {
            throw UploadError.uploadFailed("Failed to write upload file to disk: \(error.localizedDescription)")
        }
        
        // Persist upload only after temp file exists so retries have a valid source file
        uploads.append(upload)
        saveUploads()
        
        // Create request
        let baseURL = AppConfig.shared.backendURL
        guard let url = URL(string: "\(baseURL)/api/jobs/\(jobId)/evidence/upload") else {
            // Clean up temp file on error
            try? FileManager.default.removeItem(at: fileURL)
            throw UploadError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.setValue("\(body.count)", forHTTPHeaderField: "Content-Length")
        request.setValue(idempotencyKey, forHTTPHeaderField: "Idempotency-Key")
        request.timeoutInterval = 60.0 // 60 second timeout for uploads
        
        // CRITICAL FIX: Background uploads MUST use fromFile: not from: Data
        let task = backgroundSession.uploadTask(with: request, fromFile: fileURL)
        
        // Store mapping: taskIdentifier -> uploadId
        storeTaskMapping(taskIdentifier: task.taskIdentifier, uploadId: evidenceId)
        
        // Update state
        updateUploadState(evidenceId, state: .uploading)
        
        // Track analytics
        Analytics.shared.trackEvidenceUploadStarted(evidenceId: evidenceId)
        
        task.resume()
    }
    
    /// Generate idempotency key from file data and evidence ID (deterministic SHA256, stable across app launches)
    private func generateIdempotencyKey(fileData: Data, evidenceId: String) -> String {
        var input = Data()
        if let idData = evidenceId.data(using: .utf8) {
            input.append(idData)
        }
        input.append(fileData)
        let hash = SHA256.hash(data: input)
        return hash.map { String(format: "%02x", $0) }.joined()
    }

    /// Extracts the raw file part body from a multipart/form-data file (strips part headers).
    /// Used to regenerate idempotency key for legacy uploads so it matches the original request.
    private func extractRawFileBytesFromMultipart(fileURL: URL) throws -> Data {
        let data = try Data(contentsOf: fileURL)
        var idx = data.startIndex
        while idx < data.endIndex && data[idx] != 0x0d && data[idx] != 0x0a {
            idx = data.index(after: idx)
        }
        guard idx > data.startIndex,
              let firstLine = String(data: data[data.startIndex..<idx], encoding: .utf8),
              firstLine.hasPrefix("--") else {
            throw UploadError.uploadFailed("Invalid multipart file format - please add evidence again")
        }
        let boundary = String(firstLine.dropFirst(2))
        let boundaryDelim = "\r\n--\(boundary)\r\n"
        let boundaryEnd = "\r\n--\(boundary)--"
        guard let boundaryDelimData = boundaryDelim.data(using: .utf8),
              let boundaryEndData = boundaryEnd.data(using: .utf8),
              let doubleNewline = "\r\n\r\n".data(using: .utf8),
              let filePartPrefix = "name=\"file\"".data(using: .utf8) else {
            throw UploadError.uploadFailed("Invalid multipart encoding - please add evidence again")
        }
        var searchStart = data.startIndex
        while searchStart < data.endIndex {
            guard let range = data.range(of: boundaryDelimData, in: searchStart..<data.endIndex) else {
                break
            }
            let partStart = range.upperBound
            let partSlice = data[partStart..<data.endIndex]
            guard let headerEndRange = partSlice.range(of: doubleNewline) else {
                searchStart = range.upperBound
                continue
            }
            let headers = data[partStart..<headerEndRange.lowerBound]
            if headers.range(of: filePartPrefix) != nil {
                let bodyStart = headerEndRange.upperBound
                let afterBody = data[bodyStart..<data.endIndex]
                if let endRange = afterBody.range(of: boundaryDelimData) {
                    return Data(data[bodyStart..<endRange.lowerBound])
                }
                if let endRange = afterBody.range(of: boundaryEndData) {
                    return Data(data[bodyStart..<endRange.lowerBound])
                }
                throw UploadError.uploadFailed("Invalid multipart file format - file part not terminated - please add evidence again")
            }
            searchStart = range.upperBound
        }
        throw UploadError.uploadFailed("File part not found in multipart - please add evidence again")
    }

    /// Reconcile uploads on app launch - check for completed tasks
    private func reconcileOnLaunch() {
        // Get all active background tasks
        backgroundSession.getAllTasks { tasks in
            let activeTaskIds = Set(tasks.compactMap { task in
                if task.state == .running || task.state == .suspended {
                    return task.taskIdentifier
                }
                return nil
            })
            
            // Mark uploads as failed if their task is no longer active
            Task { @MainActor in
                for upload in self.uploads {
                    if case .uploading = upload.state {
                        // Check if task is still active
                        if let taskId = self.getTaskId(for: upload.id),
                           !activeTaskIds.contains(taskId) {
                            // Task completed but we didn't get the callback - mark as synced
                            // (likely succeeded but app was terminated)
                            self.updateUploadState(upload.id, state: .synced)
                        }
                    }
                }
            }
        }
    }
    
    /// Retry failed upload: create and start a new upload task using the preserved temp file
    func retryUpload(_ upload: UploadTask) async throws {
        // Verify file still exists for retry
        guard let filePath = upload.fileURL else {
            throw UploadError.uploadFailed("Original file no longer available - please add evidence again")
        }
        let fileURL = URL(fileURLWithPath: filePath)
        guard FileManager.default.fileExists(atPath: filePath) else {
            throw UploadError.uploadFailed("Original file no longer available - please add evidence again")
        }
        
        // Get auth token
        guard let token = try await AuthService.shared.getAccessToken() else {
            throw UploadError.noAuthToken
        }
        
        // Extract boundary from multipart file (first line is --{boundary}\r\n)
        let boundary: String
        do {
            let data = try Data(contentsOf: fileURL)
            var firstLineEnd = data.startIndex
            while firstLineEnd < data.endIndex && data[firstLineEnd] != 0x0d && data[firstLineEnd] != 0x0a {
                firstLineEnd = data.index(after: firstLineEnd)
            }
            guard let firstLine = String(data: data[..<firstLineEnd], encoding: .utf8),
                  firstLine.hasPrefix("--") else {
                throw UploadError.uploadFailed("Invalid multipart file format - please add evidence again")
            }
            boundary = String(firstLine.dropFirst(2))
        } catch {
            throw UploadError.uploadFailed("Could not read upload file - please add evidence again")
        }
        
        // Get file size
        let fileSize: Int
        do {
            let attrs = try FileManager.default.attributesOfItem(atPath: filePath)
            fileSize = attrs[.size] as? Int ?? 0
        } catch {
            throw UploadError.uploadFailed("Could not read file size - please add evidence again")
        }
        
        let baseURL = AppConfig.shared.backendURL
        guard let url = URL(string: "\(baseURL)/api/jobs/\(upload.jobId)/evidence/upload") else {
            throw UploadError.invalidURL
        }
        
        // Use persisted idempotency key so retries do not create duplicate evidence. For legacy
        // uploads without a stored key, regenerate from raw file bytes (strip multipart headers).
        let idempotencyKey: String
        if let key = upload.idempotencyKey {
            idempotencyKey = key
        } else {
            let rawFileBytes = try extractRawFileBytesFromMultipart(fileURL: fileURL)
            idempotencyKey = generateIdempotencyKey(fileData: rawFileBytes, evidenceId: upload.id)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.setValue("\(fileSize)", forHTTPHeaderField: "Content-Length")
        request.setValue(idempotencyKey, forHTTPHeaderField: "Idempotency-Key")
        request.timeoutInterval = 60.0
        
        // Remove old task mapping (if any) before creating new task
        removeTaskMapping(forUploadId: upload.id)
        
        let task = backgroundSession.uploadTask(with: request, fromFile: fileURL)
        storeTaskMapping(taskIdentifier: task.taskIdentifier, uploadId: upload.id)
        
        // Update retry count and state
        if let idx = uploads.firstIndex(where: { $0.id == upload.id }) {
            uploads[idx].retryCount += 1
            uploads[idx].state = .uploading
            uploads[idx].progress = 0
        } else {
            var updated = upload
            updated.retryCount += 1
            updated.state = .uploading
            updated.progress = 0
            uploads.append(updated)
        }
        saveUploads()
        
        Analytics.shared.trackEvidenceUploadStarted(evidenceId: upload.id)
        task.resume()
    }
    
    private func removeTaskMapping(forUploadId uploadId: String) {
        var mappings = getTaskMappings()
        let keysToRemove = mappings.filter { $0.value == uploadId }.map { $0.key }
        for k in keysToRemove { mappings.removeValue(forKey: k) }
        saveTaskMappings(mappings)
    }
    
    /// Remove an upload by id (e.g. when user resolves evidence conflict with "Use Server Version").
    func removeUpload(id uploadId: String) {
        removeTaskMapping(forUploadId: uploadId)
        uploads.removeAll { $0.id == uploadId }
        saveUploads()
    }

    /// Get upload by id (e.g. for retry when resolving evidence conflict with "Use My Version").
    func upload(id uploadId: String) -> UploadTask? {
        uploads.first { $0.id == uploadId }
    }

    // MARK: - State Management
    
    private func updateUploadState(_ uploadId: String, state: UploadState, progress: Double? = nil) {
        if let index = uploads.firstIndex(where: { $0.id == uploadId }) {
            uploads[index].state = state
            if let progress = progress {
                uploads[index].progress = progress
            }
            saveUploads()
        }
    }
    
    // MARK: - Persistence
    
    private func saveUploads() {
        if let data = try? JSONEncoder().encode(uploads) {
            UserDefaults.standard.set(data, forKey: uploadsKey)
        }
    }
    
    private func loadUploads() {
        guard let data = UserDefaults.standard.data(forKey: uploadsKey),
              let loaded = try? JSONDecoder().decode([UploadTask].self, from: data) else {
            return
        }
        uploads = loaded
    }
    
    private func storeTaskMapping(taskIdentifier: Int, uploadId: String) {
        var mappings = getTaskMappings()
        mappings[taskIdentifier] = uploadId
        saveTaskMappings(mappings)
    }
    
    nonisolated private func getUploadId(for taskIdentifier: Int) -> String? {
        // Access UserDefaults directly (thread-safe for reads)
        guard let data = UserDefaults.standard.data(forKey: taskMappingKey),
              let mappings = try? JSONDecoder().decode([String: String].self, from: data) else {
            return nil
        }
        guard let stringKey = String(taskIdentifier) as String?,
              let uploadId = mappings[stringKey] else {
            return nil
        }
        return uploadId
    }
    
    private func getTaskId(for uploadId: String) -> Int? {
        let mappings = getTaskMappings()
        return mappings.first(where: { $0.value == uploadId })?.key
    }
    
    private func getTaskMappings() -> [Int: String] {
        guard let data = UserDefaults.standard.data(forKey: taskMappingKey),
              let mappings = try? JSONDecoder().decode([String: String].self, from: data) else {
            return [:]
        }
        return Dictionary(uniqueKeysWithValues: mappings.compactMap { key, value in
            guard let intKey = Int(key) else { return nil }
            return (intKey, value)
        })
    }
    
    private func saveTaskMappings(_ mappings: [Int: String]) {
        let stringMappings = Dictionary(uniqueKeysWithValues: mappings.map { (String($0.key), $0.value) })
        if let data = try? JSONEncoder().encode(stringMappings) {
            UserDefaults.standard.set(data, forKey: taskMappingKey)
        }
    }
}

// MARK: - URLSessionDelegate

extension BackgroundUploadManager: URLSessionDelegate {
    nonisolated func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
        DispatchQueue.main.async { [weak self] in
            self?.backgroundCompletionHandler?()
            self?.backgroundCompletionHandler = nil
        }
    }
}

// MARK: - URLSessionTaskDelegate

extension BackgroundUploadManager: URLSessionTaskDelegate {
    nonisolated func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard let uploadId = getUploadId(for: task.taskIdentifier) else { return }
        
        let httpStatus = (task.response as? HTTPURLResponse)?.statusCode
        
        Task { @MainActor [weak self] in
            guard let self = self else { return }
            
            // Get upload info before cleanup
            let upload = self.uploads.first(where: { $0.id == uploadId })
            let jobId = upload?.jobId ?? ""
            
            if let error = error {
                let errorMessage = error.localizedDescription
                self.updateUploadState(uploadId, state: .failed(errorMessage))
                Analytics.shared.trackEvidenceUploadFailed(evidenceId: uploadId, error: errorMessage)
                CrashReporting.shared.captureError(error)
            } else if httpStatus == 404 || httpStatus == 410 {
                // Server deleted job or evidence while we had an offline upload (server-deleted vs offline-upload conflict)
                let conflictId = "evidence:\(jobId):\(uploadId)"
                OfflineDatabase.shared.insertConflict(
                    id: conflictId,
                    entityType: "evidence",
                    entityId: uploadId,
                    field: "upload",
                    serverVersion: "deleted",
                    localVersion: "pending_upload",
                    serverTimestamp: Date(),
                    localTimestamp: upload?.createdAt ?? Date(),
                    resolutionStrategy: nil,
                    operationType: nil,
                    serverActor: nil,
                    localActor: nil,
                    serverPayload: nil,
                    localPayload: (try? JSONSerialization.data(withJSONObject: ["job_id": jobId])).flatMap { String(data: $0, encoding: .utf8) }
                )
                self.updateUploadState(uploadId, state: .failed("Job or evidence was deleted on server. Resolve in Sync → Conflicts."))
                NotificationCenter.default.post(name: Notification.Name("SyncConflictHistoryDidChange"), object: nil)
            } else {
                // Clean up temp file only on success; keep on failure for retry
                if let upload = upload,
                   let filePath = upload.fileURL {
                    let fileURL = URL(fileURLWithPath: filePath)
                    try? FileManager.default.removeItem(at: fileURL)
                }
                
                self.updateUploadState(uploadId, state: .synced)
                Analytics.shared.trackEvidenceUploadSucceeded(evidenceId: uploadId)
                
                // Log event for iOS ↔ web parity
                Task {
                    try? await APIClient.shared.logEvent(
                        eventType: "evidence.uploaded",
                        entityType: "evidence",
                        entityId: uploadId,
                        metadata: [
                            "evidence_id": uploadId,
                            "job_id": jobId
                        ]
                    )
                }
                
                // Refresh entitlements after evidence upload (in case limits changed)
                await EntitlementsManager.shared.refresh()
            }
        }
    }
    
    nonisolated func urlSession(_ session: URLSession, task: URLSessionTask, didSendBodyData bytesSent: Int64, totalBytesSent: Int64, totalBytesExpectedToSend: Int64) {
        guard let uploadId = getUploadId(for: task.taskIdentifier) else { return }
        
        let progress = Double(totalBytesSent) / Double(totalBytesExpectedToSend)
        
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.updateUploadState(uploadId, state: .uploading, progress: progress)
        }
    }
}

// MARK: - Models

struct UploadTask: Identifiable, Codable, Equatable {
    let id: String
    let jobId: String
    let fileName: String
    var state: UploadState
    var progress: Double
    let createdAt: Date
    var retryCount: Int = 0
    var idempotencyKey: String?
    var fileURL: String? // Path to temporary file for background uploads
    /// Photo category: "before", "during", or "after" (saved with upload; used for display and retry)
    var category: String?

    enum CodingKeys: String, CodingKey {
        case id, jobId, fileName, state, progress, createdAt, retryCount, idempotencyKey, fileURL, category
    }
}

enum UploadState: Codable, Equatable {
    case queued
    case uploading
    case synced
    case failed(String)
    
    static func == (lhs: UploadState, rhs: UploadState) -> Bool {
        switch (lhs, rhs) {
        case (.queued, .queued),
             (.uploading, .uploading),
             (.synced, .synced):
            return true
        case (.failed(let lhsError), .failed(let rhsError)):
            return lhsError == rhsError
        default:
            return false
        }
    }
    
    enum CodingKeys: String, CodingKey {
        case type
        case error
    }
    
    enum StateType: String, Codable {
        case queued
        case uploading
        case synced
        case failed
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(StateType.self, forKey: .type)
        
        switch type {
        case .queued:
            self = .queued
        case .uploading:
            self = .uploading
        case .synced:
            self = .synced
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
        case .uploading:
            try container.encode(StateType.uploading, forKey: .type)
        case .synced:
            try container.encode(StateType.synced, forKey: .type)
        case .failed(let error):
            try container.encode(StateType.failed, forKey: .type)
            try container.encode(error, forKey: .error)
        }
    }
}

enum UploadError: LocalizedError {
    case noAuthToken
    case invalidURL
    case uploadFailed(String)
    
    var errorDescription: String? {
        switch self {
        case .noAuthToken:
            return "No authentication token available"
        case .invalidURL:
            return "Invalid upload URL"
        case .uploadFailed(let message):
            return "Upload failed: \(message)"
        }
    }
}
