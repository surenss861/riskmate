/**
 * Async Export Worker
 * Processes queued exports from the exports table
 *
 * This worker:
 * - Claims exports with state='queued' using FOR UPDATE SKIP LOCKED
 * - Generates PDFs/ZIPs + manifest.json
 * - Uploads to Supabase Storage
 * - Updates state to 'ready' or 'failed'
 * - Writes ledger events
 */
/**
 * Start the export worker
 */
export declare function startExportWorker(): void;
/**
 * Stop the export worker
 */
export declare function stopExportWorker(): void;
//# sourceMappingURL=exportWorker.d.ts.map