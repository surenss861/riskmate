"use strict";
/**
 * Billing Monitoring (Backend)
 *
 * Helper functions to track webhook failures and create billing alerts.
 * Backend version for Express.js routes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackWebhookFailure = trackWebhookFailure;
const supabaseClient_1 = require("../lib/supabaseClient");
/**
 * Track webhook failure
 *
 * Call this when a webhook handler returns 4xx/5xx
 */
async function trackWebhookFailure(eventType, stripeEventId, error, metadata) {
    try {
        // Use service role client (bypasses RLS)
        const { data, error: insertError } = await supabaseClient_1.supabase
            .from("billing_alerts")
            .insert({
            alert_type: "webhook_failure",
            severity: "critical",
            message: `Webhook failure: ${eventType} (${stripeEventId})`,
            metadata: {
                event_type: eventType,
                stripe_event_id: stripeEventId,
                error,
                ...metadata,
            },
        })
            .select()
            .single();
        if (insertError) {
            console.error("[BillingMonitoring] Failed to insert webhook failure alert:", insertError);
        }
        else {
            console.error("[BillingMonitoring] Webhook failure tracked", {
                event_type: eventType,
                stripe_event_id: stripeEventId,
                error,
                alert_id: data?.id,
            });
        }
    }
    catch (err) {
        // Silent fail - monitoring is non-critical
        console.warn("[BillingMonitoring] Failed to track webhook failure:", err?.message);
    }
}
//# sourceMappingURL=billingMonitoring.js.map