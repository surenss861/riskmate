/**
 * Internal endpoints for server-to-server calls (e.g. Next.js → backend).
 * Require X-Internal-Secret header matching INTERNAL_API_KEY.
 * When INTERNAL_API_KEY is unset, returns 503 so the endpoint is not usable (no passthrough).
 */

import crypto from 'node:crypto'
import express, { type Router as ExpressRouter } from 'express'
import { createErrorResponse } from '../utils/errorResponse'
import { wakeWebhookWorker } from '../workers/webhookDelivery'

export const internalRouter: ExpressRouter = express.Router()

function requireInternalSecret(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const secret = process.env.INTERNAL_API_KEY
  if (!secret || secret === '') {
    res.status(503).json(
      createErrorResponse({
        message: 'Internal API not configured',
        code: 'SERVICE_UNAVAILABLE',
        status: 503,
      }).response
    )
    return
  }
  const headerSecret = req.headers['x-internal-secret']
  const expected = crypto.createHash('sha256').update(secret, 'utf8').digest()
  const received = crypto.createHash('sha256').update(String(headerSecret ?? ''), 'utf8').digest()
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    res.status(401).json(
      createErrorResponse({
        message: 'Unauthorized',
        code: 'AUTH_UNAUTHORIZED',
        status: 401,
      }).response
    )
    return
  }
  next()
}

/** POST /api/internal/wake-webhook-worker — wake delivery worker after enqueue (e.g. from Next.js triggerWebhookEvent). */
internalRouter.post('/wake-webhook-worker', requireInternalSecret, (_req, res) => {
  wakeWebhookWorker()
  res.status(204).end()
})
