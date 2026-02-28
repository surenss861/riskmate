/**
 * Internal webhook emit: called by backend when it creates/updates resources.
 * POST /api/webhooks/emit { organization_id, event_type, data }
 * Requires internal credential (WEBHOOK_EMIT_SECRET); not callable by standard end-user JWTs.
 */

import crypto from 'node:crypto'
import express, { type Router as ExpressRouter } from 'express'
import { deliverEvent, ALLOWED_WEBHOOK_EVENT_TYPES, validateWebhookEmitPayload } from '../workers/webhookDelivery'

export const webhooksRouter: ExpressRouter = express.Router()

const ALLOWED_SET = new Set<string>(ALLOWED_WEBHOOK_EVENT_TYPES as unknown as string[])

/**
 * Middleware: require internal service-to-service secret. Rejects standard JWT auth for /emit
 * so that only trusted server code (or callers with WEBHOOK_EMIT_SECRET) can trigger deliveries.
 * Uses constant-time comparison (hash + timingSafeEqual) to avoid timing side-channels.
 */
function requireWebhookEmitSecret(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const secret = process.env.WEBHOOK_EMIT_SECRET
  if (!secret) {
    res.status(503).json({
      message: 'Webhook emit is not configured (WEBHOOK_EMIT_SECRET missing)',
      code: 'EMIT_NOT_CONFIGURED',
    })
    return
  }
  const headerSecret =
    req.headers['x-webhook-internal-secret'] ?? (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7).trim()
      : null)
  const expected = crypto.createHash('sha256').update(secret, 'utf8').digest()
  const received = crypto.createHash('sha256').update(String(headerSecret ?? ''), 'utf8').digest()
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    res.status(403).json({
      message: 'Forbidden: invalid or missing internal credential',
      code: 'FORBIDDEN',
    })
    return
  }
  next()
}

webhooksRouter.post(
  '/emit',
  requireWebhookEmitSecret,
  async (req: express.Request, res: express.Response) => {
    try {
      const { organization_id, event_type, data } = req.body || {}
      if (!organization_id || typeof organization_id !== 'string') {
        return res.status(400).json({
          message: 'Missing or invalid organization_id',
          code: 'VALIDATION_ERROR',
        })
      }
      if (!event_type || typeof event_type !== 'string') {
        return res.status(400).json({
          message: 'Missing or invalid event_type',
          code: 'VALIDATION_ERROR',
        })
      }
      if (!ALLOWED_SET.has(event_type)) {
        return res.status(400).json({
          message: `event_type not allowed: ${event_type}`,
          code: 'VALIDATION_ERROR',
        })
      }
      const payloadCheck = validateWebhookEmitPayload(event_type, data)
      if (!payloadCheck.valid) {
        return res.status(400).json({
          message: payloadCheck.message,
          code: 'VALIDATION_ERROR',
        })
      }
      const dataObj = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : {}
      await deliverEvent(organization_id, event_type, dataObj)
      return res.status(202).json({ ok: true })
    } catch (err: unknown) {
      console.error('[Webhooks] Emit error:', err)
      return res.status(500).json({
        message: err instanceof Error ? err.message : 'Internal error',
        code: 'INTERNAL_ERROR',
      })
    }
  }
)
