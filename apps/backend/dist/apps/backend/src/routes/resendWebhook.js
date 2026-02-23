"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resendWebhookRouter = void 0;
const express_1 = __importDefault(require("express"));
const supabaseClient_1 = require("../lib/supabaseClient");
/**
 * Resend webhook handler for email events (e.g. bounce).
 * Configure the webhook URL in Resend dashboard to point at POST /api/webhooks/resend.
 * Optional: set RESEND_WEBHOOK_SECRET and verify svix-signature for production.
 */
exports.resendWebhookRouter = express_1.default.Router();
exports.resendWebhookRouter.post("/", express_1.default.json(), async (req, res) => {
    try {
        const payload = req.body;
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
                const { data: updated, error: updateError } = await supabaseClient_1.supabase
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
                await supabaseClient_1.supabase.from("email_logs").insert({
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
    }
    catch (err) {
        console.error("[ResendWebhook] Error:", err);
        res.status(500).json({ message: "Webhook processing failed" });
    }
});
//# sourceMappingURL=resendWebhook.js.map