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

async function resolveStripePriceId(stripe: any, plan: PlanCode): Promise<string> {
  const explicitPrice = STRIPE_PRICE_IDS[plan];
  if (explicitPrice && explicitPrice.startsWith("price_")) {
    return explicitPrice;
  }

  if (explicitPrice && explicitPrice.startsWith("prod_")) {
    STRIPE_PRODUCT_IDS[plan] = explicitPrice;
  }

  const productId = STRIPE_PRODUCT_IDS[plan];
  if (!productId) {
    throw new Error(`Stripe product ID not configured for ${plan} plan`);
  }

  if (productId.startsWith("price_")) {
    return productId;
  }

  const product = await stripe.products.retrieve(productId, {
    expand: ["default_price"],
  });

  if (!product?.default_price) {
    throw new Error(`Stripe product ${productId} is missing a default price`);
  }

  if (typeof product.default_price === "string") {
    return product.default_price;
  }

  return product.default_price.id;
}

// GET /api/subscriptions
// Returns current subscription tier, usage, and billing period
subscriptionsRouter.get("/", authenticate as unknown as RequestHandler, async (req: Request, res: Response) => {
  try {
    const { organization_id } = (req as AuthenticatedRequest).user;

    // Get plan from org_subscriptions (source of truth)
    const { data: orgSubscription, error: orgSubError } = await supabase
      .from("org_subscriptions")
      .select("plan_code, seats_limit, jobs_limit_month")
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

      const subscription =
        typeof session.subscription === "object"
          ? session.subscription
          : session.subscription
          ? await stripe.subscriptions.retrieve(session.subscription)
          : null;

      const { organization_id: requesterOrgId } = (req as AuthenticatedRequest).user;
      if (requesterOrgId && requesterOrgId !== organizationId) {
        return res.status(403).json({ message: "Session does not belong to this organization" });
      }

      await applyPlanToOrganization(organizationId, planCode, {
        stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
        stripeSubscriptionId:
          typeof session.subscription === "string"
            ? session.subscription
            : subscription?.id ?? null,
        currentPeriodStart: subscription?.current_period_start ?? null,
        currentPeriodEnd: subscription?.current_period_end ?? null,
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