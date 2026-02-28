/**
 * Internal endpoints for server-to-server calls (e.g. Next.js → backend).
 * Require X-Internal-Secret header matching INTERNAL_API_KEY.
 * When INTERNAL_API_KEY is unset, returns 503 so the endpoint is not usable (no passthrough).
 */
import { type Router as ExpressRouter } from 'express';
export declare const internalRouter: ExpressRouter;
//# sourceMappingURL=internal.d.ts.map