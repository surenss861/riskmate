"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionsRouter = void 0;
const express_1 = __importDefault(require("express"));
const supabaseClient_1 = require("../lib/supabaseClient");
const auth_1 = require("../middleware/auth");
const stripeWebhook_1 = require("./stripeWebhook");
exports.subscriptionsRouter = express_1.default.Router();
const STRIPE_PRICE_IDS = {
    starter: process.env.STRIPE_PRICE_STARTER,
    pro: process.env.STRIPE_PRICE_PRO,
    business: process.env.STRIPE_PRICE_BUSINESS,
};
const STRIPE_PRODUCT_IDS = {
    starter: process.env.STRIPE_PRODUCT_STARTER || "prod_TpcwqnpnlA9keA",
    pro: process.env.STRIPE_PRODUCT_PRO || "prod_TpcyAbLnS5VDz7",
    business: process.env.STRIPE_PRODUCT_BUSINESS || "prod_TpczVi0pxfQhfH",
};
/**
 * Resolve Stripe Price ID for a plan
 *
 * Priority:
 * 1. STRIPE_PRICE_* env var (must be price_...)
 * 2. Fallback to product ID lookup (slower, not recommended for production)
 *
 * For production, always set STRIPE_PRICE_STARTER, STRIPE_PRICE_PRO, STRIPE_PRICE_BUSINESS
 * to avoid Stripe API calls and ensure correct pricing.
 */
async function resolveStripePriceId(stripe, plan) {
    // First, check for explicit price ID in env vars (preferred)
    const explicitPrice = STRIPE_PRICE_IDS[plan];
    if (explicitPrice && explicitPrice.startsWith("price_")) {
        return explicitPrice;
    }
    // If price ID is missing, log warning and fall back to product lookup
    if (!explicitPrice) {
        console.warn(`[Stripe] STRIPE_PRICE_${plan.toUpperCase()} not set. Falling back to product lookup (slower). ` +
            `Set STRIPE_PRICE_${plan.toUpperCase()}=price_... in env vars for better performance.`);
    }
    else if (explicitPrice.startsWith("prod_")) {
        // If someone accidentally set a product ID in price env var, treat it as product ID
        console.warn(`[Stripe] STRIPE_PRICE_${plan.toUpperCase()} contains product ID (${explicitPrice}). ` +
            `Should be a price ID (price_...). Falling back to product lookup.`);
        STRIPE_PRODUCT_IDS[plan] = explicitPrice;
    }
    // Fallback: Look up price from product ID (slower, requires Stripe API call)
    const productId = STRIPE_PRODUCT_IDS[plan];
    if (!productId) {
        throw new Error(`Stripe price ID not configured for ${plan} plan. ` +
            `Set STRIPE_PRICE_${plan.toUpperCase()}=price_... in environment variables.`);
    }
    // If product ID is actually a price ID, use it
    if (productId.startsWith("price_")) {
        return productId;
    }
    // Retrieve product and get default price
    const product = await stripe.products.retrieve(productId, {
        expand: ["default_price"],
    });
    if (!product?.default_price) {
        throw new Error(`Stripe product ${productId} is missing a default price. ` +
            `Set STRIPE_PRICE_${plan.toUpperCase()}=price_... directly instead.`);
    }
    const priceId = typeof product.default_price === "string"
        ? product.default_price
        : product.default_price.id;
    if (!priceId || !priceId.startsWith("price_")) {
        throw new Error(`Invalid price ID resolved for ${plan} plan: ${priceId}. ` +
            `Set STRIPE_PRICE_${plan.toUpperCase()}=price_... in environment variables.`);
    }
    return priceId;
}
// GET /api/subscriptions
// Returns current subscription tier, usage, and billing period
exports.subscriptionsRouter.get("/", auth_1.authenticate, async (req, res) => {
    try {
        const { organization_id } = req.user;
        // Get plan from org_subscriptions (source of truth)
        const { data: orgSubscription, error: orgSubError } = await supabaseClient_1.supabase
            .from("org_subscriptions")
            .select("plan_code, seats_limit, jobs_limit_month")
            .eq("organization_id", organization_id)
            .maybeSingle();
        if (orgSubError && orgSubError.code !== "PGRST116") {
            // PGRST116 = no rows returned
            throw orgSubError;
        }
        // Get subscription for billing period and Stripe info
        const { data: subscription, error: subError } = await supabaseClient_1.supabase
            .from("subscriptions")
            .select("*")
            .eq("organization_id", organization_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        if (subError && subError.code !== "PGRST116") {
            throw subError;
        }
        // Load organization record for fallback metadata
        const { data: org } = await supabaseClient_1.supabase
            .from("organizations")
            .select("subscription_tier, subscription_status")
            .eq("id", organization_id)
            .maybeSingle();
        // Prioritize org_subscriptions.plan_code, then subscriptions.tier, then organizations.subscription_tier
        let tier = orgSubscription?.plan_code ?? subscription?.tier ?? org?.subscription_tier ?? null;
        let status = subscription?.status ?? org?.subscription_status ?? (tier ? "active" : "none");
        const normalizedStatus = status ?? (tier ? "active" : "none");
        // Use actual limits from org_subscriptions if available, otherwise calculate from tier
        let jobsLimit = null;
        if (orgSubscription) {
            jobsLimit = orgSubscription.jobs_limit_month ?? null;
        }
        else {
            // Fallback to tier-based limits
            jobsLimit =
                tier === "starter"
                    ? 10
                    : tier === "pro"
                        ? null // unlimited
                        : tier === "business"
                            ? null // unlimited
                            : normalizedStatus === "none"
                                ? 0
                                : null;
        }
        // Count jobs created in current billing period
        const periodStart = subscription?.current_period_start
            ? new Date(subscription.current_period_start)
            : new Date(); // If no subscription, use current month
        const { count, error: countError } = await supabaseClient_1.supabase
            .from("jobs")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", organization_id)
            .gte("created_at", periodStart.toISOString());
        if (countError)
            throw countError;
        // Show usage if there's a tier (plan), otherwise null
        const usage = tier ? (count ?? 0) : null;
        const resetDate = tier ? subscription?.current_period_end || null : null;
        res.json({
            data: {
                id: subscription?.id,
                organization_id,
                tier,
                status: normalizedStatus,
                current_period_start: subscription?.current_period_start || null,
                current_period_end: subscription?.current_period_end || null,
                stripe_subscription_id: subscription?.stripe_subscription_id || null,
                stripe_customer_id: subscription?.stripe_customer_id || null,
                usage,
                jobsLimit,
                resetDate,
            },
        });
    }
    catch (err) {
        console.error("Subscription fetch failed:", err);
        res.status(500).json({ message: "Failed to fetch subscription" });
    }
});
// POST /api/subscriptions/portal
// Returns Stripe billing portal URL
exports.subscriptionsRouter.post("/portal", auth_1.authenticate, async (req, res) => {
    try {
        const { organization_id } = req.user;
        // Get subscription to find Stripe customer ID
        const { data: subscription } = await supabaseClient_1.supabase
            .from("subscriptions")
            .select("stripe_customer_id")
            .eq("organization_id", organization_id)
            .single();
        if (!subscription?.stripe_customer_id) {
            return res.status(404).json({ message: "No Stripe customer found" });
        }
        // TODO: Call Stripe API to create billing portal session
        // For now, return a placeholder
        const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
        const session = await stripe.billingPortal.sessions.create({
            customer: subscription.stripe_customer_id,
            return_url: `${process.env.FRONTEND_URL || "https://www.riskmate.dev"}/account`,
        });
        res.json({ url: session.url });
    }
    catch (err) {
        console.error("Billing portal failed:", err);
        res.status(500).json({ message: "Failed to create billing portal session" });
    }
});
// POST /api/subscriptions/checkout
// Public endpoint to create a Stripe checkout session for new signups
exports.subscriptionsRouter.post("/checkout", async (req, res) => {
    try {
        const { plan, success_url, cancel_url } = req.body ?? {};
        if (!plan || !["starter", "pro", "business"].includes(plan)) {
            return res.status(400).json({ message: "Invalid plan selected" });
        }
        if (!process.env.STRIPE_SECRET_KEY) {
            return res.status(500).json({ message: "Stripe secret key not configured" });
        }
        const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
        const planCode = plan;
        const priceId = await resolveStripePriceId(stripe, planCode);
        let organizationId = null;
        let requestUserId = null;
        let customerEmail;
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith("Bearer ")) {
            const token = authHeader.split("Bearer ")[1];
            const { data: sessionUser } = await supabaseClient_1.supabase.auth.getUser(token);
            if (sessionUser?.user) {
                requestUserId = sessionUser.user.id;
                customerEmail = sessionUser.user.email ?? undefined;
                const { data: userRecord } = await supabaseClient_1.supabase
                    .from("users")
                    .select("organization_id")
                    .eq("id", sessionUser.user.id)
                    .maybeSingle();
                organizationId = userRecord?.organization_id ?? null;
            }
        }
        let stripeCustomerId;
        if (organizationId) {
            const { data: existingSubscription } = await supabaseClient_1.supabase
                .from("subscriptions")
                .select("stripe_customer_id")
                .eq("organization_id", organizationId)
                .maybeSingle();
            if (existingSubscription?.stripe_customer_id) {
                stripeCustomerId = existingSubscription.stripe_customer_id;
            }
        }
        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            billing_address_collection: "required",
            customer: stripeCustomerId || undefined,
            customer_email: stripeCustomerId ? undefined : customerEmail,
            client_reference_id: organizationId || undefined,
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            allow_promotion_codes: true,
            metadata: {
                plan_code: planCode,
                organization_id: organizationId || undefined,
                user_id: requestUserId || undefined,
            },
            subscription_data: {
                metadata: {
                    plan_code: planCode,
                    organization_id: organizationId || undefined,
                    user_id: requestUserId || undefined,
                },
            },
            success_url: success_url ||
                `${process.env.FRONTEND_URL || "https://www.riskmate.dev"}/pricing/thank-you?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancel_url ||
                `${process.env.FRONTEND_URL || "https://www.riskmate.dev"}/pricing?checkout=cancelled`,
        });
        res.json({ url: session.url });
    }
    catch (err) {
        console.error("Checkout session creation failed:", err);
        res.status(500).json({ message: "Failed to start checkout", detail: err?.message });
    }
});
exports.subscriptionsRouter.post("/confirm", auth_1.authenticate, async (req, res) => {
    try {
        const { session_id } = req.body ?? {};
        if (!session_id) {
            return res.status(400).json({ message: "Missing session_id" });
        }
        if (!process.env.STRIPE_SECRET_KEY) {
            return res.status(500).json({ message: "Stripe secret key not configured" });
        }
        const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
        const session = await stripe.checkout.sessions.retrieve(session_id, {
            expand: ["subscription"],
        });
        if (!session) {
            return res.status(404).json({ message: "Checkout session not found" });
        }
        const metadata = session.metadata || {};
        const planCode = metadata.plan_code;
        const organizationId = metadata.organization_id ||
            session.client_reference_id ||
            (typeof session.subscription === "object"
                ? session.subscription?.metadata?.organization_id
                : undefined);
        if (!planCode || !["starter", "pro", "business"].includes(planCode)) {
            return res.status(400).json({ message: "Session missing plan information" });
        }
        if (!organizationId) {
            return res.status(400).json({ message: "Session missing organization identifier" });
        }
        let subscription = typeof session.subscription === "object"
            ? session.subscription
            : session.subscription
                ? await stripe.subscriptions.retrieve(session.subscription)
                : null;
        const { organization_id: requesterOrgId } = req.user;
        if (requesterOrgId && requesterOrgId !== organizationId) {
            return res.status(403).json({ message: "Session does not belong to this organization" });
        }
        // Ensure we have full subscription object with period timestamps
        if (!subscription) {
            if (typeof session.subscription === "string") {
                subscription = await stripe.subscriptions.retrieve(session.subscription);
            }
            else {
                throw new Error("Checkout session missing subscription");
            }
        }
        if (!subscription.current_period_start || !subscription.current_period_end) {
            throw new Error("Subscription missing period timestamps");
        }
        // Pass Unix seconds (not ISO strings) to applyPlanToOrganization
        await (0, stripeWebhook_1.applyPlanToOrganization)(organizationId, planCode, {
            stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
            stripeSubscriptionId: subscription.id,
            currentPeriodStart: subscription.current_period_start, // Unix seconds from Stripe
            currentPeriodEnd: subscription.current_period_end, // Unix seconds from Stripe
        });
        res.json({
            status: "updated",
            plan: planCode,
            organization_id: organizationId,
        });
    }
    catch (err) {
        console.error("Checkout confirmation failed:", err);
        res.status(500).json({ message: "Failed to confirm subscription", detail: err?.message });
    }
});
// POST /api/subscriptions/switch
// Switches organization to a different plan (upgrade/downgrade)
exports.subscriptionsRouter.post("/switch", auth_1.authenticate, async (req, res) => {
    try {
        const { organization_id, id: userId, role: userRole } = req.user;
        // Only owners and admins can switch plans
        if (!userRole || !["owner", "admin"].includes(userRole)) {
            return res.status(403).json({ message: "Only owners and admins can change plans" });
        }
        const { plan } = req.body ?? {};
        if (!plan || !["starter", "pro", "business"].includes(plan)) {
            return res.status(400).json({ message: "Invalid plan" });
        }
        if (!process.env.STRIPE_SECRET_KEY) {
            return res.status(500).json({ message: "Stripe secret key not configured" });
        }
        const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
        const planCode = plan;
        // Get current subscription
        const { data: currentSubscription } = await supabaseClient_1.supabase
            .from("subscriptions")
            .select("tier, stripe_subscription_id, stripe_customer_id, current_period_start, current_period_end")
            .eq("organization_id", organization_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        const currentPlan = currentSubscription?.tier || "starter";
        // If switching to the same plan, return success
        if (currentPlan === planCode) {
            return res.json({
                success: true,
                message: "Already on this plan",
                plan: planCode,
            });
        }
        // Determine plan ranking for upgrade/downgrade logic
        // NOTE: All tiers (starter/pro/business) are PAID plans
        // Starter = $29, Pro = $59, Business = $129
        const planRank = {
            starter: 0,
            pro: 1,
            business: 2,
        };
        const currentRank = planRank[currentPlan];
        const targetRank = planRank[planCode];
        const isUpgrade = targetRank > currentRank;
        const isDowngrade = targetRank < currentRank;
        // For all plan changes (starter/pro/business are all paid), determine if upgrade or downgrade
        const priceId = await resolveStripePriceId(stripe, planCode);
        const subscriptionId = currentSubscription?.stripe_subscription_id;
        // UPGRADE: If org already has active subscription, update it (don't create new one)
        if (isUpgrade && subscriptionId) {
            // CRITICAL: Don't create a new subscription if one already exists
            // Update the existing subscription's price instead
            try {
                // Retrieve current subscription to get subscription item ID
                const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                // Update subscription price immediately (with proration for upgrades)
                await stripe.subscriptions.update(subscriptionId, {
                    items: [
                        {
                            id: subscription.items.data[0].id,
                            price: priceId,
                        },
                    ],
                    proration_behavior: "create_prorations", // Valid Stripe value: create prorations for upgrades
                });
                // CRITICAL: Always retrieve full subscription AFTER update to get fresh period timestamps
                const updatedSubscription = await stripe.subscriptions.retrieve(subscriptionId);
                // Validate period timestamps exist
                if (!updatedSubscription.current_period_start || !updatedSubscription.current_period_end) {
                    throw new Error(`Subscription ${subscriptionId} missing period timestamps after update. ` +
                        `This should never happen for an active subscription.`);
                }
                // Verify the price actually changed
                const updatedPriceId = updatedSubscription.items.data[0]?.price?.id;
                if (updatedPriceId !== priceId) {
                    console.error(`[Switch] Price mismatch: expected ${priceId}, got ${updatedPriceId} for subscription ${subscriptionId}`);
                }
                // Log Stripe update verification
                console.log(`[Switch] Stripe subscription updated (upgrade): id=${updatedSubscription.id}, ` +
                    `priceId=${updatedPriceId}, status=${updatedSubscription.status}`);
                // Pass Unix seconds (not ISO strings) to applyPlanToOrganization
                await (0, stripeWebhook_1.applyPlanToOrganization)(organization_id, planCode, {
                    stripeCustomerId: currentSubscription.stripe_customer_id || null,
                    stripeSubscriptionId: subscriptionId,
                    currentPeriodStart: updatedSubscription.current_period_start, // Unix seconds
                    currentPeriodEnd: updatedSubscription.current_period_end, // Unix seconds
                    status: updatedSubscription.status,
                });
                return res.json({
                    success: true,
                    message: `Upgraded to ${planCode} plan. Your billing will reflect the new price immediately.`,
                    plan: planCode,
                    subscriptionId: updatedSubscription.id,
                    priceId: updatedPriceId,
                    status: updatedSubscription.status,
                });
            }
            catch (err) {
                console.error("Failed to process upgrade:", err);
                return res.status(500).json({
                    message: "Failed to process upgrade",
                    detail: err?.message,
                });
            }
        }
        // UPGRADE: No existing subscription - create Checkout (new customer)
        if (isUpgrade && !subscriptionId) {
            // Create Checkout session for new subscription
            const session = await stripe.checkout.sessions.create({
                mode: "subscription",
                payment_method_types: ["card"],
                line_items: [
                    {
                        price: priceId,
                        quantity: 1,
                    },
                ],
                success_url: `${process.env.FRONTEND_URL || "https://www.riskmate.dev"}/pricing/thank-you?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.FRONTEND_URL || "https://www.riskmate.dev"}/operations/account`,
                metadata: {
                    plan: planCode,
                    organization_id: organization_id,
                    action: "switch",
                    previous_plan: currentPlan,
                    is_upgrade: "true",
                },
                client_reference_id: organization_id,
                customer: currentSubscription?.stripe_customer_id || undefined,
                subscription_data: {
                    metadata: {
                        plan: planCode,
                        organization_id: organization_id,
                        previous_plan: currentPlan,
                    },
                },
            });
            return res.json({ url: session.url });
        }
        // DOWNGRADE: Update immediately with no proration (all tiers are paid)
        if (isDowngrade && subscriptionId) {
            try {
                // Retrieve current subscription to get subscription item ID
                const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                // Update subscription price immediately (no proration for downgrades)
                await stripe.subscriptions.update(subscriptionId, {
                    items: [
                        {
                            id: subscription.items.data[0].id,
                            price: priceId,
                        },
                    ],
                    proration_behavior: "none", // No proration for downgrades
                });
                // CRITICAL: Always retrieve full subscription AFTER update to get fresh period timestamps
                const updatedSubscription = await stripe.subscriptions.retrieve(subscriptionId);
                // Validate period timestamps exist (they should always exist for active subscriptions)
                if (!updatedSubscription.current_period_start || !updatedSubscription.current_period_end) {
                    throw new Error(`Subscription ${subscriptionId} missing period timestamps after update. ` +
                        `This should never happen for an active subscription.`);
                }
                // Verify the price actually changed
                const updatedPriceId = updatedSubscription.items.data[0]?.price?.id;
                if (updatedPriceId !== priceId) {
                    console.error(`[Switch] Price mismatch: expected ${priceId}, got ${updatedPriceId} for subscription ${subscriptionId}`);
                    // Still proceed, but log the issue
                }
                // Log Stripe update verification
                console.log(`[Switch] Stripe subscription updated: id=${updatedSubscription.id}, ` +
                    `priceId=${updatedPriceId}, status=${updatedSubscription.status}, ` +
                    `cancel_at_period_end=${updatedSubscription.cancel_at_period_end}`);
                // Pass Unix seconds (not ISO strings) to applyPlanToOrganization
                await (0, stripeWebhook_1.applyPlanToOrganization)(organization_id, planCode, {
                    stripeCustomerId: currentSubscription.stripe_customer_id || null,
                    stripeSubscriptionId: subscriptionId,
                    currentPeriodStart: updatedSubscription.current_period_start, // Unix seconds
                    currentPeriodEnd: updatedSubscription.current_period_end, // Unix seconds
                    status: updatedSubscription.status,
                });
                return res.json({
                    success: true,
                    message: `Downgraded to ${planCode} plan. Your billing will reflect the new price on your next invoice.`,
                    plan: planCode,
                    // Return Stripe verification details for debugging
                    subscriptionId: updatedSubscription.id,
                    priceId: updatedPriceId,
                    status: updatedSubscription.status,
                    cancel_at_period_end: updatedSubscription.cancel_at_period_end,
                });
            }
            catch (err) {
                console.error("Failed to process downgrade:", err);
                return res.status(500).json({
                    message: "Failed to process downgrade",
                    detail: err?.message,
                });
            }
        }
        // New subscription (no existing subscription) - create Checkout
        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            payment_method_types: ["card"],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: `${process.env.FRONTEND_URL || "https://www.riskmate.dev"}/pricing/thank-you?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL || "https://www.riskmate.dev"}/operations/account`,
            metadata: {
                plan: planCode,
                organization_id: organization_id,
                action: "switch",
                previous_plan: currentPlan,
            },
            client_reference_id: organization_id,
            customer: currentSubscription?.stripe_customer_id || undefined,
        });
        return res.json({ url: session.url });
    }
    catch (err) {
        console.error("Plan switch error:", err);
        res.status(500).json({ message: "Failed to switch plan", detail: err?.message });
    }
});
//# sourceMappingURL=subscriptions.js.map