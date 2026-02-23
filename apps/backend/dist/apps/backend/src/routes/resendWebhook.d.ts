import { type Router as ExpressRouter } from "express";
/**
 * Resend webhook handler for email events (e.g. bounce).
 * Configure the webhook URL in Resend dashboard to point at POST /api/webhooks/resend.
 * Optional: set RESEND_WEBHOOK_SECRET and verify svix-signature for production.
 */
export declare const resendWebhookRouter: ExpressRouter;
//# sourceMappingURL=resendWebhook.d.ts.map