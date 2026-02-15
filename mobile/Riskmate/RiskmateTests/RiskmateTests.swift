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
}
