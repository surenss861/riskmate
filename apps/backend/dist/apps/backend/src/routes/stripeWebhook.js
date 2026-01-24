"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyPlanToOrganization = applyPlanToOrganization;
exports.stripeWebhookHandler = stripeWebhookHandler;
const supabaseClient_1 = require("../lib/supabaseClient");
const planRules_1 = require("../auth/planRules");
const audit_1 = require("../middleware/audit");
const stripeFactory = () => {
    if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error("Missing STRIPE_SECRET_KEY");
    }
    return require("stripe")(process.env.STRIPE_SECRET_KEY);
};
/**
 * Convert Unix timestamp (seconds) to ISO string, or return null if invalid
 * Stripe provides timestamps as Unix seconds (not milliseconds)
 */
function unixToIsoOrNull(value) {
    if (value === null || value === undefined)
        return null;
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n) || n <= 0)
        return null;
    return new Date(n * 1000).toISOString(); // Convert seconds to milliseconds
}
async function applyPlanToOrganization(organizationId, plan, options) {
    // Validate required fields for paid plans
    if (plan !== "starter") {
        if (!options.stripeSubscriptionId) {
            throw new Error(`Missing stripe_subscription_id for ${plan} plan. Cannot create subscription without Stripe subscription ID.`);
        }
        const startIso = unixToIsoOrNull(options.currentPeriodStart);
        const endIso = unixToIsoOrNull(options.currentPeriodEnd);
        if (!startIso || !endIso) {
            throw new Error(`Missing subscription period timestamps from Stripe for ${plan} plan. ` +
                `current_period_start: ${options.currentPeriodStart}, current_period_end: ${options.currentPeriodEnd}. ` +
                `This usually means the subscription object was not fully retrieved from Stripe.`);
        }
    }
    const limits = (0, planRules_1.limitsFor)(plan);
    const rawStatus = options.status?.toLowerCase() ?? "active";
    let status;
    switch (rawStatus) {
        case "trialing":
            status = "trialing";
            break;
        case "past_due":
        case "unpaid":
        case "incomplete":
        case "incomplete_expired":
            status = "past_due";
            break;
        case "canceled":
        case "cancelled":
            status = "canceled";
            break;
        default:
            status = "active";
    }
    const baseSeats = options.seatsLimitOverride ?? limits.seats ?? null;
    const baseJobs = options.jobsLimitOverride ?? limits.jobsMonthly ?? null;
    const isActive = status === "active" || status === "trialing";
    const seatsLimit = isActive ? baseSeats : 0;
    const jobsLimit = isActive ? baseJobs : 0;
    const timestamp = new Date().toISOString();
    // Convert Unix timestamps to ISO strings (safe conversion)
    const periodStartIso = unixToIsoOrNull(options.currentPeriodStart);
    const periodEndIso = unixToIsoOrNull(options.currentPeriodEnd);
    const { error: orgSubError } = await supabaseClient_1.supabase.from("org_subscriptions").upsert({
        organization_id: organizationId,
        plan_code: plan,
        seats_limit: seatsLimit,
        jobs_limit_month: jobsLimit,
        status,
        stripe_customer_id: options.stripeCustomerId ?? null,
        stripe_subscription_id: options.stripeSubscriptionId ?? null,
        current_period_start: periodStartIso,
        current_period_end: periodEndIso,
        updated_at: timestamp,
    }, { onConflict: "organization_id" });
    if (orgSubError) {
        console.error("Failed to upsert org_subscriptions", orgSubError);
        throw new Error(`Failed to update org_subscriptions: ${orgSubError.message}`);
    }
    const { error: orgUpdateError } = await supabaseClient_1.supabase
        .from("organizations")
        .update({
        subscription_tier: plan,
        subscription_status: status,
        updated_at: timestamp,
    })
        .eq("id", organizationId);
    if (orgUpdateError) {
        console.error("Failed to update organizations subscription tier", orgUpdateError);
        throw new Error(`Failed to update organizations: ${orgUpdateError.message}`);
    }
    const subscriptionPayload = {
        organization_id: organizationId,
        tier: plan,
        status,
        stripe_customer_id: options.stripeCustomerId ?? null,
        stripe_subscription_id: options.stripeSubscriptionId ?? null,
        current_period_start: periodStartIso,
        current_period_end: periodEndIso,
        updated_at: timestamp,
    };
    const { error: subsUpsertError } = await supabaseClient_1.supabase
        .from("subscriptions")
        .upsert(subscriptionPayload, { onConflict: "organization_id" });
    if (subsUpsertError) {
        console.error("Failed to upsert subscriptions record", subsUpsertError);
        throw new Error(`Failed to update subscriptions: ${subsUpsertError.message}`);
    }
}
function extractPlanCode(value) {
    if (!value)
        return null;
    if (value === "starter" || value === "pro" || value === "business") {
        return value;
    }
    return null;
}
function extractMetadataPlan(metadata) {
    const plan = metadata?.plan_code ?? metadata?.plan ?? null;
    const organizationId = metadata?.organization_id ?? null;
    const userId = metadata?.user_id ?? null;
    return { plan: extractPlanCode(plan || undefined), organizationId, userId };
}
async function stripeWebhookHandler(req, res) {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
        console.error("Missing STRIPE_WEBHOOK_SECRET");
        return res.status(500).json({ message: "Stripe webhook not configured" });
    }
    let stripe;
    try {
        stripe = stripeFactory();
    }
    catch (err) {
        console.error("Failed to init Stripe:", err?.message);
        return res.status(500).json({ message: "Stripe not configured" });
    }
    const signature = req.headers["stripe-signature"];
    if (!signature) {
        return res.status(400).send("Missing stripe-signature header");
    }
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    }
    catch (err) {
        console.error("Stripe webhook signature verification failed:", err?.message);
        // Track webhook failure
        try {
            const { trackWebhookFailure } = await Promise.resolve().then(() => __importStar(require("../lib/billingMonitoring")));
            await trackWebhookFailure("unknown", // Event type unknown due to signature failure
            "unknown", // Stripe event ID unknown
            `Signature verification failed: ${err?.message}`, {
                status_code: 400,
                error_type: "signature_verification_failed",
            });
        }
        catch (trackErr) {
            // Non-critical - log but don't fail
            console.warn("Failed to track webhook failure:", trackErr);
        }
        return res.status(400).send(`Webhook Error: ${err?.message}`);
    }
    // Idempotency check: skip if already processed
    const { data: existingEvent } = await supabaseClient_1.supabase
        .from("stripe_webhook_events")
        .select("id, processed_at")
        .eq("stripe_event_id", event.id)
        .maybeSingle();
    if (existingEvent) {
        // Already processed, return success (idempotent)
        console.log(`Stripe event ${event.id} already processed at ${existingEvent.processed_at}`);
        return res.json({ received: true, skipped: true });
    }
    // Record event as processing
    // Extract organization_id from event metadata if available
    let organizationId = null;
    if (event.data?.object?.metadata?.organization_id) {
        organizationId = event.data.object.metadata.organization_id;
    }
    else if (event.data?.object?.client_reference_id) {
        organizationId = event.data.object.client_reference_id;
    }
    const { error: insertError } = await supabaseClient_1.supabase
        .from("stripe_webhook_events")
        .insert({
        stripe_event_id: event.id,
        event_type: event.type,
        livemode: event.livemode ?? false,
        payload: event.data.object,
        organization_id: organizationId,
        metadata: event.data.object, // Keep for backward compatibility
    });
    if (insertError && insertError.code !== "23505") {
        // 23505 = unique violation (race condition, another process already inserted)
        // Other errors are real problems
        console.error("Failed to record webhook event:", insertError);
        // Track as webhook failure
        try {
            const { trackWebhookFailure } = await Promise.resolve().then(() => __importStar(require("../lib/billingMonitoring")));
            await trackWebhookFailure(event.type, event.id, `Failed to record webhook event: ${insertError.message}`, {
                status_code: 500,
                error_type: "database_insert_failed",
                error_code: insertError.code,
            });
        }
        catch (trackErr) {
            console.warn("Failed to track webhook failure:", trackErr);
        }
    }
    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object;
                if (!session?.metadata)
                    break;
                const { plan, organizationId } = extractMetadataPlan(session.metadata);
                if (!plan || !organizationId)
                    break;
                // CRITICAL: Always retrieve the full subscription object
                // Session.subscription may be a string ID or null, we need the full object
                if (!session.subscription) {
                    console.error(`[Webhook] checkout.session.completed missing subscription for org ${organizationId}. ` +
                        `Session ID: ${session.id}. This should not happen for subscription mode checkout.`);
                    break;
                }
                const subscriptionId = typeof session.subscription === "string"
                    ? session.subscription
                    : session.subscription.id;
                // Retrieve full subscription object to get period timestamps
                let subscription;
                try {
                    subscription = await stripe.subscriptions.retrieve(subscriptionId);
                }
                catch (err) {
                    console.error(`[Webhook] Failed to retrieve subscription ${subscriptionId} for org ${organizationId}:`, err.message);
                    // Don't break - we'll try to process with what we have, but it may fail
                    throw new Error(`Failed to retrieve subscription ${subscriptionId}: ${err.message}`);
                }
                // Validate we have required subscription data
                if (!subscription.id) {
                    throw new Error(`Retrieved subscription missing ID for org ${organizationId}`);
                }
                if (!subscription.current_period_start || !subscription.current_period_end) {
                    throw new Error(`Subscription ${subscription.id} missing period timestamps for org ${organizationId}`);
                }
                const status = subscription.status ?? "active";
                await applyPlanToOrganization(organizationId, plan, {
                    stripeCustomerId: typeof session.customer === "string" ? session.customer : subscription.customer ?? null,
                    stripeSubscriptionId: subscription.id,
                    currentPeriodStart: subscription.current_period_start,
                    currentPeriodEnd: subscription.current_period_end,
                    status,
                });
                // Log billing event
                // Note: targetId must be UUID (for internal subscription row), not Stripe ID
                // Store Stripe subscription ID in metadata instead
                await (0, audit_1.recordAuditLog)({
                    organizationId,
                    actorId: null, // System event
                    eventName: "billing.subscription_created",
                    targetType: "subscription",
                    targetId: null, // Don't use Stripe ID (it's not a UUID)
                    metadata: {
                        plan,
                        status,
                        stripe_subscription_id: typeof session.subscription === "string" ? session.subscription : null,
                        stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
                        source: "stripe_webhook",
                    },
                });
                break;
            }
            case "customer.subscription.created":
            case "customer.subscription.updated": {
                const eventSubscription = event.data.object;
                const { plan, organizationId } = extractMetadataPlan(eventSubscription?.metadata);
                if (!plan || !organizationId)
                    break;
                // Validate subscription has required fields
                if (!eventSubscription.id) {
                    console.error(`[Webhook] ${event.type} missing subscription ID for org ${organizationId}`);
                    break;
                }
                // Always retrieve full subscription to ensure we have complete data
                // Event payloads may be incomplete or stale
                let subscription;
                try {
                    subscription = await stripe.subscriptions.retrieve(eventSubscription.id);
                }
                catch (err) {
                    console.error(`[Webhook] ${event.type} failed to retrieve subscription ${eventSubscription.id} for org ${organizationId}:`, err.message);
                    break;
                }
                // Validate required fields exist
                if (!subscription.id) {
                    console.error(`[Webhook] ${event.type} retrieved subscription missing ID for org ${organizationId}. ` +
                        `This should never happen.`);
                    break;
                }
                if (!subscription.current_period_start || !subscription.current_period_end) {
                    console.error(`[Webhook] ${event.type} subscription ${subscription.id} missing period timestamps for org ${organizationId}. ` +
                        `Received: current_period_start=${subscription.current_period_start}, ` +
                        `current_period_end=${subscription.current_period_end}. ` +
                        `Full subscription status: ${subscription.status}`);
                    break;
                }
                // Get previous plan for comparison
                const { data: previousSub } = await supabaseClient_1.supabase
                    .from("org_subscriptions")
                    .select("plan_code")
                    .eq("organization_id", organizationId)
                    .maybeSingle();
                const previousPlan = previousSub?.plan_code || null;
                const planChanged = previousPlan && previousPlan !== plan;
                await applyPlanToOrganization(organizationId, plan, {
                    stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : null,
                    stripeSubscriptionId: subscription.id,
                    currentPeriodStart: subscription.current_period_start,
                    currentPeriodEnd: subscription.current_period_end,
                    status: subscription.status ?? "active",
                });
                // Log billing event
                await (0, audit_1.recordAuditLog)({
                    organizationId,
                    actorId: null, // System event
                    eventName: planChanged ? "billing.plan_changed" : "billing.subscription_updated",
                    targetType: "subscription",
                    targetId: null, // Don't use Stripe ID (it's not a UUID)
                    metadata: {
                        plan,
                        previous_plan: previousPlan,
                        status: subscription.status ?? "active",
                        stripe_subscription_id: typeof subscription.id === "string" ? subscription.id : null,
                        stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : null,
                        source: "stripe_webhook",
                    },
                });
                break;
            }
            case "invoice.payment_succeeded": {
                const invoice = event.data.object;
                const subscriptionId = typeof invoice.subscription === "string"
                    ? invoice.subscription
                    : invoice.subscription?.id ?? null;
                if (!subscriptionId) {
                    console.warn("[Webhook] invoice.payment_succeeded missing subscription ID");
                    break;
                }
                // Retrieve full subscription to get period timestamps
                let subscription;
                try {
                    subscription = await stripe.subscriptions.retrieve(subscriptionId);
                }
                catch (err) {
                    console.error(`[Webhook] Failed to retrieve subscription ${subscriptionId} from invoice:`, err.message);
                    break;
                }
                let metadataSource = invoice.lines?.data?.[0]?.metadata ??
                    invoice.metadata ??
                    subscription?.metadata;
                let { plan, organizationId } = extractMetadataPlan(metadataSource);
                if (!plan || !organizationId) {
                    // Try to get from subscription metadata
                    const extracted = extractMetadataPlan(subscription?.metadata);
                    plan = plan || extracted.plan;
                    organizationId = organizationId || extracted.organizationId;
                }
                if (!plan || !organizationId) {
                    console.warn(`[Webhook] invoice.payment_succeeded missing plan or organization_id for subscription ${subscriptionId}`);
                    break;
                }
                await applyPlanToOrganization(organizationId, plan, {
                    stripeCustomerId: typeof invoice.customer === "string" ? invoice.customer : subscription.customer ?? null,
                    stripeSubscriptionId: subscription.id,
                    currentPeriodStart: subscription.current_period_start,
                    currentPeriodEnd: subscription.current_period_end,
                    status: "active",
                });
                break;
            }
            case "invoice.payment_failed": {
                const invoice = event.data.object;
                const subscriptionId = typeof invoice.subscription === "string"
                    ? invoice.subscription
                    : invoice.subscription?.id ?? null;
                if (!subscriptionId) {
                    console.warn("[Webhook] invoice.payment_failed missing subscription ID");
                    break;
                }
                // Retrieve full subscription to get period timestamps
                let subscription;
                try {
                    subscription = await stripe.subscriptions.retrieve(subscriptionId);
                }
                catch (err) {
                    console.error(`[Webhook] Failed to retrieve subscription ${subscriptionId} from invoice:`, err.message);
                    break;
                }
                let metadataSource = invoice.lines?.data?.[0]?.metadata ??
                    invoice.metadata ??
                    subscription?.metadata;
                let { plan, organizationId } = extractMetadataPlan(metadataSource);
                if (!plan || !organizationId) {
                    // Try to get from subscription metadata
                    const extracted = extractMetadataPlan(subscription?.metadata);
                    plan = plan || extracted.plan;
                    organizationId = organizationId || extracted.organizationId;
                }
                if (!plan || !organizationId) {
                    console.warn(`[Webhook] invoice.payment_failed missing plan or organization_id for subscription ${subscriptionId}`);
                    break;
                }
                await applyPlanToOrganization(organizationId, plan, {
                    stripeCustomerId: typeof invoice.customer === "string" ? invoice.customer : subscription.customer ?? null,
                    stripeSubscriptionId: subscription.id,
                    currentPeriodStart: subscription.current_period_start,
                    currentPeriodEnd: subscription.current_period_end,
                    status: "past_due",
                });
                break;
            }
            case "customer.subscription.deleted": {
                const subscription = event.data.object;
                const { plan, organizationId } = extractMetadataPlan(subscription?.metadata);
                if (!plan || !organizationId)
                    break;
                // For canceled subscriptions, period timestamps may be null
                // Use safe conversion (will return null if missing)
                await applyPlanToOrganization(organizationId, plan, {
                    stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : null,
                    stripeSubscriptionId: typeof subscription.id === "string" ? subscription.id : null,
                    currentPeriodStart: subscription.current_period_start ?? null,
                    currentPeriodEnd: subscription.current_period_end ?? null,
                    status: "canceled",
                });
                // Log billing event
                await (0, audit_1.recordAuditLog)({
                    organizationId,
                    actorId: null, // System event
                    eventName: "billing.subscription_canceled",
                    targetType: "subscription",
                    targetId: null, // Don't use Stripe ID (it's not a UUID)
                    metadata: {
                        plan,
                        stripe_subscription_id: typeof subscription.id === "string" ? subscription.id : null,
                        stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : null,
                        source: "stripe_webhook",
                    },
                });
                break;
            }
            default:
                break;
        }
        res.json({ received: true });
    }
    catch (err) {
        console.error("Error handling Stripe webhook:", err?.message);
        // Track webhook failure
        try {
            const { trackWebhookFailure } = await Promise.resolve().then(() => __importStar(require("../lib/billingMonitoring")));
            await trackWebhookFailure(event?.type || "unknown", event?.id || "unknown", `Webhook handler error: ${err?.message}`, {
                status_code: 500,
                error_type: "handler_error",
                correlation_id: event?.id,
                stack: err?.stack,
            });
        }
        catch (trackErr) {
            // Non-critical - log but don't fail
            console.warn("Failed to track webhook failure:", trackErr);
        }
        res.status(500).json({ message: "Webhook handler error" });
    }
}
//# sourceMappingURL=stripeWebhook.js.map