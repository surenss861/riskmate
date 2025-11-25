import type { Request, Response } from "express";
import { supabase } from "../lib/supabaseClient";
import { limitsFor, PlanCode } from "../auth/planRules";

type StripeType = ReturnType<typeof require>;

const stripeFactory = (): StripeType => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }
  return require("stripe")(process.env.STRIPE_SECRET_KEY);
};

export async function applyPlanToOrganization(
  organizationId: string,
  plan: PlanCode,
  options: {
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    currentPeriodStart?: number | null;
    currentPeriodEnd?: number | null;
    status?: string | null;
    seatsLimitOverride?: number | null;
    jobsLimitOverride?: number | null;
  }
) {
  const limits = limitsFor(plan);
  const rawStatus = options.status?.toLowerCase() ?? "active";
  let status: string;
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

  const { error: orgSubError } = await supabase.from("org_subscriptions").upsert(
    {
      organization_id: organizationId,
      plan_code: plan,
      seats_limit: seatsLimit,
      jobs_limit_month: jobsLimit,
      status,
      stripe_customer_id: options.stripeCustomerId ?? null,
      stripe_subscription_id: options.stripeSubscriptionId ?? null,
      current_period_start: options.currentPeriodStart
        ? new Date(options.currentPeriodStart * 1000).toISOString()
        : null,
      current_period_end: options.currentPeriodEnd
        ? new Date(options.currentPeriodEnd * 1000).toISOString()
        : null,
      updated_at: timestamp,
    },
    { onConflict: "organization_id" }
  );

  if (orgSubError) {
    console.error("Failed to upsert org_subscriptions", orgSubError);
  }

  const { error: orgUpdateError } = await supabase
    .from("organizations")
    .update({
      subscription_tier: plan,
      subscription_status: status,
      updated_at: timestamp,
    })
    .eq("id", organizationId);

  if (orgUpdateError) {
    console.error("Failed to update organizations subscription tier", orgUpdateError);
  }

  const subscriptionPayload: Record<string, any> = {
    organization_id: organizationId,
    tier: plan,
    status,
    stripe_customer_id: options.stripeCustomerId ?? null,
    stripe_subscription_id: options.stripeSubscriptionId ?? null,
    current_period_start: options.currentPeriodStart
      ? new Date(options.currentPeriodStart * 1000).toISOString()
      : null,
    current_period_end: options.currentPeriodEnd
      ? new Date(options.currentPeriodEnd * 1000).toISOString()
      : null,
    updated_at: timestamp,
  };

  const { error: subsUpsertError } = await supabase
    .from("subscriptions")
    .upsert(subscriptionPayload, { onConflict: "organization_id" });

  if (subsUpsertError) {
    console.error("Failed to upsert subscriptions record", subsUpsertError);
  }
}

function extractPlanCode(value?: string | null): PlanCode | null {
  if (!value) return null;
  if (value === "starter" || value === "pro" || value === "business") {
    return value;
  }
  return null;
}

function extractMetadataPlan(metadata: Record<string, string | undefined> | null | undefined) {
  const plan = metadata?.plan_code ?? metadata?.plan ?? null;
  const organizationId = metadata?.organization_id ?? null;
  const userId = metadata?.user_id ?? null;
  return { plan: extractPlanCode(plan || undefined), organizationId, userId };
}

export async function stripeWebhookHandler(req: Request, res: Response) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("Missing STRIPE_WEBHOOK_SECRET");
    return res.status(500).json({ message: "Stripe webhook not configured" });
  }

  let stripe;
  try {
    stripe = stripeFactory();
  } catch (err: any) {
    console.error("Failed to init Stripe:", err?.message);
    return res.status(500).json({ message: "Stripe not configured" });
  }

  const signature = req.headers["stripe-signature"];
  if (!signature) {
    return res.status(400).send("Missing stripe-signature header");
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    console.error("Stripe webhook signature verification failed:", err?.message);
    return res.status(400).send(`Webhook Error: ${err?.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        if (!session?.metadata) break;
        const { plan, organizationId } = extractMetadataPlan(session.metadata);
        if (!plan || !organizationId) break;

        let subscription = session.subscription;
        if (typeof subscription === "string") {
          try {
            subscription = await stripe.subscriptions.retrieve(subscription);
          } catch {
            subscription = null;
          }
        }

        const status = subscription?.status ?? "active";

        await applyPlanToOrganization(organizationId, plan, {
          stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
          stripeSubscriptionId:
            typeof session.subscription === "string" ? session.subscription : null,
          currentPeriodStart: subscription?.current_period_start ?? null,
          currentPeriodEnd: subscription?.current_period_end ?? null,
          status,
        });
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as any;
        const { plan, organizationId } = extractMetadataPlan(subscription?.metadata);
        if (!plan || !organizationId) break;

        await applyPlanToOrganization(organizationId, plan, {
          stripeCustomerId:
            typeof subscription.customer === "string" ? subscription.customer : null,
          stripeSubscriptionId:
            typeof subscription.id === "string" ? subscription.id : null,
          currentPeriodStart: subscription.current_period_start ?? null,
          currentPeriodEnd: subscription.current_period_end ?? null,
          status: subscription.status ?? "active",
        });
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as any;
        const subscription = invoice.subscription as any;
        let metadataSource =
          invoice.lines?.data?.[0]?.metadata ??
          invoice.metadata ??
          (typeof subscription === "object" ? subscription.metadata : null);

        let { plan, organizationId } = extractMetadataPlan(metadataSource);
        if ((!plan || !organizationId) && typeof subscription === "string") {
          try {
            const subscriptionObj = await stripe.subscriptions.retrieve(subscription);
            metadataSource = subscriptionObj?.metadata ?? metadataSource;
            const extracted = extractMetadataPlan(metadataSource);
            plan = plan ?? extracted.plan;
            organizationId = organizationId ?? extracted.organizationId;
          } catch {
            /* ignore */
          }
        }
        if (!plan || !organizationId) break;

        await applyPlanToOrganization(organizationId, plan, {
          stripeCustomerId:
            typeof invoice.customer === "string" ? invoice.customer : null,
          stripeSubscriptionId:
            typeof invoice.subscription === "string" ? invoice.subscription : null,
          currentPeriodStart: invoice.lines?.data?.[0]?.period?.start ?? null,
          currentPeriodEnd: invoice.lines?.data?.[0]?.period?.end ?? null,
          status: "active",
        });
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as any;
        const subscription = invoice.subscription as any;
        let metadataSource =
          invoice.lines?.data?.[0]?.metadata ??
          invoice.metadata ??
          (typeof subscription === "object" ? subscription.metadata : null);

        let { plan, organizationId } = extractMetadataPlan(metadataSource);
        const subscriptionId =
          typeof subscription === "string"
            ? subscription
            : typeof subscription?.id === "string"
            ? subscription.id
            : null;

        if ((!plan || !organizationId) && subscriptionId) {
          try {
            const subscriptionObj = await stripe.subscriptions.retrieve(subscriptionId);
            metadataSource = subscriptionObj?.metadata ?? metadataSource;
            const extracted = extractMetadataPlan(metadataSource);
            plan = plan ?? extracted.plan;
            organizationId = organizationId ?? extracted.organizationId;
          } catch {
            /* ignore */
          }
        }
        if (!plan || !organizationId) break;

        await applyPlanToOrganization(organizationId, plan, {
          stripeCustomerId:
            typeof invoice.customer === "string" ? invoice.customer : null,
          stripeSubscriptionId:
            typeof invoice.subscription === "string" ? invoice.subscription : null,
          currentPeriodStart: invoice.lines?.data?.[0]?.period?.start ?? null,
          currentPeriodEnd: invoice.lines?.data?.[0]?.period?.end ?? null,
          status: "past_due",
        });
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        const { plan, organizationId } = extractMetadataPlan(subscription?.metadata);
        if (!plan || !organizationId) break;

        await applyPlanToOrganization(organizationId, plan, {
          stripeCustomerId:
            typeof subscription.customer === "string" ? subscription.customer : null,
          stripeSubscriptionId:
            typeof subscription.id === "string" ? subscription.id : null,
          currentPeriodStart: subscription.current_period_start ?? null,
          currentPeriodEnd: subscription.current_period_end ?? null,
          status: "canceled",
        });
        break;
      }
      default:
        break;
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error("Error handling Stripe webhook:", err?.message);
    res.status(500).json({ message: "Webhook handler error" });
  }
}

