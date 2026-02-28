/**
 * Internal webhook emit: called by backend when it creates/updates resources.
 * POST /api/webhooks/emit { organization_id, event_type, data }
 * Requires internal credential (WEBHOOK_EMIT_SECRET); not callable by standard end-user JWTs.
 */
import { type Router as ExpressRouter } from 'express';
export declare const webhooksRouter: ExpressRouter;
//# sourceMappingURL=webhooks.d.ts.map