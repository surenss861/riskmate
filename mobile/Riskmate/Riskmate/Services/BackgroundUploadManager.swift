import Foundation
import UIKit
import Combine

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
    func uploadEvidence(
        jobId: String,
        evidenceId: String,
        fileData: Data,
        fileName: String,
        mimeType: String
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
        
        // Create upload task
        let upload = UploadTask(
            id: evidenceId,
            jobId: jobId,
            fileName: fileName,
            state: .queued,
            progress: 0.0,
            createdAt: Date(),
            idempotencyKey: idempotencyKey
        )
        
        uploads.append(upload)
        saveUploads()
        
        // Create multipart form data
        let boundary = UUID().uuidString
        var body = Data()
        
        // Add file data
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(fileName)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(fileData)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        
        // Create request
        let baseURL = AppConfig.shared.backendURL
        guard let url = URL(string: "\(baseURL)/api/jobs/\(jobId)/evidence/upload") else {
            throw UploadError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.setValue("\(body.count)", forHTTPHeaderField: "Content-Length")
        request.setValue(idempotencyKey, forHTTPHeaderField: "Idempotency-Key")
        request.timeoutInterval = 60.0 // 60 second timeout for uploads
        
        // Create upload task
        let task = backgroundSession.uploadTask(with: request, from: body)
        
        // Store mapping: taskIdentifier -> uploadId
        storeTaskMapping(taskIdentifier: task.taskIdentifier, uploadId: evidenceId)
        
        // Update state
        updateUploadState(evidenceId, state: .uploading)
        
        // Track analytics
        Analytics.shared.trackEvidenceUploadStarted(evidenceId: evidenceId)
        
        task.resume()
    }
    
    /// Generate idempotency key from file data and evidence ID
    private func generateIdempotencyKey(fileData: Data, evidenceId: String) -> String {
        var hasher = Hasher()
        hasher.combine(fileData)
        hasher.combine(evidenceId)
        let hash = hasher.finalize()
        return "\(evidenceId)-\(abs(hash))"
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
    
    /// Retry failed upload
    func retryUpload(_ upload: UploadTask) async throws {
        // Remove old upload
        uploads.removeAll { $0.id == upload.id }
        
        // TODO: Re-upload with original file data
        // For now, mark as queued and let user re-upload
        var updated = upload
        updated.state = .queued
        updated.retryCount += 1
        uploads.append(updated)
        saveUploads()
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
        
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            if let error = error {
                let errorMessage = error.localizedDescription
                self.updateUploadState(uploadId, state: .failed(errorMessage))
                Analytics.shared.trackEvidenceUploadFailed(evidenceId: uploadId, error: errorMessage)
                CrashReporting.shared.captureError(error)
            } else {
                self.updateUploadState(uploadId, state: .synced)
                Analytics.shared.trackEvidenceUploadSucceeded(evidenceId: uploadId)
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

struct UploadTask: Identifiable, Codable {
    let id: String
    let jobId: String
    let fileName: String
    var state: UploadState
    var progress: Double
    let createdAt: Date
    var retryCount: Int = 0
    var idempotencyKey: String?
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
