import Foundation
import Combine

/// Shared store for jobs data - single source of truth with single-flight loading
@MainActor
final class JobsStore: ObservableObject {
    static let shared = JobsStore()

    @Published private(set) var jobs: [Job] = []
    @Published private(set) var isLoading: Bool = false
    @Published private(set) var lastSyncDate: Date?
    @Published var errorMessage: String?

    private var fetchTask: Task<[Job], Error>?

    private init() {}

    /// Single-flight fetch. If already fetching, waits. If cached, returns cached unless forceRefresh.
    func fetch(page: Int = 1, limit: Int = 100, forceRefresh: Bool = false) async throws -> [Job] {
        if !forceRefresh, !jobs.isEmpty {
            return jobs
        }

        if let task = fetchTask {
            return try await task.value
        }

        isLoading = true
        errorMessage = nil

        let task = Task { () throws -> [Job] in
            let resp = try await APIClient.shared.getJobs(page: page, limit: limit)
            return resp.data
        }

        fetchTask = task

        do {
            let result = try await task.value
            self.jobs = result
            self.lastSyncDate = Date()
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

    func clear() {
        jobs = []
        fetchTask = nil
        errorMessage = nil
        isLoading = false
    }
}
