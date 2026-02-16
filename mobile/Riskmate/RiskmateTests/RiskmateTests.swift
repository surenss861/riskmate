//
//  RiskmateTests.swift
//  RiskmateTests
//
//  Created by suren sureshkumar on 2026-01-14.
//

import Testing
@testable import Riskmate

struct RiskmateTests {

    @Test func example() async throws {
        // Write your test here and use APIs like `#expect(...)` to check expected conditions.
    }

    // MARK: - Offline Sync Acceptance Tests

    @Test func operationTypeBackendRawValues() async throws {
        // Verify OperationType apiTypeString matches backend API expectations (create_job, update_job, etc.)
        #expect(OperationType.createJob.apiTypeString == "create_job")
        #expect(OperationType.updateJob.apiTypeString == "update_job")
        #expect(OperationType.deleteJob.apiTypeString == "delete_job")
        #expect(OperationType.createHazard.apiTypeString == "create_hazard")
        #expect(OperationType.createControl.apiTypeString == "create_control")
    }

    @Test func syncOperationEncodesForBatchRequest() async throws {
        let op = SyncOperation(
            type: .createJob,
            entityId: "test-id",
            data: "{\"client_name\":\"Test\"}".data(using: .utf8)!,
            clientTimestamp: Date()
        )
        let batchItem = op.toBatchRequestItem()
        #expect(batchItem["type"] as? String == "create_job")
        #expect(batchItem["entity_id"] as? String == "test-id")
        let data = batchItem["data"] as? [String: Any]
        #expect(data?["client_name"] as? String == "Test")
    }

    // MARK: - Hazard/Control Conflict Merge Tests

    @Test func hazardConflictMergePreservesServerFields() async throws {
        let local: [String: Any] = [
            "id": "temp-hazard-1",
            "name": "Local Hazard",
            "description": "Local only",
            "severity": "low",
        ]
        let serverValue: [String: Any] = [
            "id": "server-hazard-1",
            "name": "Server Hazard",
            "description": "Server description",
            "updated_at": "2025-01-15T12:00:00Z",
        ]
        let merged = SyncConflictMerge.mergeHazardControlPayload(
            localDict: local,
            serverValue: serverValue,
            conflictField: nil
        )
        #expect(merged["name"] as? String == "Server Hazard")
        #expect(merged["description"] as? String == "Server description")
        #expect(merged["updated_at"] as? String == "2025-01-15T12:00:00Z")
        #expect(merged["severity"] as? String == "low")
    }

    @Test func controlConflictMergePreservesServerData() async throws {
        let local: [String: Any] = [
            "id": "temp-control-1",
            "title": "Local Control",
            "description": "Local desc",
        ]
        let serverValue: [String: Any] = [
            "id": "server-control-1",
            "title": "Server Control",
            "done": true,
            "isCompleted": true,
        ]
        let merged = SyncConflictMerge.mergeHazardControlPayload(
            localDict: local,
            serverValue: serverValue,
            conflictField: nil
        )
        #expect(merged["title"] as? String == "Server Control")
        #expect(merged["done"] as? Bool == true)
        #expect(merged["isCompleted"] as? Bool == true)
        #expect(merged["description"] as? String == "Local desc")
    }

    @Test func hazardConflictMergeDoesNotDropServerData() async throws {
        let local: [String: Any] = ["id": "temp-1", "name": "A"]
        let serverValue: [String: Any] = ["id": "srv-1", "name": "B", "extra": "server-only"]
        let merged = SyncConflictMerge.mergeHazardControlPayload(
            localDict: local,
            serverValue: serverValue,
            conflictField: nil
        )
        #expect(merged["extra"] as? String == "server-only")
        #expect(merged["name"] as? String == "B")
    }

    // MARK: - Auto Strategy Selection Tests (ticket-required)

    @Test func autoStrategyJobStatusReturnsServerWins() async throws {
        let strategy = SyncConflictMerge.autoStrategyForConflict(entityType: "job", field: "status")
        #expect(strategy == .serverWins)
    }

    @Test func autoStrategyJobDetailsReturnsLocalWins() async throws {
        for field in ["client_name", "clientName", "description", "address", "site_id", "siteId", "updated_at", "updatedAt"] {
            let strategy = SyncConflictMerge.autoStrategyForConflict(entityType: "job", field: field)
            #expect(strategy == .localWins, "Expected localWins for field \(field)")
        }
    }

    @Test func autoStrategyHazardControlReturnsMerge() async throws {
        #expect(SyncConflictMerge.autoStrategyForConflict(entityType: "hazard", field: "name") == .merge)
        #expect(SyncConflictMerge.autoStrategyForConflict(entityType: "control", field: "title") == .merge)
    }

    @Test func autoStrategyEvidencePhotoReturnsAskUser() async throws {
        #expect(SyncConflictMerge.autoStrategyForConflict(entityType: "evidence", field: "url") == nil)
        #expect(SyncConflictMerge.autoStrategyForConflict(entityType: "job", field: "photo_deleted") == nil)
        #expect(SyncConflictMerge.autoStrategyForConflict(entityType: "job", field: "evidence_id") == nil)
    }

    // MARK: - Hazard Dual-Add Merge Tests (merged payload)

    @Test func hazardDualAddMergeProducesMergedPayload() async throws {
        let local: [String: Any] = [
            "id": "temp-hazard-1",
            "job_id": "job-1",
            "name": "Local Added Hazard",
            "severity": "high",
        ]
        let serverValue: [String: Any] = [
            "id": "server-hazard-1",
            "name": "Server Added Hazard",
            "description": "Server description",
            "updated_at": "2025-01-15T12:00:00Z",
        ]
        let merged = SyncConflictMerge.mergeHazardControlPayload(
            localDict: local,
            serverValue: serverValue,
            conflictField: "name"
        )
        #expect(merged["name"] as? String == "Server Added Hazard")
        #expect(merged["description"] as? String == "Server description")
        #expect(merged["severity"] as? String == "high")
        #expect(merged["job_id"] as? String == "job-1")
    }

    // MARK: - Conflict Modal / Resolution Tests

    @Test func syncConflictShowsServerLocalValues() async throws {
        let conflict = SyncConflict(
            entityType: "job",
            entityId: "job-1",
            field: "status",
            serverValue: "in_progress" as AnyHashable,
            localValue: "completed" as AnyHashable,
            serverTimestamp: Date().addingTimeInterval(-3600),
            localTimestamp: Date()
        )
        #expect(conflict.serverValueDisplay == "in_progress")
        #expect(conflict.localValueDisplay == "completed")
        #expect(conflict.field == "status")
    }

    @Test func conflictResolutionOutcomeAppliesMergeStrategy() async throws {
        let perField: [String: Any] = ["name": "Merged Name"]
        let outcome = ConflictResolutionOutcome(strategy: .merge, perFieldResolvedValues: perField)
        #expect(outcome.strategy == .merge)
        #expect(outcome.perFieldResolvedValues?["name"] as? String == "Merged Name")
    }

    @Test func conflictResolutionOutcomeAppliesChosenStrategy() async throws {
        let serverOutcome = ConflictResolutionOutcome(strategy: .serverWins, perFieldResolvedValues: nil)
        let localOutcome = ConflictResolutionOutcome(strategy: .localWins, perFieldResolvedValues: nil)
        #expect(serverOutcome.strategy == .serverWins)
        #expect(localOutcome.strategy == .localWins)
    }

    @Test func conflictResolutionStrategyRawValuesMatchAPI() async throws {
        #expect(ConflictResolutionStrategy.serverWins.rawValue == "server_wins")
        #expect(ConflictResolutionStrategy.localWins.rawValue == "local_wins")
        #expect(ConflictResolutionStrategy.merge.rawValue == "merge")
        #expect(ConflictResolutionStrategy.askUser.rawValue == "ask_user")
    }
}
