/**
 * Retention and Cleanup Worker
 *
 * Handles:
 * - Export artifact retention (per plan tier)
 * - Failed/canceled export cleanup
 * - Orphaned evidence blob cleanup
 * - Storage lifecycle management
 */
/**
 * Start the retention worker
 */
export declare function startRetentionWorker(): void;
/**
 * Stop the retention worker
 */
export declare function stopRetentionWorker(): void;
//# sourceMappingURL=retentionWorker.d.ts.map