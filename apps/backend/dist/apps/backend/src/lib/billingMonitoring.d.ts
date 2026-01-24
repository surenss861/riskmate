/**
 * Billing Monitoring (Backend)
 *
 * Helper functions to track webhook failures and create billing alerts.
 * Backend version for Express.js routes.
 */
/**
 * Track webhook failure
 *
 * Call this when a webhook handler returns 4xx/5xx
 */
export declare function trackWebhookFailure(eventType: string, stripeEventId: string, error: string, metadata?: Record<string, any>): Promise<void>;
//# sourceMappingURL=billingMonitoring.d.ts.map