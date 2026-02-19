/**
 * Test Data Helper
 *
 * Creates and cleans up test data for integration tests
 * Uses a dedicated test organization to isolate test data
 *
 * Usage:
 *   const testData = await setupTestData();
 *   // Use testData.ownerToken, testData.auditorToken, etc.
 *   await cleanupTestData(testData.testOrgId);
 */
export interface TestData {
    testOrgId: string;
    ownerUserId: string;
    auditorUserId: string;
    executiveUserId: string;
    adminUserId?: string;
    adminToken?: string;
    ownerToken: string;
    auditorToken: string;
    executiveToken: string;
    testJobId: string;
    ownerEmail: string;
    auditorEmail: string;
    executiveEmail: string;
}
/**
 * Creates a test organization and users
 * Returns tokens and IDs for testing
 */
export declare function setupTestData(): Promise<TestData>;
/**
 * Cleans up test data for a test organization
 * Deletes in order to respect foreign key constraints
 */
export declare function cleanupTestData(testOrgId: string): Promise<void>;
//# sourceMappingURL=testData.d.ts.map