import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'crypto'

export const runtime = 'nodejs'

// Rate limiting: simple in-memory store (use Redis in production)
const reconcileRateLimit = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 5 // Max 5 requests per minute per IP

function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }
  return new Stripe(secretKey, {
    apiVersion: '2025-10-29.clover',
  })
}

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

/**
 * POST /api/subscriptions/reconcile
 * 
 * Reconciliation job to ensure Stripe ↔ Database consistency.
 * 
 * PROTECTED: Requires RECONCILE_SECRET in Authorization header
 * RATE LIMITED: Max 5 requests per minute per IP
 * MAX LOOKBACK: 24 hours (configurable via query param, max 168 hours)
 * 
 * Looks for:
 * - Stripe sessions completed in last X hours without DB subscription
 * - DB subscriptions active but Stripe subscription missing/inactive
 * - Status mismatches between Stripe and DB
 * 
 * This is a "never wake up to a billing bug" safety net.
 * 
 * Should be called by:
 * - Cron job (hourly recommended) with RECONCILE_SECRET
 * - Manual admin trigger
 * - After webhook failures
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let reconciliationLogId: string | null = null

  // Generate request ID for correlation
  const requestId = crypto.randomUUID()

  try {
    // 1. AUTH: Require RECONCILE_SECRET with constant-time comparison
    const authHeader = request.headers.get('authorization')
    const reconcileSecret = process.env.RECONCILE_SECRET

    if (!reconcileSecret) {
      console.error('[Reconcile] RECONCILE_SECRET not configured', { request_id: requestId })
      return NextResponse.json(
        { error: 'Reconciliation not configured', request_id: requestId },
        { status: 503 }
      )
    }

    // Reject missing/invalid Authorization format
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('[Reconcile] Missing or invalid Authorization header', { request_id: requestId })
      return NextResponse.json(
        { error: 'Unauthorized - Missing or invalid Authorization header. Expected: Authorization: Bearer <secret>', request_id: requestId },
        { status: 401 }
      )
    }

    const providedSecret = authHeader.split('Bearer ')[1]?.trim()
    
    // Constant-time secret comparison (prevents timing attacks)
    if (!providedSecret || providedSecret.length !== reconcileSecret.length) {
      // Use constant-time comparison even for length mismatch
      // Create buffers of same length to prevent timing leaks
      const secretBuffer = Buffer.from(reconcileSecret)
      const providedBuffer = Buffer.alloc(secretBuffer.length)
      Buffer.from(providedSecret || '').copy(providedBuffer, 0, 0, Math.min(providedSecret?.length || 0, secretBuffer.length))
      timingSafeEqual(providedBuffer, secretBuffer) // Always compare, even if lengths differ
      console.warn('[Reconcile] Invalid reconcile secret attempted (length mismatch)', { request_id: requestId })
      return NextResponse.json(
        { error: 'Unauthorized - Invalid secret', request_id: requestId },
        { status: 401 }
      )
    }

    // Constant-time comparison
    const secretsMatch = timingSafeEqual(
      Buffer.from(providedSecret),
      Buffer.from(reconcileSecret)
    )

    if (!secretsMatch) {
      console.warn('[Reconcile] Invalid reconcile secret attempted', { request_id: requestId })
      return NextResponse.json(
        { error: 'Unauthorized - Invalid secret', request_id: requestId },
        { status: 401 }
      )
    }

    // 2. RATE LIMIT: Per IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               request.headers.get('x-real-ip') || 
               'unknown'
    
    // Log request start
    console.info('[Reconcile] Request started', {
      request_id: requestId,
      ip,
      user_agent: request.headers.get('user-agent'),
    })
    
    const now = Date.now()
    const rateLimitKey = `reconcile:${ip}`
    const rateLimit = reconcileRateLimit.get(rateLimitKey)

    if (rateLimit && rateLimit.resetAt > now) {
      if (rateLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
        return NextResponse.json(
          { 
            error: 'Rate limit exceeded',
            retry_after: Math.ceil((rateLimit.resetAt - now) / 1000),
          },
          { status: 429 }
        )
      }
      rateLimit.count++
    } else {
      reconcileRateLimit.set(rateLimitKey, {
        count: 1,
        resetAt: now + RATE_LIMIT_WINDOW_MS,
      })
    }

    // Clean up old rate limit entries (simple cleanup)
    for (const [key, value] of reconcileRateLimit.entries()) {
      if (value.resetAt < now) {
        reconcileRateLimit.delete(key)
      }
    }

    // 3. MAX LOOKBACK: Parse query param, enforce max
    const { searchParams } = new URL(request.url)
    const requestedHours = parseInt(searchParams.get('hours') || '24', 10)
    const MAX_LOOKBACK_HOURS = 168 // 7 days max
    const hours = Math.min(Math.max(1, requestedHours), MAX_LOOKBACK_HOURS) // Clamp between 1 and 168

    const runType = searchParams.get('type') || 'scheduled' // 'scheduled', 'manual', 'webhook_failure'

    const stripe = getStripeClient()
    const since = Math.floor((Date.now() - hours * 60 * 60 * 1000) / 1000)

    // Create reconciliation log entry
    const serviceSupabase = getServiceSupabase()
    const { data: logEntry, error: logError } = await serviceSupabase
      .from('reconciliation_logs')
      .insert({
        run_type: runType,
        lookback_hours: hours,
        status: 'running',
        metadata: {
          ip,
          user_agent: request.headers.get('user-agent'),
        },
      })
      .select()
      .single()

    if (logError) {
      console.error('[Reconcile] Failed to create log entry:', logError)
      // Continue anyway - logging is non-critical
    } else {
      reconciliationLogId = logEntry.id
    }

    const reconciliations: Array<{
      type: string
      organization_id: string
      stripe_subscription_id: string | null
      issue: string
      fixed: boolean
      action_taken?: string
    }> = []

    let createdCount = 0
    let updatedCount = 0
    let mismatchCount = 0
    const errors: Array<{ type: string; message: string; details?: any }> = []

    const supabase = await createSupabaseServerClient()

    // 1. Find completed Stripe checkout sessions without DB subscription
    // Use pagination to handle large volumes
    let hasMore = true
    let startingAfter: string | undefined = undefined
    const maxSessions = 1000 // Safety limit
    let processedSessions = 0

    while (hasMore && processedSessions < maxSessions) {
      try {
        const sessionList: Stripe.Response<Stripe.ApiList<Stripe.Checkout.Session>> = await stripe.checkout.sessions.list({
          created: { gte: since },
          status: 'complete',
          limit: 100,
          starting_after: startingAfter,
        })

        for (const session of sessionList.data) {
          if (!session.subscription || !session.metadata?.organization_id) {
            continue
          }

          const organizationId = session.metadata.organization_id
          const stripeSubscriptionId = session.subscription as string

          // Check if subscription exists in DB
          const { data: subscription } = await serviceSupabase
            .from('subscriptions')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('stripe_subscription_id', stripeSubscriptionId)
            .maybeSingle()

          if (!subscription) {
            // Try to create missing subscription (idempotent upsert)
            try {
              // Get Stripe subscription to get full details
              const stripeSub: Stripe.Subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId)
              const planCode = session.metadata.plan || 'starter'

              // Upsert subscription (idempotent)
              const { error: upsertError } = await serviceSupabase
                .from('subscriptions')
                .upsert({
                  organization_id: organizationId,
                  stripe_subscription_id: stripeSubscriptionId,
                  stripe_customer_id: typeof stripeSub.customer === 'string' ? stripeSub.customer : stripeSub.customer.id,
                  tier: planCode,
                  status: stripeSub.status === 'active' || stripeSub.status === 'trialing' ? 'active' : stripeSub.status,
                  current_period_start: new Date((stripeSub.current_period_start || 0) * 1000).toISOString(),
                  current_period_end: new Date((stripeSub.current_period_end || 0) * 1000).toISOString(),
                }, {
                  onConflict: 'organization_id,stripe_subscription_id',
                })

              if (upsertError) {
                errors.push({
                  type: 'create_subscription_failed',
                  message: `Failed to create subscription for org ${organizationId}`,
                  details: upsertError,
                })
                reconciliations.push({
                  type: 'missing_subscription',
                  organization_id: organizationId,
                  stripe_subscription_id: stripeSubscriptionId,
                  issue: `Stripe session ${session.id} completed but no DB subscription found`,
                  fixed: false,
                })
              } else {
                createdCount++
                reconciliations.push({
                  type: 'missing_subscription',
                  organization_id: organizationId,
                  stripe_subscription_id: stripeSubscriptionId,
                  issue: `Stripe session ${session.id} completed but no DB subscription found`,
                  fixed: true,
                  action_taken: 'Created missing subscription',
                })
              }
            } catch (createErr: any) {
              errors.push({
                type: 'create_subscription_error',
                message: `Error creating subscription: ${createErr.message}`,
                details: createErr,
              })
              reconciliations.push({
                type: 'missing_subscription',
                organization_id: organizationId,
                stripe_subscription_id: stripeSubscriptionId,
                issue: `Stripe session ${session.id} completed but no DB subscription found`,
                fixed: false,
              })
            }
          }
        }

        processedSessions += sessionList.data.length
        hasMore = sessionList.has_more
        if (sessionList.data.length > 0) {
          startingAfter = sessionList.data[sessionList.data.length - 1].id
        }
      } catch (listErr: any) {
        errors.push({
          type: 'list_sessions_error',
          message: `Error listing Stripe sessions: ${listErr.message}`,
          details: listErr,
        })
        hasMore = false
      }
    }

    // 2. Find DB subscriptions that don't match Stripe status
    const { data: dbSubscriptions, error: dbError } = await serviceSupabase
      .from('subscriptions')
      .select('*')
      .not('stripe_subscription_id', 'is', null)
      .limit(500) // Safety limit

    if (dbError) {
      errors.push({
        type: 'fetch_db_subscriptions_error',
        message: `Failed to fetch DB subscriptions: ${dbError.message}`,
        details: dbError,
      })
    } else {
      for (const dbSub of dbSubscriptions || []) {
        if (!dbSub.stripe_subscription_id) continue

        try {
          const stripeSub = await stripe.subscriptions.retrieve(dbSub.stripe_subscription_id)

          // Check for status mismatch
          const stripeStatus = stripeSub.status
          const dbStatus = dbSub.status

          // Normalize: Stripe 'active'/'trialing' = DB 'active'
          const normalizedStripeStatus = stripeStatus === 'trialing' ? 'active' : stripeStatus
          const normalizedDbStatus = dbStatus === 'trialing' ? 'active' : dbStatus

          if (normalizedStripeStatus !== normalizedDbStatus) {
            mismatchCount++
            
            // Update DB to match Stripe (idempotent, non-destructive)
            const { error: updateError } = await serviceSupabase
              .from('subscriptions')
              .update({
                status: normalizedStripeStatus,
                current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString(),
                current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
              })
              .eq('id', dbSub.id)

            if (updateError) {
              errors.push({
                type: 'update_status_error',
                message: `Failed to update subscription status: ${updateError.message}`,
                details: updateError,
              })
              reconciliations.push({
                type: 'status_mismatch',
                organization_id: dbSub.organization_id,
                stripe_subscription_id: dbSub.stripe_subscription_id,
                issue: `DB status=${dbStatus} but Stripe status=${stripeStatus}`,
                fixed: false,
              })
            } else {
              updatedCount++
              reconciliations.push({
                type: 'status_mismatch',
                organization_id: dbSub.organization_id,
                stripe_subscription_id: dbSub.stripe_subscription_id,
                issue: `DB status=${dbStatus} but Stripe status=${stripeStatus}`,
                fixed: true,
                action_taken: `Updated DB status to ${normalizedStripeStatus}`,
              })
            }
          }
        } catch (err: any) {
          if (err.code === 'resource_missing') {
            mismatchCount++
            reconciliations.push({
              type: 'stripe_subscription_missing',
              organization_id: dbSub.organization_id,
              stripe_subscription_id: dbSub.stripe_subscription_id,
              issue: `DB has subscription but Stripe subscription not found`,
              fixed: false, // Don't auto-delete - manual review needed
            })
          } else {
            errors.push({
              type: 'retrieve_stripe_subscription_error',
              message: `Error retrieving Stripe subscription: ${err.message}`,
              details: err,
            })
          }
        }
      }
    }

    const completedAt = new Date().toISOString()
    const durationMs = Date.now() - startTime
    const status = errors.length > 0 ? 'partial' : (mismatchCount > 0 ? 'partial' : 'success')

    // Update reconciliation log
    if (reconciliationLogId) {
      await serviceSupabase
        .from('reconciliation_logs')
        .update({
          completed_at: completedAt,
          status,
          created_count: createdCount,
          updated_count: updatedCount,
          mismatch_count: mismatchCount,
          error_count: errors.length,
          errors,
          reconciliations,
        })
        .eq('id', reconciliationLogId)
    }

    // Create billing alert if drift found
    if (mismatchCount > 0 || createdCount > 0) {
      await serviceSupabase
        .from('billing_alerts')
        .insert({
          alert_type: 'reconcile_drift',
          severity: mismatchCount > 10 ? 'critical' : 'warning',
          message: `Reconciliation found ${mismatchCount} mismatches, ${createdCount} missing subscriptions`,
          metadata: {
            reconciliation_log_id: reconciliationLogId,
            mismatch_count: mismatchCount,
            created_count: createdCount,
            updated_count: updatedCount,
          },
        })
    }

    console.info('[Reconcile] Completed reconciliation', {
      request_id: requestId,
      ip,
      lookback_hours: hours,
      run_type: runType,
      duration_ms: durationMs,
      created_count: createdCount,
      updated_count: updatedCount,
      mismatch_count: mismatchCount,
      error_count: errors.length,
      total_issues: reconciliations.length,
      reconciliation_log_id: reconciliationLogId,
    })

    return NextResponse.json({
      success: true,
      reconciliation_log_id: reconciliationLogId,
      lookback_hours: hours,
      created_count: createdCount,
      updated_count: updatedCount,
      mismatch_count: mismatchCount,
      error_count: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      reconciliations,
      total_issues: reconciliations.length,
      duration_ms: durationMs,
      message: reconciliations.length === 0
        ? 'No issues found - Stripe and DB are in sync'
        : `${reconciliations.length} issue(s) found, ${createdCount} created, ${updatedCount} updated`,
    })
  } catch (error: any) {
    console.error('[Reconcile] Error:', error)
    
    // Update log if it exists
    if (reconciliationLogId) {
      const serviceSupabase = getServiceSupabase()
      await serviceSupabase
        .from('reconciliation_logs')
        .update({
          completed_at: new Date().toISOString(),
          status: 'error',
          error_count: 1,
          errors: [{ type: 'unexpected_error', message: error.message, details: error.stack }],
        })
        .eq('id', reconciliationLogId)
    }

    return NextResponse.json(
      { error: error.message || 'Failed to reconcile subscriptions' },
      { status: 500 }
    )
  }
}
