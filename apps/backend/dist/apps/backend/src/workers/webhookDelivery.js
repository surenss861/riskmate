"use strict";
/**
 * Webhook delivery: enqueue deliveries for events, send with HMAC signature, retry with backoff.
 * Retry: 5min → 30min → 2hr → 24hr → fail. Alert org admin after 5 consecutive failures.
 * Secrets are read from webhook_endpoint_secrets (service-role only). Rotate SUPABASE_SERVICE_ROLE_KEY
 * regularly and restrict/audit service-role access.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOWED_WEBHOOK_EVENT_TYPES = void 0;
exports.validateWebhookEmitPayload = validateWebhookEmitPayload;
exports.buildWebhookPayload = buildWebhookPayload;
exports.deliverEvent = deliverEvent;
exports.sendDelivery = sendDelivery;
exports.wakeWebhookWorker = wakeWebhookWorker;
exports.startWebhookDeliveryWorker = startWebhookDeliveryWorker;
exports.stopWebhookDeliveryWorker = stopWebhookDeliveryWorker;
const crypto_1 = __importDefault(require("crypto"));
const supabaseClient_1 = require("../lib/supabaseClient");
const webhookSigning_1 = require("../utils/webhookSigning");
const secretEncryption_1 = require("../utils/secretEncryption");
const webhookUrl_1 = require("../utils/webhookUrl");
const email_1 = require("../utils/email");
const webhookPayloads_1 = require("../utils/webhookPayloads");
/** Delays after attempt N before attempt N+1: 1→2: 5min, 2→3: 30min, 3→4: 2hr, 4→5: 24hr. Index = nextAttempt - 2; guard for nextAttempt < 2 = immediate. */
const RETRY_DELAYS_AFTER_ATTEMPT_MS = [
    5 * 60 * 1000, // after attempt 1 → wait 5 min
    30 * 60 * 1000, // after attempt 2 → 30 min
    2 * 60 * 60 * 1000, // after attempt 3 → 2 hr
    24 * 60 * 60 * 1000, // after attempt 4 → 24 hr
];
const MAX_ATTEMPTS = 5;
const CONSECUTIVE_FAILURES_BEFORE_ALERT = 5;
const WEBHOOK_ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h dedupe
/** Debounce delay for wake-up: coalesce rapid enqueues into one immediate run. */
const WAKE_DEBOUNCE_MS = 100;
/** Claims older than this are considered stale (worker crashed); recovery will clear them so the row can be reclaimed. */
const STALE_CLAIM_MS = 10 * 60 * 1000; // 10 min
/** Max number of sendDelivery() calls in flight at once; avoids one slow endpoint blocking the queue. */
const DELIVERY_CONCURRENCY = Math.max(1, Math.min(10, parseInt(process.env.WEBHOOK_DELIVERY_CONCURRENCY || '5', 10)));
/** Escape HTML special characters to prevent injection when interpolating into HTML (e.g. admin alert email). */
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
/** Strict allowlist for internal emit endpoint; do not accept arbitrary event_type from callers. */
exports.ALLOWED_WEBHOOK_EVENT_TYPES = [
    'job.created',
    'job.updated',
    'job.completed',
    'job.deleted',
    'hazard.created',
    'hazard.updated',
    'signature.added',
    'report.generated',
    'evidence.uploaded',
    'team.member_added',
];
/**
 * Validate payload shape for internal emit. Ensures data is a non-null object and has required fields per event type.
 */
function validateWebhookEmitPayload(eventType, data) {
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        return { valid: false, message: 'data must be a non-null object' };
    }
    const obj = data;
    switch (eventType) {
        case 'job.created':
        case 'job.updated':
        case 'job.completed':
        case 'job.deleted':
        case 'hazard.created':
        case 'hazard.updated':
            if (typeof obj.id !== 'string') {
                return { valid: false, message: `${eventType} requires data.id (string)` };
            }
            break;
        case 'signature.added':
            if (typeof (obj.signoff_id ?? obj.id) !== 'string') {
                return { valid: false, message: 'signature.added requires data.signoff_id or data.id' };
            }
            break;
        case 'report.generated':
            if (typeof (obj.report_run_id ?? obj.id) !== 'string') {
                return { valid: false, message: 'report.generated requires data.report_run_id or data.id' };
            }
            break;
        case 'evidence.uploaded':
            if (typeof (obj.id ?? obj.document_id) !== 'string') {
                return { valid: false, message: 'evidence.uploaded requires data.id or data.document_id' };
            }
            break;
        case 'team.member_added':
            if (typeof (obj.user_id ?? obj.id) !== 'string') {
                return { valid: false, message: 'team.member_added requires data.user_id or data.id' };
            }
            break;
        default:
            return { valid: false, message: `unknown event_type: ${eventType}` };
    }
    return { valid: true };
}
/**
 * Build the standard event payload envelope.
 */
function buildWebhookPayload(eventType, organizationId, data) {
    return {
        id: `evt_${crypto_1.default.randomUUID()}`,
        type: eventType,
        created: new Date().toISOString(),
        organization_id: organizationId,
        data: { object: data },
    };
}
/**
 * Find active endpoints for org that subscribe to this event type; create one delivery row per endpoint.
 * Used by Express backend only. Next.js uses triggerWebhookEvent (lib/webhooks/trigger.ts). Do not call both for the same logical operation — each request path must emit from one stack only to avoid duplicate deliveries.
 */
async function deliverEvent(orgId, eventType, data) {
    const normalized = (0, webhookPayloads_1.buildWebhookEventObject)(eventType, data);
    const payload = buildWebhookPayload(eventType, orgId, normalized);
    const { data: endpoints, error: fetchError } = await supabaseClient_1.supabase
        .from('webhook_endpoints')
        .select('id, organization_id, url, events, is_active')
        .eq('organization_id', orgId)
        .eq('is_active', true);
    if (fetchError) {
        console.error('[WebhookDelivery] Fetch endpoints failed:', fetchError);
        throw new Error(`Webhook endpoints fetch failed: ${fetchError.message}`);
    }
    const filtered = (endpoints || []).filter((e) => e.events && e.events.includes(eventType));
    if (filtered.length === 0)
        return;
    const nextRetryAt = new Date().toISOString();
    const rows = filtered.map((ep) => ({
        endpoint_id: ep.id,
        event_type: eventType,
        payload: payload,
        attempt_count: 1,
        next_retry_at: nextRetryAt,
    }));
    const { error: insertError } = await supabaseClient_1.supabase.from('webhook_deliveries').insert(rows);
    if (insertError) {
        console.error('[WebhookDelivery] Batched insert deliveries failed:', insertError);
        throw new Error(`Webhook deliveries insert failed: ${insertError.message}`);
    }
    wakeWebhookWorker();
}
/**
 * Record one send attempt in webhook_delivery_attempts for immutable per-attempt history.
 * Uses upsert so re-runs (e.g. after stale-claim recovery) are idempotent.
 */
async function recordAttempt(deliveryId, attemptNumber, responseStatus, responseBody, durationMs) {
    await supabaseClient_1.supabase.from('webhook_delivery_attempts').upsert({
        delivery_id: deliveryId,
        attempt_number: attemptNumber,
        response_status: responseStatus,
        response_body: responseBody,
        duration_ms: durationMs,
    }, {
        onConflict: 'delivery_id,attempt_number',
    });
}
/**
 * Send one delivery: POST to endpoint URL with signed payload, update row, record attempt.
 * If the endpoint is inactive (paused), does not send; terminalizes the delivery with a clear message.
 */
async function sendDelivery(delivery) {
    const { data: endpoint, error: epError } = await supabaseClient_1.supabase
        .from('webhook_endpoints')
        .select('url, is_active')
        .eq('id', delivery.endpoint_id)
        .single();
    const { data: secretRow, error: secretError } = await supabaseClient_1.supabase
        .from('webhook_endpoint_secrets')
        .select('secret')
        .eq('endpoint_id', delivery.endpoint_id)
        .maybeSingle();
    const rawSecret = secretRow?.secret ?? null;
    const keyHex = process.env.WEBHOOK_SECRET_ENCRYPTION_KEY;
    const secret = rawSecret != null ? (0, secretEncryption_1.decryptWebhookSecret)(rawSecret, keyHex) : null;
    const endpointWithSecret = endpoint ? { ...endpoint, secret } : null;
    // Query failures (endpoint or secret fetch error) → retryable. Permanent states → terminal.
    if (epError) {
        const isEndpointMissing = epError.code === 'PGRST116';
        const reason = isEndpointMissing
            ? 'Endpoint not found (deleted)'
            : `Endpoint fetch failed (transient): ${epError.message}`;
        console.error('[WebhookDelivery]', reason, delivery.endpoint_id);
        await recordAttempt(delivery.id, delivery.attempt_count, null, reason, 0);
        if (isEndpointMissing) {
            await supabaseClient_1.supabase
                .from('webhook_deliveries')
                .update({
                response_status: null,
                response_body: reason,
                duration_ms: 0,
                next_retry_at: null,
                processing_since: null,
                terminal_outcome: 'failed',
            })
                .eq('id', delivery.id);
        }
        else {
            await updateDeliveryFailure(delivery.id, delivery.endpoint_id, null, reason, 0, delivery.attempt_count, false, 'failed', false);
        }
        return;
    }
    if (secretError) {
        const reason = `Secret fetch failed (transient): ${secretError.message}`;
        console.error('[WebhookDelivery]', reason, delivery.endpoint_id);
        await recordAttempt(delivery.id, delivery.attempt_count, null, reason, 0);
        await updateDeliveryFailure(delivery.id, delivery.endpoint_id, null, reason, 0, delivery.attempt_count, false, 'failed', false);
        return;
    }
    if (!endpoint || !endpointWithSecret || !secret) {
        const reason = 'Endpoint has no secret';
        console.error('[WebhookDelivery]', reason, delivery.endpoint_id);
        await recordAttempt(delivery.id, delivery.attempt_count, null, reason, 0);
        await supabaseClient_1.supabase
            .from('webhook_deliveries')
            .update({
            response_status: null,
            response_body: reason,
            duration_ms: 0,
            next_retry_at: null,
            processing_since: null,
            terminal_outcome: 'failed',
        })
            .eq('id', delivery.id);
        return;
    }
    if (endpointWithSecret.is_active === false) {
        const msg = 'Endpoint is paused; delivery cancelled';
        console.log('[WebhookDelivery] Endpoint paused, cancelling delivery:', delivery.id, delivery.endpoint_id);
        await recordAttempt(delivery.id, delivery.attempt_count, null, msg, 0);
        await supabaseClient_1.supabase
            .from('webhook_deliveries')
            .update({
            response_status: null,
            response_body: msg,
            duration_ms: 0,
            next_retry_at: null,
            processing_since: null,
            terminal_outcome: 'cancelled_paused',
        })
            .eq('id', delivery.id);
        return;
    }
    const urlCheck = await (0, webhookUrl_1.validateWebhookUrl)(endpointWithSecret.url);
    if (!urlCheck.valid) {
        const forceTerminal = urlCheck.terminal; // only true for explicit policy (SSRF/blocked); DNS/transient → retry
        console.error('[WebhookDelivery]', forceTerminal ? 'Blocked unsafe URL' : 'URL validation failed (transient)', delivery.endpoint_id, urlCheck.reason);
        await recordAttempt(delivery.id, delivery.attempt_count, null, `Blocked: ${urlCheck.reason}`, 0);
        await updateDeliveryFailure(delivery.id, delivery.endpoint_id, null, `Blocked: ${urlCheck.reason}`, 0, delivery.attempt_count, forceTerminal, forceTerminal ? 'cancelled_policy' : 'failed');
        return;
    }
    const payloadStr = JSON.stringify(delivery.payload);
    const headers = (0, webhookSigning_1.buildSignatureHeaders)(payloadStr, secret);
    const start = Date.now();
    let responseStatus = null;
    let responseBody = null;
    try {
        const res = await fetch(endpoint.url, {
            method: 'POST',
            headers,
            body: payloadStr,
            signal: AbortSignal.timeout(30000),
            redirect: 'manual',
        });
        responseStatus = res.status;
        responseBody = await res.text().catch(() => null);
        const durationMs = Date.now() - start;
        await recordAttempt(delivery.id, delivery.attempt_count, responseStatus, responseBody, durationMs);
        const success = res.ok;
        if (success) {
            await updateDeliveryResult(delivery.id, delivery.endpoint_id, responseStatus, responseBody, durationMs);
        }
        else {
            await updateDeliveryFailure(delivery.id, delivery.endpoint_id, responseStatus, responseBody, durationMs, delivery.attempt_count, false, 'failed');
        }
    }
    catch (err) {
        const durationMs = Date.now() - start;
        const msg = err instanceof Error ? err.message : String(err);
        responseBody = msg;
        await recordAttempt(delivery.id, delivery.attempt_count, null, responseBody, durationMs);
        await updateDeliveryFailure(delivery.id, delivery.endpoint_id, null, responseBody, durationMs, delivery.attempt_count, false, 'failed');
        console.error('[WebhookDelivery] Send failed:', delivery.id, msg);
    }
}
/** Success: single atomic update — response fields, delivered_at, clear retry and claim; reset consecutive_failures for endpoint. */
async function updateDeliveryResult(deliveryId, endpointId, responseStatus, responseBody, durationMs) {
    await supabaseClient_1.supabase
        .from('webhook_deliveries')
        .update({
        response_status: responseStatus,
        response_body: responseBody,
        duration_ms: durationMs,
        delivered_at: new Date().toISOString(),
        next_retry_at: null,
        processing_since: null,
        terminal_outcome: 'delivered',
    })
        .eq('id', deliveryId);
    const now = new Date().toISOString();
    await supabaseClient_1.supabase.from('webhook_endpoint_alert_state').upsert({ endpoint_id: endpointId, consecutive_failures: 0, updated_at: now }, { onConflict: 'endpoint_id' });
}
/**
 * Failure: single atomic update — response fields, attempt_count, next_retry_at, and claim release.
 * No intermediate write that clears processing_since alone, avoiding duplicate claims and resends.
 * When forceTerminal is true (e.g. blocked URL), no retries are scheduled.
 * terminalOutcomeReason: 'failed' for retry exhaustion or missing endpoint; 'cancelled_policy' for policy blocks (e.g. blocked URL).
 * countAsConsecutiveFailure: when false (e.g. secret fetch or endpoint fetch transient errors), do not increment consecutive_failures so infrastructure blips do not trigger admin alerts.
 * attempt_count: when terminal (including retry exhaustion), we persist the attempt just executed (currentAttemptCount), not nextAttempt, so it never exceeds MAX_ATTEMPTS.
 */
async function updateDeliveryFailure(deliveryId, endpointId, responseStatus, responseBody, durationMs, currentAttemptCount, forceTerminal = false, terminalOutcomeReason = 'failed', countAsConsecutiveFailure = true) {
    const nextAttempt = currentAttemptCount + 1;
    const terminal = forceTerminal || nextAttempt > MAX_ATTEMPTS;
    const delayMs = nextAttempt < 2
        ? 0
        : (RETRY_DELAYS_AFTER_ATTEMPT_MS[nextAttempt - 2] ?? RETRY_DELAYS_AFTER_ATTEMPT_MS[RETRY_DELAYS_AFTER_ATTEMPT_MS.length - 1]);
    const nextRetryAt = terminal ? null : new Date(Date.now() + delayMs).toISOString();
    const attemptCountToPersist = terminal ? currentAttemptCount : nextAttempt;
    const updatePayload = {
        response_status: responseStatus,
        response_body: responseBody,
        duration_ms: durationMs,
        delivered_at: null,
        attempt_count: attemptCountToPersist,
        next_retry_at: nextRetryAt,
        processing_since: null,
    };
    if (terminal) {
        updatePayload.terminal_outcome = terminalOutcomeReason;
    }
    await supabaseClient_1.supabase
        .from('webhook_deliveries')
        .update(updatePayload)
        .eq('id', deliveryId);
    // Atomic increment on terminal failure only when it counts as a real delivery failure (not infrastructure transient).
    // Alert only when returned count reaches threshold.
    if (terminal && countAsConsecutiveFailure) {
        const { data: newCount, error: rpcError } = await supabaseClient_1.supabase.rpc('increment_webhook_endpoint_consecutive_failures', { p_endpoint_id: endpointId });
        if (rpcError) {
            console.error('[WebhookDelivery] Atomic increment consecutive_failures failed:', rpcError);
            return;
        }
        const count = typeof newCount === 'number' ? newCount : 0;
        if (count >= CONSECUTIVE_FAILURES_BEFORE_ALERT) {
            await maybeAlertAdmin(endpointId);
        }
    }
}
/**
 * Alert org admins only after 5 consecutive terminal failures for this endpoint.
 * Cooldown prevents spamming. Resets consecutive_failures after sending so next 5 trigger again.
 */
async function maybeAlertAdmin(endpointId) {
    const { data: endpoint, error: epError } = await supabaseClient_1.supabase
        .from('webhook_endpoints')
        .select('id, organization_id, url')
        .eq('id', endpointId)
        .single();
    if (epError || !endpoint)
        return;
    const { data: alertState } = await supabaseClient_1.supabase
        .from('webhook_endpoint_alert_state')
        .select('last_alert_at, consecutive_failures')
        .eq('endpoint_id', endpointId)
        .maybeSingle();
    const consecutiveFailures = alertState?.consecutive_failures ?? 0;
    if (consecutiveFailures < CONSECUTIVE_FAILURES_BEFORE_ALERT) {
        return;
    }
    // Cooldown applies only when a real alert was sent (last_alert_at set after sendEmail succeeded).
    if (alertState?.last_alert_at != null) {
        const lastAlertAt = new Date(alertState.last_alert_at).getTime();
        if (Date.now() - lastAlertAt < WEBHOOK_ALERT_COOLDOWN_MS) {
            return;
        }
    }
    // Include admins/owners from users.organization_id and from organization_members (multi-org).
    const recipientEmails = new Set();
    const { data: usersAsAdmins } = await supabaseClient_1.supabase
        .from('users')
        .select('id, email')
        .eq('organization_id', endpoint.organization_id)
        .in('role', ['owner', 'admin'])
        .not('email', 'is', null);
    for (const u of usersAsAdmins ?? []) {
        if (u.email)
            recipientEmails.add(u.email);
    }
    const { data: orgMemberAdmins } = await supabaseClient_1.supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', endpoint.organization_id)
        .in('role', ['owner', 'admin']);
    const memberUserIds = (orgMemberAdmins ?? []).map((m) => m.user_id).filter(Boolean);
    if (memberUserIds.length > 0) {
        const { data: memberUsers } = await supabaseClient_1.supabase
            .from('users')
            .select('email')
            .in('id', memberUserIds)
            .not('email', 'is', null);
        for (const u of memberUsers ?? []) {
            if (u.email)
                recipientEmails.add(u.email);
        }
    }
    const toList = Array.from(recipientEmails);
    if (toList.length === 0)
        return;
    const subject = 'Riskmate: Webhook delivery failures';
    const html = `
    <p>Your webhook endpoint has had ${CONSECUTIVE_FAILURES_BEFORE_ALERT} consecutive delivery failures.</p>
    <p><strong>Endpoint URL:</strong> ${escapeHtml(endpoint.url || '(not set)')}</p>
    <p>Please check your endpoint URL, secret, and server logs. You can view delivery history and retry failed deliveries in Riskmate settings.</p>
  `;
    try {
        await (0, email_1.sendEmail)({
            to: toList,
            subject,
            html,
        });
        const now = new Date().toISOString();
        await supabaseClient_1.supabase.from('webhook_endpoint_alert_state').upsert({
            endpoint_id: endpointId,
            last_alert_at: now,
            updated_at: now,
            consecutive_failures: 0,
        }, { onConflict: 'endpoint_id' });
    }
    catch (err) {
        console.error('[WebhookDelivery] Admin alert email failed:', err);
    }
}
/**
 * Atomically claim a pending delivery row so only one worker tick processes it.
 * Returns the updated row if claimed, null if already claimed or delivered.
 */
async function claimDelivery(id) {
    const now = new Date().toISOString();
    const { data, error } = await supabaseClient_1.supabase
        .from('webhook_deliveries')
        .update({ processing_since: now })
        .eq('id', id)
        .is('delivered_at', null)
        .is('processing_since', null)
        .select('*')
        .maybeSingle();
    if (error || !data)
        return null;
    return data;
}
/**
 * Reset stale claims so rows stuck after a worker crash can be picked again.
 * Idempotent: only clears processing_since when it is older than STALE_CLAIM_MS; actively processing rows are untouched.
 */
async function recoverStaleClaims() {
    const staleBefore = new Date(Date.now() - STALE_CLAIM_MS).toISOString();
    const { error } = await supabaseClient_1.supabase
        .from('webhook_deliveries')
        .update({ processing_since: null })
        .is('delivered_at', null)
        .not('processing_since', 'is', null)
        .lt('processing_since', staleBefore);
    if (error) {
        console.error('[WebhookDelivery] Stale claim recovery failed:', error);
    }
}
/**
 * Run async tasks with bounded concurrency. Used so one slow endpoint does not block others.
 */
async function runWithConcurrency(items, concurrency, fn) {
    let index = 0;
    const worker = async () => {
        while (true) {
            const i = index++;
            if (i >= items.length)
                return;
            await fn(items[i]);
        }
    };
    const workers = Math.min(concurrency, items.length);
    if (workers <= 0)
        return;
    await Promise.all(Array.from({ length: workers }, () => worker()));
}
/**
 * Process pending deliveries: those with delivered_at IS NULL, next_retry_at <= now,
 * and attempt_count <= MAX_ATTEMPTS so the final (5th) scheduled attempt is processed; terminally failed have next_retry_at = null.
 * Claims rows first (one-by-one to preserve claim semantics), then dispatches sendDelivery() with bounded concurrency so one slow
 * endpoint does not block others. Stale-claim recovery runs first so rows stuck after a worker crash become reclaimable.
 */
let processPendingDeliveriesRunning = false;
async function processPendingDeliveries() {
    if (processPendingDeliveriesRunning)
        return;
    processPendingDeliveriesRunning = true;
    try {
        await recoverStaleClaims();
        const now = new Date().toISOString();
        const { data: pending, error } = await supabaseClient_1.supabase
            .from('webhook_deliveries')
            .select('id')
            .is('delivered_at', null)
            .is('processing_since', null)
            .not('next_retry_at', 'is', null)
            .lte('next_retry_at', now)
            .lte('attempt_count', MAX_ATTEMPTS)
            .is('terminal_outcome', null)
            .order('created_at', { ascending: true })
            .limit(50);
        if (error) {
            console.error('[WebhookDelivery] Fetch pending failed:', error);
            return;
        }
        const claimed = [];
        for (const row of pending || []) {
            const c = await claimDelivery(row.id);
            if (c)
                claimed.push(c);
        }
        await runWithConcurrency(claimed, DELIVERY_CONCURRENCY, sendDelivery);
    }
    finally {
        try {
            // no-op; ensures any future code in finally cannot prevent flag reset
        }
        finally {
            processPendingDeliveriesRunning = false;
        }
    }
}
let workerInterval = null;
let wakeDebounceTimer = null;
/**
 * Schedule an immediate, debounced run of the delivery worker so fresh enqueues are processed
 * without waiting for the next interval tick. Safe to call from both deliverEvent() and from
 * the internal wake endpoint (Next.js trigger path). Reuses processPendingDeliveriesRunning guard.
 */
function wakeWebhookWorker() {
    if (wakeDebounceTimer)
        clearTimeout(wakeDebounceTimer);
    wakeDebounceTimer = setTimeout(() => {
        wakeDebounceTimer = null;
        processPendingDeliveries().catch((e) => console.error('[WebhookDelivery] Wake run error:', e));
    }, WAKE_DEBOUNCE_MS);
}
function startWebhookDeliveryWorker() {
    if (workerInterval)
        return;
    // Backend supabase client must use SUPABASE_SERVICE_ROLE_KEY so webhook_endpoint_secrets (service-role only) is readable
    const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
    if (!key) {
        console.error('[WebhookDelivery] SUPABASE_SERVICE_ROLE_KEY is missing; secret fetch will fail');
    }
    else {
        console.log('[WebhookDelivery] Supabase client: service role (secrets accessible)');
    }
    // Default 2s gives headroom below 5s SLA; periodic poll remains as fallback
    const intervalMs = Math.max(2000, parseInt(process.env.WEBHOOK_WORKER_INTERVAL_MS || '2000', 10));
    workerInterval = setInterval(() => {
        processPendingDeliveries().catch((e) => console.error('[WebhookDelivery] Worker tick error:', e));
    }, intervalMs);
    processPendingDeliveries().catch((e) => console.error('[WebhookDelivery] Worker initial run:', e));
    console.log('[WebhookDelivery] Worker started, interval=%dms', intervalMs);
}
function stopWebhookDeliveryWorker() {
    if (workerInterval) {
        clearInterval(workerInterval);
        workerInterval = null;
    }
}
//# sourceMappingURL=webhookDelivery.js.map