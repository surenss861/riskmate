import express, { type Request, type Response, type Router as ExpressRouter } from "express";
import { supabase } from "../lib/supabaseClient";

/**
 * Resend webhook handler for email events (e.g. bounce).
 * Configure the webhook URL in Resend dashboard to point at POST /api/webhooks/resend.
 * Optional: set RESEND_WEBHOOK_SECRET and verify svix-signature for production.
 */
export const resendWebhookRouter: ExpressRouter = express.Router();

interface ResendWebhookPayload {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string | string[];
    from?: string;
    subject?: string;
    bounce?: { message?: string; type?: string; subType?: string };
  };
}

resendWebhookRouter.post("/", express.json(), async (req: Request, res: Response) => {
  try {
    const payload = req.body as ResendWebhookPayload;
    if (!payload || typeof payload.type !== "string") {
      return res.status(400).json({ message: "Invalid webhook payload" });
    }

    if (payload.type === "email.bounced" && payload.data) {
      const emailId = payload.data.email_id;
      const toRaw = payload.data.to;
      const recipient = Array.isArray(toRaw)
        ? toRaw[0]
        : typeof toRaw === "string"
          ? toRaw
          : "";

      let foundExisting = false;
      if (emailId) {
        const { data: updated, error: updateError } = await supabase
          .from("email_logs")
          .update({
            status: "bounced",
            error_message: payload.data.bounce?.message ?? null,
          })
          .eq("provider_message_id", emailId)
          .select("id")
          .maybeSingle();

        if (!updateError && updated) {
          foundExisting = true;
          console.info("[ResendWebhook] Marked email_logs as bounced", {
            provider_message_id: emailId,
            log_id: updated.id,
          });
        }
      }

      if (!foundExisting && (recipient || emailId)) {
        await supabase.from("email_logs").insert({
          type: "transactional",
          recipient: recipient || "unknown",
          status: "bounced",
          queue_id: null,
          job_id: null,
          user_id: null,
          error_message: payload.data.bounce?.message ?? null,
          provider_message_id: emailId ?? null,
        });
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("[ResendWebhook] Error:", err);
    res.status(500).json({ message: "Webhook processing failed" });
  }
});
