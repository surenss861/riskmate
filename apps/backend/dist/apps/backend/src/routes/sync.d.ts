/**
 * Sync API - Batch upload, incremental download, conflict resolution for offline-first iOS
 * POST /api/sync/batch - Upload pending operations
 * GET /api/sync/changes?since={timestamp} - Incremental sync
 * POST /api/sync/resolve-conflict - Submit conflict resolution
 */
import { type Router as ExpressRouter } from "express";
export declare const syncRouter: ExpressRouter;
//# sourceMappingURL=sync.d.ts.map