/**
 * Billing Monitoring (Backend)
 * 
 * Helper functions to track webhook failures and create billing alerts.
 * Backend version for Express.js routes.
 */

import { supabase } from "../lib/supabaseClient";

/**
 * Track webhook failure
 * 
 * Call this when a webhook handler returns 4xx/5xx
 */
export async function trackWebhookFailure(
  eventType: string,
  stripeEventId: string,
  error: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    // Use service role client (bypasses RLS)
    const { data, error: insertError } = await supabase
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
    } else {
      console.error("[BillingMonitoring] Webhook failure tracked", {
        event_type: eventType,
        stripe_event_id: stripeEventId,
        error,
        alert_id: data?.id,
      });
    }
  } catch (err: any) {
    // Silent fail - monitoring is non-critical
    console.warn("[BillingMonitoring] Failed to track webhook failure:", err?.message);
  }
}
