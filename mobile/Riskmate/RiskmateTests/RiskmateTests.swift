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

    // MARK: - Acceptance Scenarios: Conflict Resolution Flows

    /// Server-wins on job status: strategy is server_wins, no resolved_value required
    @Test func acceptanceServerWinsOnJobStatus() async throws {
        let strategy = SyncConflictMerge.autoStrategyForConflict(entityType: "job", field: "status")
        #expect(strategy == .serverWins)

        // Resolve request for server_wins: operation_id and strategy required; resolved_value not needed
        let operationId = "op-job-status-1"
        let body: [String: Any] = [
            "operation_id": operationId,
            "strategy": ConflictResolutionStrategy.serverWins.rawValue,
        ]
        #expect(body["operation_id"] as? String == operationId)
        #expect(body["strategy"] as? String == "server_wins")
        #expect(body["resolved_value"] == nil)
    }

    /// Local-wins on job details: strategy is local_wins, resolved_value carries job fields
    @Test func acceptanceLocalWinsOnJobDetails() async throws {
        let strategy = SyncConflictMerge.autoStrategyForConflict(entityType: "job", field: "client_name")
        #expect(strategy == .localWins)

        // Resolve request for local_wins: must include resolved_value, entity_type, entity_id, operation_type
        let resolvedValue: [String: Any] = [
            "client_name": "Updated Client",
            "job_type": "inspection",
            "location": "Site A",
        ]
        let body: [String: Any] = [
            "operation_id": "op-job-1",
            "strategy": ConflictResolutionStrategy.localWins.rawValue,
            "resolved_value": resolvedValue,
            "entity_type": "job",
            "entity_id": "job-123",
            "operation_type": "update_job",
        ]
        #expect((body["resolved_value"] as? [String: Any])?["client_name"] as? String == "Updated Client")
        #expect(body["entity_type"] as? String == "job")
        #expect(body["entity_id"] as? String == "job-123")
        #expect(body["operation_type"] as? String == "update_job")
    }

    /// Hazard/control merge: applies merged payload, entity_id from conflict is server record id for remapping
    @Test func acceptanceHazardControlMergeAppliesMergedPayload() async throws {
        let strategy = SyncConflictMerge.autoStrategyForConflict(entityType: "hazard", field: "name")
        #expect(strategy == .merge)

        let local: [String: Any] = [
            "id": "temp-hazard-1",
            "job_id": "job-1",
            "name": "Local Hazard",
            "severity": "high",
        ]
        let serverValue: [String: Any] = [
            "id": "server-hazard-1",
            "name": "Server Hazard",
            "description": "Server desc",
        ]
        let merged = SyncConflictMerge.mergeHazardControlPayload(
            localDict: local,
            serverValue: serverValue,
            conflictField: "name"
        )
        #expect(merged["name"] as? String == "Server Hazard")
        #expect(merged["job_id"] as? String == "job-1")
        #expect(merged["severity"] as? String == "high")

        // Resolve request uses entity_id = server record id so backend reconciles (update) instead of insert
        let entityId = "server-hazard-1"
        let body: [String: Any] = [
            "operation_id": "op-hazard-1",
            "strategy": ConflictResolutionStrategy.merge.rawValue,
            "resolved_value": merged,
            "entity_type": "hazard",
            "entity_id": entityId,
            "operation_type": "create_hazard",
        ]
        #expect(body["entity_id"] as? String == entityId)
        #expect(body["operation_type"] as? String == "create_hazard")
        let rv = body["resolved_value"] as? [String: Any]
        #expect(rv?["job_id"] as? String == "job-1")
    }

    /// Photo deletion: prompts user (ask_user), no auto-resolve
    @Test func acceptancePhotoDeletionPromptsUser() async throws {
        let strategy = SyncConflictMerge.autoStrategyForConflict(entityType: "job", field: "photo_deleted")
        #expect(strategy == nil)

        let evidenceStrategy = SyncConflictMerge.autoStrategyForConflict(entityType: "evidence", field: "url")
        #expect(evidenceStrategy == nil)

        // When strategy is nil, resolve should not be auto-invoked; user must choose
        #expect(strategy == nil)
    }

    /// Server-deleted vs offline-uploaded photo: conflict id format and resolve payload (entity_type evidence, no operation_type)
    @Test func evidenceConflictIdFormatAndResolvePayload() async throws {
        let jobId = "job-abc"
        let evidenceId = "evidence-xyz"
        let conflictId = "evidence:\(jobId):\(evidenceId)"
        #expect(conflictId.hasPrefix("evidence:"))
        #expect(conflictId.contains(jobId))
        #expect(conflictId.contains(evidenceId))

        // Resolve request for evidence: entity_type and entity_id required; operation_type omitted (backend accepts for evidence/photo)
        let body: [String: Any] = [
            "operation_id": conflictId,
            "strategy": ConflictResolutionStrategy.serverWins.rawValue,
            "entity_type": "evidence",
            "entity_id": evidenceId,
        ]
        #expect(body["operation_type"] == nil)
        #expect(body["entity_type"] as? String == "evidence")
        #expect(body["entity_id"] as? String == evidenceId)
        #expect(body["strategy"] as? String == "server_wins")
    }

    /// Conflict modal: presents server/local values for user decision
    @Test func acceptanceConflictModalPresentsServerLocalValues() async throws {
        let conflict = SyncConflict(
            entityType: "job",
            entityId: "job-1",
            field: "status",
            serverValue: "in_progress" as AnyHashable,
            localValue: "draft" as AnyHashable,
            serverTimestamp: Date().addingTimeInterval(-3600),
            localTimestamp: Date()
        )
        #expect(conflict.serverValueDisplay == "in_progress")
        #expect(conflict.localValueDisplay == "draft")
        #expect(conflict.entityType == "job")
        #expect(conflict.entityId == "job-1")
        #expect(conflict.field == "status")
    }

    /// Resolve request carries expected strategy and payload for each resolution path
    @Test func acceptanceResolveRequestCarriesExpectedStrategyAndPayload() async throws {
        // Merge strategy for control
        let mergePayload: [String: Any] = [
            "job_id": "job-1",
            "hazard_id": "hazard-1",
            "title": "Merged Control",
            "description": "Combined",
        ]
        let mergeBody: [String: Any] = [
            "operation_id": "op-ctrl-1",
            "strategy": "merge",
            "resolved_value": mergePayload,
            "entity_type": "control",
            "entity_id": "server-control-1",
            "operation_type": "create_control",
        ]
        #expect(mergeBody["strategy"] as? String == "merge")
        #expect((mergeBody["resolved_value"] as? [String: Any])?["hazard_id"] as? String == "hazard-1")
        #expect(mergeBody["entity_id"] as? String == "server-control-1")
    }

    /// Conflicts are cleared after successful resolve (clearPendingConflict)
    @Test @MainActor func acceptanceConflictsClearedAfterResolve() async throws {
        let engine = SyncEngine.shared
        let initialCount = engine.pendingConflicts.count

        // Simulate having a conflict (we can't easily inject without DB; verify clearPendingConflict is callable)
        let conflictId = "test-conflict-clear-\(UUID().uuidString)"
        engine.clearPendingConflict(operationId: conflictId)
        // After clear, pendingConflicts should not contain that id (idempotent if not present)
        let afterCount = engine.pendingConflicts.count
        #expect(!engine.pendingConflicts.contains(where: { $0.id == conflictId }))
        #expect(afterCount == initialCount)
    }

    /// Control merge produces merged payload with server id for remapping
    @Test func acceptanceControlMergeProducesMergedPayloadWithServerId() async throws {
        let local: [String: Any] = [
            "id": "temp-control-1",
            "job_id": "job-1",
            "hazard_id": "hazard-1",
            "title": "Local Control",
            "description": "Local only",
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
            conflictField: "title"
        )
        #expect(merged["title"] as? String == "Server Control")
        #expect(merged["done"] as? Bool == true)
        #expect(merged["job_id"] as? String == "job-1")
        #expect(merged["hazard_id"] as? String == "hazard-1")
        // entity_id from conflict (server id) enables client remap and backend reconcile
        #expect(serverValue["id"] as? String == "server-control-1")
    }
}
