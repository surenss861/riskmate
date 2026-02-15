import Foundation
import Combine

/// Shared store for jobs data - single source of truth with single-flight loading
/// Features: local cache-first, pagination, event-driven refresh
@MainActor
final class JobsStore: ObservableObject {
    static let shared = JobsStore()

    @Published private(set) var jobs: [Job] = []
    @Published private(set) var pendingJobIds: Set<String> = []
    @Published private(set) var isLoading: Bool = false
    @Published private(set) var isLoadingMore: Bool = false
    @Published private(set) var lastSyncDate: Date?
    @Published private(set) var hasMore: Bool = true
    @Published var errorMessage: String?

    private var fetchTask: Task<[Job], Error>?
    private var currentPage: Int = 1
    private let pageSize: Int = 25
    private var isInitialLoad: Bool = true
    private var syncQueueObserver: NSObjectProtocol?

    private init() {
        // Load from cache immediately for instant launch
        loadFromCache()
        syncQueueObserver = NotificationCenter.default.addObserver(
            forName: OfflineDatabase.syncQueueDidChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.refreshPendingJobIds()
            }
        }
    }

    /// Load jobs from local cache + merge pending offline jobs
    private func loadFromCache() {
        var all: [Job] = []
        if let cached = OfflineCache.shared.getCachedJobs(), !cached.isEmpty {
            all = cached
            print("[JobsStore] ✅ Loaded \(cached.count) jobs from cache")
        }
        // Merge pending offline jobs (created while offline)
        let pendingIds = Set(all.map { $0.id })
        for row in OfflineDatabase.shared.getPendingJobs() {
            if let job = try? JSONDecoder().decode(Job.self, from: row.data), !pendingIds.contains(job.id) {
                all.insert(job, at: 0)
            }
        }
        if all != self.jobs {
            self.jobs = all
        }
        refreshPendingJobIds()
    }

    /// Refresh combined pending set: created-offline jobs + jobs with pending updates
    private func refreshPendingJobIds() {
        let created = Set(OfflineDatabase.shared.getPendingJobs().map { $0.id })
        let withUpdates = OfflineDatabase.shared.getJobIdsWithPendingUpdates()
        pendingJobIds = created.union(withUpdates)
    }

    /// Initial fetch: cache-first, then refresh in background
    /// Returns cached data immediately, then updates when network responds
    func fetch(forceRefresh: Bool = false) async throws -> [Job] {
        // If we have cache and not forcing refresh, return cache immediately
        if !forceRefresh, !jobs.isEmpty, isInitialLoad {
            isInitialLoad = false
            // Return cached, then refresh in background
            Task {
                await refreshInBackground()
            }
            return jobs
        }

        // Single-flight: if already fetching, wait
        if let task = fetchTask {
            return try await task.value
        }

        isLoading = true
        errorMessage = nil
        currentPage = 1

        let task = Task { () throws -> [Job] in
            let resp = try await APIClient.shared.getJobs(page: currentPage, limit: pageSize)
            return resp.data
        }

        fetchTask = task

        do {
            let result = try await task.value
            self.jobs = result
            self.currentPage = 1
            self.hasMore = result.count >= pageSize // If we got full page, might have more
            self.lastSyncDate = Date()
            self.isInitialLoad = false
            
            // Cache for next launch
            OfflineCache.shared.cacheJobs(result)
            
            self.fetchTask = nil
            self.isLoading = false
            return result
        } catch {
            self.fetchTask = nil
            self.isLoading = false
            self.errorMessage = error.localizedDescription
            throw error
        }
    }

    /// Load next page (pagination)
    func loadMore() async throws {
        guard !isLoadingMore, hasMore else { return }
        
        isLoadingMore = true
        let nextPage = currentPage + 1
        
        do {
            let resp = try await APIClient.shared.getJobs(page: nextPage, limit: pageSize)
            let newJobs = resp.data
            
            if newJobs.isEmpty {
                hasMore = false
            } else {
                // Append to existing jobs
                jobs.append(contentsOf: newJobs)
                currentPage = nextPage
                hasMore = newJobs.count >= pageSize
                
                // Update cache
                OfflineCache.shared.cacheJobs(jobs)
            }
            
            isLoadingMore = false
        } catch {
            isLoadingMore = false
            errorMessage = error.localizedDescription
            throw error
        }
    }

    /// Background refresh (doesn't block UI)
    private func refreshInBackground() async {
        do {
            let resp = try await APIClient.shared.getJobs(page: 1, limit: pageSize)
            let freshJobs = resp.data
            
            // Only update if we got data (don't clear on network error)
            if !freshJobs.isEmpty {
                self.jobs = freshJobs
                self.currentPage = 1
                self.hasMore = freshJobs.count >= pageSize
                self.lastSyncDate = Date()
                
                // Update cache
                OfflineCache.shared.cacheJobs(freshJobs)
                
                print("[JobsStore] ✅ Background refresh: \(freshJobs.count) jobs")
            }
        } catch {
            // Silent fail for background refresh (don't show error)
            print("[JobsStore] ⚠️ Background refresh failed: \(error.localizedDescription)")
        }
    }

    /// Event-driven refresh: called when push signal received
    /// Only refreshes if the event affects jobs list
    func refreshOnEvent(eventType: String, entityId: String? = nil) async {
        // Only refresh if event is job-related
        guard eventType.contains("job") || eventType == "evidence.uploaded" else {
            return
        }
        
        print("[JobsStore] 🔔 Event received: \(eventType), refreshing...")
        
        // Light refresh: just page 1 (don't reload all pages)
        do {
            let resp = try await APIClient.shared.getJobs(page: 1, limit: pageSize)
            let freshJobs = resp.data
            
            if !freshJobs.isEmpty {
                // Merge with existing (keep paginated results)
                // If job was updated, it should be in page 1
                let existingIds = Set(jobs.map { $0.id })
                _ = Set(freshJobs.map { $0.id }) // Track fresh IDs for potential future use
                
                // Update existing jobs, add new ones
                var updated = jobs
                for freshJob in freshJobs {
                    if let index = updated.firstIndex(where: { $0.id == freshJob.id }) {
                        updated[index] = freshJob // Update existing
                    } else if !existingIds.contains(freshJob.id) {
                        updated.insert(freshJob, at: 0) // New job at top
                    }
                }
                
                self.jobs = updated
                self.lastSyncDate = Date()
                
                // Update cache
                OfflineCache.shared.cacheJobs(updated)
            }
        } catch {
            print("[JobsStore] ⚠️ Event refresh failed: \(error.localizedDescription)")
        }
    }

    /// Update single job (optimistic update)
    func updateJob(_ job: Job) {
        if let index = jobs.firstIndex(where: { $0.id == job.id }) {
            jobs[index] = job
            OfflineCache.shared.cacheJobs(jobs)
        }
    }

    /// Add new job (optimistic update)
    func addJob(_ job: Job) {
        jobs.insert(job, at: 0)
        OfflineCache.shared.cacheJobs(jobs)
    }

    /// Remove job from list (e.g. after successful delete sync)
    func removeJob(id: String) {
        jobs.removeAll { $0.id == id }
        pendingJobIds = pendingJobIds.filter { $0 != id }
        OfflineCache.shared.cacheJobs(jobs)
    }

    /// Remap temp-id job to server id after successful create sync
    func remapJob(from tempId: String, to serverId: String, jobData: Data?) {
        guard let data = jobData,
              let job = try? JSONDecoder().decode(Job.self, from: data) else {
            removeJob(id: tempId)
            return
        }
        jobs.removeAll { $0.id == tempId }
        pendingJobIds = pendingJobIds.filter { $0 != tempId }
        let serverJob = Job(
            id: serverId,
            clientName: job.clientName,
            jobType: job.jobType,
            location: job.location,
            status: job.status,
            riskScore: job.riskScore,
            riskLevel: job.riskLevel,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
            createdBy: job.createdBy,
            evidenceCount: job.evidenceCount,
            evidenceRequired: job.evidenceRequired,
            controlsCompleted: job.controlsCompleted,
            controlsTotal: job.controlsTotal
        )
        jobs.insert(serverJob, at: 0)
        OfflineCache.shared.cacheJobs(jobs)
    }

    /// Create job - online: API; offline: save to OfflineDatabase, add to store, queue sync
    func createJob(clientName: String, jobType: String, location: String) async throws -> Job {
        let isOffline = !ServerStatusManager.shared.isOnline
        let now = ISO8601DateFormatter().string(from: Date())
        let jobId = UUID().uuidString
        let job = Job(
            id: jobId,
            clientName: clientName,
            jobType: jobType,
            location: location,
            status: "draft",
            riskScore: nil,
            riskLevel: nil,
            createdAt: now,
            updatedAt: now,
            createdBy: nil,
            evidenceCount: nil,
            evidenceRequired: nil,
            controlsCompleted: nil,
            controlsTotal: nil
        )

        if isOffline {
            SyncEngine.shared.queueCreateJob(job)
            addJob(job)
            pendingJobIds = pendingJobIds.union([jobId])
            OfflineCache.shared.refreshSyncState()
            ToastCenter.shared.show("Saved offline", systemImage: "wifi.slash", style: .info)
            return job
        }

        let created = try await APIClient.shared.createJob(job)
        addJob(created)
        OfflineCache.shared.cacheJobs(jobs)
        return created
    }

    /// Save job changes - online: API; offline: queue update, persist to pending_updates, optimistic UI
    func saveJobUpdate(_ job: Job) async throws {
        let isOffline = !ServerStatusManager.shared.isOnline
        if isOffline {
            SyncEngine.shared.queueUpdateJob(job)
            persistJobEditsToPendingUpdates(job)
            updateJob(job) // optimistic
            OfflineCache.shared.refreshSyncState()
            return
        }
        let updated = try await APIClient.shared.updateJob(job)
        updateJob(updated)
    }

    /// Check if a job has pending updates in the sync queue
    func hasPendingUpdate(jobId: String) -> Bool {
        OfflineDatabase.shared.getSyncQueue().contains { op in
            op.type == .updateJob && op.entityId == jobId
        }
    }

    /// Refresh jobs list including pending offline jobs and pending update badge state
    func refreshPendingJobs() {
        loadFromCache()
    }

    /// Persist edited job fields to pending_updates for offline durability (per ticket requirement)
    private func persistJobEditsToPendingUpdates(_ job: Job) {
        guard let previous = jobs.first(where: { $0.id == job.id }) else { return }
        let timestamp = Date()
        func persistIfChanged(field: String, old: String?, new: String?) {
            let o = old ?? ""
            let n = new ?? ""
            if n != o {
                OfflineDatabase.shared.insertOrUpdatePendingUpdate(
                    entityType: "job",
                    entityId: job.id,
                    field: field,
                    oldValue: old,
                    newValue: n,
                    timestamp: timestamp
                )
            }
        }
        persistIfChanged(field: "client_name", old: previous.clientName, new: job.clientName)
        persistIfChanged(field: "job_type", old: previous.jobType, new: job.jobType)
        persistIfChanged(field: "location", old: previous.location, new: job.location)
        persistIfChanged(field: "status", old: previous.status, new: job.status)
        persistIfChanged(field: "updated_at", old: previous.updatedAt, new: job.updatedAt)
    }

    func clear() {
        jobs = []
        fetchTask = nil
        errorMessage = nil
        isLoading = false
        isLoadingMore = false
        currentPage = 1
        hasMore = true
        isInitialLoad = true
    }
}
