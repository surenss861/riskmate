import express, { type Request, type Response, type RequestHandler, type Router as ExpressRouter } from "express";
import { supabase } from "../lib/supabaseClient";
import { authenticate, AuthenticatedRequest } from "../middleware/auth";
import type { PlanCode } from "../auth/planRules";
import { applyPlanToOrganization } from "./stripeWebhook";

export const subscriptionsRouter: ExpressRouter = express.Router();

const STRIPE_PRICE_IDS: Partial<Record<PlanCode, string | undefined>> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  pro: process.env.STRIPE_PRICE_PRO,
  business: process.env.STRIPE_PRICE_BUSINESS,
};

const STRIPE_PRODUCT_IDS: Partial<Record<PlanCode, string | undefined>> = {
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
async function resolveStripePriceId(stripe: any, plan: PlanCode): Promise<string> {
  // First, check for explicit price ID in env vars (preferred)
  const explicitPrice = STRIPE_PRICE_IDS[plan];
  if (explicitPrice && explicitPrice.startsWith("price_")) {
    return explicitPrice;
  }

  // If price ID is missing, log warning and fall back to product lookup
  if (!explicitPrice) {
    console.warn(
      `[Stripe] STRIPE_PRICE_${plan.toUpperCase()} not set. Falling back to product lookup (slower). ` +
      `Set STRIPE_PRICE_${plan.toUpperCase()}=price_... in env vars for better performance.`
    );
  } else if (explicitPrice.startsWith("prod_")) {
    // If someone accidentally set a product ID in price env var, treat it as product ID
    console.warn(
      `[Stripe] STRIPE_PRICE_${plan.toUpperCase()} contains product ID (${explicitPrice}). ` +
      `Should be a price ID (price_...). Falling back to product lookup.`
    );
    STRIPE_PRODUCT_IDS[plan] = explicitPrice;
  }

  // Fallback: Look up price from product ID (slower, requires Stripe API call)
  const productId = STRIPE_PRODUCT_IDS[plan];
  if (!productId) {
    throw new Error(
      `Stripe price ID not configured for ${plan} plan. ` +
      `Set STRIPE_PRICE_${plan.toUpperCase()}=price_... in environment variables.`
    );
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
    throw new Error(
    `Stripe product ${productId} is missing a default price. ` +
    `Set STRIPE_PRICE_${plan.toUpperCase()}=price_... directly instead.`
    );
  }

  const priceId = typeof product.default_price === "string"
    ? product.default_price
    : product.default_price.id;

  if (!priceId || !priceId.startsWith("price_")) {
    throw new Error(
      `Invalid price ID resolved for ${plan} plan: ${priceId}. ` +
      `Set STRIPE_PRICE_${plan.toUpperCase()}=price_... in environment variables.`
    );
  }

  return priceId;
}

// GET /api/subscriptions
// Returns current subscription tier, usage, and billing period
subscriptionsRouter.get("/", authenticate as unknown as RequestHandler, async (req: Request, res: Response) => {
  try {
    const { organization_id } = (req as AuthenticatedRequest).user;

    // Get plan from org_subscriptions (source of truth)
    const { data: orgSubscription, error: orgSubError } = await supabase
      .from("org_subscriptions")
      .select("plan_code, seats_limit, jobs_limit_month, cancel_at_period_end")
      .eq("organization_id", organization_id)
      .maybeSingle();

    if (orgSubError && orgSubError.code !== "PGRST116") {
      // PGRST116 = no rows returned
      throw orgSubError;
    }

    // Get subscription for billing period and Stripe info
    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("organization_id", organization_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError && subError.code !== "PGRST116") {
      throw subError;
    }

    // CRITICAL: Reconcile DB with Stripe if subscription exists
    // If Stripe says canceled, update DB to match
    if (subscription?.stripe_subscription_id && process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
        const stripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
        
        // If Stripe says canceled but DB doesn't, sync DB
        if (stripeSub.status === "canceled" && subscription.status !== "inactive" && subscription.tier !== "none") {
          console.log(
            `[Reconcile] Stripe subscription ${subscription.stripe_subscription_id} is canceled. ` +
            `Updating DB to match (org ${organization_id}).`
          );
          
          await applyPlanToOrganization(organization_id, "none", {
            stripeCustomerId: subscription.stripe_customer_id || null,
            stripeSubscriptionId: null, // Clear subscription ID
            currentPeriodStart: null,
            currentPeriodEnd: null,
            status: "inactive",
          });

          // Reload subscription after sync
          const { data: syncedSubscription } = await supabase
            .from("subscriptions")
            .select("*")
            .eq("organization_id", organization_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (syncedSubscription) {
            Object.assign(subscription, syncedSubscription);
          }
        }
      } catch (reconcileErr: any) {
        // Non-fatal: log but don't fail the request
        console.warn("[Reconcile] Failed to reconcile with Stripe:", reconcileErr.message);
      }
    }

    // Load organization record for fallback metadata
    const { data: org } = await supabase
      .from("organizations")
      .select("subscription_tier, subscription_status")
      .eq("id", organization_id)
      .maybeSingle();

    // Prioritize org_subscriptions.plan_code, then subscriptions.tier, then organizations.subscription_tier
    let tier = orgSubscription?.plan_code ?? subscription?.tier ?? org?.subscription_tier ?? null;
    let status = subscription?.status ?? org?.subscription_status ?? (tier ? "active" : "none");

    const normalizedStatus = status ?? (tier ? "active" : "none");
    
    // Use actual limits from org_subscriptions if available, otherwise calculate from tier
    let jobsLimit: number | null = null;
    if (orgSubscription) {
      jobsLimit = orgSubscription.jobs_limit_month ?? null;
    } else {
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

    const { count, error: countError } = await supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organization_id)
      .gte("created_at", periodStart.toISOString());

    if (countError) throw countError;

    // Show usage if there's a tier (plan), otherwise null
    const usage = tier ? (count ?? 0) : null;
    const resetDate = tier ? subscription?.current_period_end || null : null;

    // Get cancel_at_period_end from subscription or org_subscriptions
    const cancelAtPeriodEnd = subscription?.cancel_at_period_end ?? orgSubscription?.cancel_at_period_end ?? false;

    res.json({
      data: {
        id: subscription?.id,
        organization_id,
        tier,
        status: normalizedStatus,
        current_period_start: subscription?.current_period_start || null,
        current_period_end: subscription?.current_period_end || null,
        cancel_at_period_end: cancelAtPeriodEnd,
        stripe_subscription_id: subscription?.stripe_subscription_id || null,
        stripe_customer_id: subscription?.stripe_customer_id || null,
        usage,
        jobsLimit,
        resetDate,
      },
    });
  } catch (err: any) {
    console.error("Subscription fetch failed:", err);
    res.status(500).json({ message: "Failed to fetch subscription" });
  }
});

// POST /api/subscriptions/portal
// Returns Stripe billing portal URL
subscriptionsRouter.post("/portal", authenticate as unknown as RequestHandler, async (req: Request, res: Response) => {
  try {
    const { organization_id } = (req as AuthenticatedRequest).user;

    // Get subscription to find Stripe customer ID
    const { data: subscription } = await supabase
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
  } catch (err: any) {
    console.error("Billing portal failed:", err);
    res.status(500).json({ message: "Failed to create billing portal session" });
  }
});

// POST /api/subscriptions/checkout
// Public endpoint to create a Stripe checkout session for new signups
subscriptionsRouter.post("/checkout", async (req: Request, res: Response) => {
  try {
    const { plan, success_url, cancel_url } = req.body ?? {};

    if (!plan || !["starter", "pro", "business"].includes(plan)) {
      return res.status(400).json({ message: "Invalid plan selected" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ message: "Stripe secret key not configured" });
    }

    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
    const planCode = plan as PlanCode;
    const priceId = await resolveStripePriceId(stripe, planCode);

    let organizationId: string | null = null;
    let requestUserId: string | null = null;
    let customerEmail: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split("Bearer ")[1];
      const { data: sessionUser } = await supabase.auth.getUser(token);
      if (sessionUser?.user) {
        requestUserId = sessionUser.user.id;
        customerEmail = sessionUser.user.email ?? undefined;
        const { data: userRecord } = await supabase
          .from("users")
          .select("organization_id")
          .eq("id", sessionUser.user.id)
          .maybeSingle();
        organizationId = userRecord?.organization_id ?? null;
      }
    }

    let stripeCustomerId: string | undefined;
    if (organizationId) {
      const { data: existingSubscription } = await supabase
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
      success_url:
        success_url ||
        `${process.env.FRONTEND_URL || "https://www.riskmate.dev"}/pricing/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:
        cancel_url ||
        `${process.env.FRONTEND_URL || "https://www.riskmate.dev"}/pricing?checkout=cancelled`,
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error("Checkout session creation failed:", err);
    res.status(500).json({ message: "Failed to start checkout", detail: err?.message });
  }
  }
);

subscriptionsRouter.post(
  "/confirm",
  authenticate as unknown as RequestHandler,
  async (req: Request, res: Response) => {
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
      const planCode = metadata.plan_code as PlanCode | undefined;
      const organizationId =
        metadata.organization_id ||
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

      let subscription =
        typeof session.subscription === "object"
          ? session.subscription
          : session.subscription
          ? await stripe.subscriptions.retrieve(session.subscription)
          : null;

      const { organization_id: requesterOrgId } = (req as AuthenticatedRequest).user;
      if (requesterOrgId && requesterOrgId !== organizationId) {
        return res.status(403).json({ message: "Session does not belong to this organization" });
      }

      // Ensure we have full subscription object with period timestamps
      if (!subscription) {
        if (typeof session.subscription === "string") {
          subscription = await stripe.subscriptions.retrieve(session.subscription);
        } else {
          throw new Error("Checkout session missing subscription");
        }
      }

      if (!subscription.current_period_start || !subscription.current_period_end) {
        throw new Error("Subscription missing period timestamps");
      }

      // Pass Unix seconds (not ISO strings) to applyPlanToOrganization
      await applyPlanToOrganization(organizationId, planCode, {
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
    } catch (err: any) {
      console.error("Checkout confirmation failed:", err);
      res.status(500).json({ message: "Failed to confirm subscription", detail: err?.message });
    }
  }
);

// POST /api/subscriptions/switch
// Switches organization to a different plan (upgrade/downgrade)
subscriptionsRouter.post(
  "/switch",
  authenticate as unknown as RequestHandler,
  async (req: Request, res: Response) => {
    try {
      const { organization_id, id: userId, role: userRole } = (req as AuthenticatedRequest).user;

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
      const planCode = plan as PlanCode;

      // Get current subscription
      const { data: currentSubscription } = await supabase
        .from("subscriptions")
        .select("tier, stripe_subscription_id, stripe_customer_id, current_period_start, current_period_end")
        .eq("organization_id", organization_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const currentPlan = (currentSubscription?.tier as PlanCode) || "none";

      // If switching to the same plan, return success
      if (currentPlan === planCode) {
        return res.json({
          success: true,
          message: "Already on this plan",
          plan: planCode,
        });
      }

      // Determine plan ranking for upgrade/downgrade logic
      // NOTE: 'none' is not a paid plan, all others (starter/pro/business) are PAID
      // Starter = $29, Pro = $59, Business = $129
      const planRank: Record<PlanCode, number> = {
        none: -1, // No plan (lowest)
        starter: 0,
        pro: 1,
        business: 2,
      };
      const currentRank = planRank[currentPlan] ?? -1;
      const targetRank = planRank[planCode] ?? -1;
      const isUpgrade = targetRank > currentRank;
      const isDowngrade = targetRank < currentRank;
      
      // If current plan is 'none', always treat as upgrade (new subscription)
      if (currentPlan === "none") {
        // No existing subscription, create Checkout session
        // This will be handled by the "New subscription" path below
      }

      // For all plan changes (starter/pro/business are all paid), determine if upgrade or downgrade
      const priceId = await resolveStripePriceId(stripe, planCode);
      const subscriptionId = currentSubscription?.stripe_subscription_id;

      // UPGRADE: If org already has active subscription, update it (don't create new one)
      if (isUpgrade && subscriptionId) {
        // CRITICAL: Check if subscription is canceled - if so, must create new Checkout
        try {
          // Retrieve current subscription to check status
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);

          // If subscription is canceled, cannot update it - must create new subscription
          if (subscription.status === "canceled") {
            console.log(
              `[Switch] Subscription ${subscriptionId} is canceled. Creating new Checkout session.`
            );
            
            // Create new Checkout session for new subscription
            const session = await stripe.checkout.sessions.create({
              mode: "subscription",
              payment_method_types: ["card"],
              line_items: [
                {
                  price: priceId,
                  quantity: 1,
                },
              ],
              success_url:
                `${process.env.FRONTEND_URL || "https://www.riskmate.dev"}/pricing/thank-you?session_id={CHECKOUT_SESSION_ID}`,
              cancel_url:
                `${process.env.FRONTEND_URL || "https://www.riskmate.dev"}/operations/account/change-plan`,
              metadata: {
                plan: planCode,
                organization_id: organization_id,
                action: "switch",
                previous_plan: currentPlan,
                is_upgrade: "true",
                reason: "subscription_canceled",
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

            return res.json({
              success: true,
              url: session.url,
              checkout_url: session.url,
              reason: "subscription_canceled",
              message: "Your previous subscription was canceled. Please complete checkout to start a new subscription.",
            });
          }

          // If cancellation is scheduled, allow switching (Stripe usually allows this)
          // But you could also force resume first if you want simpler logic
          if (subscription.cancel_at_period_end === true) {
            console.log(
              `[Switch] Subscription ${subscriptionId} has cancellation scheduled. Allowing switch.`
            );
            // Continue with normal update flow below
          }

          // Retrieve subscription item ID for update

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
            throw new Error(
              `Subscription ${subscriptionId} missing period timestamps after update. ` +
              `This should never happen for an active subscription.`
            );
          }

          // Verify the price actually changed
          const updatedPriceId = updatedSubscription.items.data[0]?.price?.id;
          if (updatedPriceId !== priceId) {
            console.error(
              `[Switch] Price mismatch: expected ${priceId}, got ${updatedPriceId} for subscription ${subscriptionId}`
            );
          }

          // Log Stripe update verification
          console.log(
            `[Switch] Stripe subscription updated (upgrade): id=${updatedSubscription.id}, ` +
            `priceId=${updatedPriceId}, status=${updatedSubscription.status}`
          );

          // Pass Unix seconds (not ISO strings) to applyPlanToOrganization
          await applyPlanToOrganization(organization_id, planCode, {
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
        } catch (err: any) {
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
          success_url:
            `${process.env.FRONTEND_URL || "https://www.riskmate.dev"}/pricing/thank-you?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url:
            `${process.env.FRONTEND_URL || "https://www.riskmate.dev"}/operations/account`,
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
          // CRITICAL: Check if subscription is canceled - if so, must create new Checkout
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);

          // If subscription is canceled, cannot update it - must create new subscription
          if (subscription.status === "canceled") {
            console.log(
              `[Switch] Subscription ${subscriptionId} is canceled. Creating new Checkout session.`
            );
            
            // Create new Checkout session for new subscription
            const session = await stripe.checkout.sessions.create({
              mode: "subscription",
              payment_method_types: ["card"],
              line_items: [
                {
                  price: priceId,
                  quantity: 1,
                },
              ],
              success_url:
                `${process.env.FRONTEND_URL || "https://www.riskmate.dev"}/pricing/thank-you?session_id={CHECKOUT_SESSION_ID}`,
              cancel_url:
                `${process.env.FRONTEND_URL || "https://www.riskmate.dev"}/operations/account/change-plan`,
              metadata: {
                plan: planCode,
                organization_id: organization_id,
                action: "switch",
                previous_plan: currentPlan,
                reason: "subscription_canceled",
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

            return res.json({
              success: true,
              url: session.url,
              checkout_url: session.url,
              reason: "subscription_canceled",
              message: "Your previous subscription was canceled. Please complete checkout to start a new subscription.",
            });
          }

          // Retrieve subscription item ID for update

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
            throw new Error(
              `Subscription ${subscriptionId} missing period timestamps after update. ` +
              `This should never happen for an active subscription.`
            );
          }

          // Verify the price actually changed
          const updatedPriceId = updatedSubscription.items.data[0]?.price?.id;
          if (updatedPriceId !== priceId) {
            console.error(
              `[Switch] Price mismatch: expected ${priceId}, got ${updatedPriceId} for subscription ${subscriptionId}`
            );
            // Still proceed, but log the issue
          }

          // Log Stripe update verification
          console.log(
            `[Switch] Stripe subscription updated: id=${updatedSubscription.id}, ` +
            `priceId=${updatedPriceId}, status=${updatedSubscription.status}, ` +
            `cancel_at_period_end=${updatedSubscription.cancel_at_period_end}`
          );

          // Pass Unix seconds (not ISO strings) to applyPlanToOrganization
          await applyPlanToOrganization(organization_id, planCode, {
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
        } catch (err: any) {
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
        success_url:
          `${process.env.FRONTEND_URL || "https://www.riskmate.dev"}/pricing/thank-you?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:
          `${process.env.FRONTEND_URL || "https://www.riskmate.dev"}/operations/account`,
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
    } catch (err: any) {
      console.error("Plan switch error:", err);
      res.status(500).json({ message: "Failed to switch plan", detail: err?.message });
    }
  }
);

// POST /api/subscriptions/cancel
// Cancels subscription at period end (user keeps access until renewal)
subscriptionsRouter.post(
  "/cancel",
  authenticate as unknown as RequestHandler,
  async (req: Request, res: Response) => {
    try {
      const { organization_id, role: userRole } = (req as AuthenticatedRequest).user;

      if (!userRole || !["owner", "admin"].includes(userRole)) {
        return res.status(403).json({ message: "Only owners and admins can cancel plans" });
      }

      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(500).json({ message: "Stripe secret key not configured" });
      }

      const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

      // Get current subscription
      const { data: currentSubscription } = await supabase
        .from("subscriptions")
        .select("tier, stripe_subscription_id, stripe_customer_id")
        .eq("organization_id", organization_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const subscriptionId = currentSubscription?.stripe_subscription_id;

      if (!subscriptionId) {
        return res.status(404).json({ message: "No active subscription found" });
      }

      // CRITICAL: Retrieve subscription from Stripe first to check status
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      // Handle already canceled subscription (idempotent)
      if (subscription.status === "canceled") {
        // Subscription is already canceled - update DB to reflect reality
        console.log(
          `[Cancel] Subscription ${subscriptionId} is already canceled. Updating DB to match.`
        );
        
        await applyPlanToOrganization(organization_id, "none", {
          stripeCustomerId: currentSubscription?.stripe_customer_id || null,
          stripeSubscriptionId: null, // Clear subscription ID
          currentPeriodStart: null,
          currentPeriodEnd: null,
          status: "inactive",
        });

        return res.json({
          success: true,
          message: "Subscription is already canceled",
          alreadyCanceled: true,
          cancel_at_period_end: false,
        });
      }

      // Handle already scheduled cancellation (idempotent)
      if (subscription.cancel_at_period_end === true) {
        return res.json({
          success: true,
          message: "Cancellation is already scheduled",
          alreadyScheduled: true,
          cancel_at_period_end: true,
          current_period_end: subscription.current_period_end,
        });
      }

      // Schedule cancellation at period end
      const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });

      // Update DB to reflect cancellation scheduled (keep status as active until period ends)
      const { error: updateError } = await supabase
        .from("org_subscriptions")
        .update({
          cancel_at_period_end: true,
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", organization_id);

      // Also update subscriptions table
      if (subscriptionId) {
        await supabase
          .from("subscriptions")
          .update({
            cancel_at_period_end: true,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscriptionId);
      }

      if (updateError) {
        console.error("Failed to update org_subscriptions:", updateError);
      }

      return res.json({
        success: true,
        message: "Subscription will cancel at the end of the billing period",
        cancel_at_period_end: updatedSubscription.cancel_at_period_end,
        current_period_end: updatedSubscription.current_period_end,
      });
    } catch (err: any) {
      console.error("Cancel subscription error:", err);
      res.status(500).json({ message: "Failed to cancel subscription", detail: err?.message });
    }
  }
);

// POST /api/subscriptions/resume
// Resumes a scheduled cancellation
subscriptionsRouter.post(
  "/resume",
  authenticate as unknown as RequestHandler,
  async (req: Request, res: Response) => {
    try {
      const { organization_id, role: userRole } = (req as AuthenticatedRequest).user;

      if (!userRole || !["owner", "admin"].includes(userRole)) {
        return res.status(403).json({ message: "Only owners and admins can resume plans" });
      }

      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(500).json({ message: "Stripe secret key not configured" });
      }

      const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

      // Get current subscription
      const { data: currentSubscription } = await supabase
        .from("subscriptions")
        .select("tier, stripe_subscription_id, stripe_customer_id")
        .eq("organization_id", organization_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const subscriptionId = currentSubscription?.stripe_subscription_id;

      if (!subscriptionId) {
        return res.status(404).json({ message: "No active subscription found" });
      }

      // CRITICAL: Retrieve subscription from Stripe first to check status
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      // Handle already canceled subscription (cannot resume)
      if (subscription.status === "canceled") {
        return res.status(400).json({
          message: "Cannot resume a canceled subscription. Please create a new subscription.",
          alreadyCanceled: true,
        });
      }

      // Handle already resumed (idempotent)
      if (subscription.cancel_at_period_end === false) {
        return res.json({
          success: true,
          message: "Subscription is already active (not scheduled for cancellation)",
          alreadyResumed: true,
          cancel_at_period_end: false,
          current_period_end: subscription.current_period_end,
        });
      }

      // Resume subscription (remove cancellation)
      const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
      });

      // Update DB to reflect active status
      const { error: updateError } = await supabase
        .from("org_subscriptions")
        .update({
          status: "active",
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", organization_id);

      // Also update subscriptions table
      if (subscriptionId) {
        await supabase
          .from("subscriptions")
          .update({
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscriptionId);
      }

      if (updateError) {
        console.error("Failed to update org_subscriptions:", updateError);
      }

      return res.json({
        success: true,
        message: "Subscription resumed successfully",
        cancel_at_period_end: subscription.cancel_at_period_end,
        current_period_end: subscription.current_period_end,
      });
    } catch (err: any) {
      console.error("Resume subscription error:", err);
      res.status(500).json({ message: "Failed to resume subscription", detail: err?.message });
    }
  }
);