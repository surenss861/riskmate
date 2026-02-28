/**
 * Internal endpoints for server-to-server calls (e.g. Next.js → backend).
 * Require X-Internal-Secret header matching INTERNAL_API_KEY.
 */

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
  const headerSecret = req.headers['x-internal-secret']
  if (secret && headerSecret !== secret) {
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
