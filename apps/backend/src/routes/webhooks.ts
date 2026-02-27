/**
 * Internal webhook emit: called by backend when it creates/updates resources.
 * POST /api/webhooks/emit { organization_id, event_type, data }
 */

import express, { type Router as ExpressRouter } from 'express'
import { authenticate, AuthenticatedRequest } from '../middleware/auth'
import { deliverEvent } from '../workers/webhookDelivery'

export const webhooksRouter: ExpressRouter = express.Router()

webhooksRouter.post(
  '/emit',
  authenticate,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest
    try {
      const { event_type, data } = req.body || {}
      // Restrict to authenticated tenant only; ignore caller-supplied organization_id to prevent cross-tenant enqueueing
      const orgId = authReq.user?.organization_id
      if (!orgId || !event_type || typeof data !== 'object') {
        return res.status(400).json({
          message: 'Missing organization context, event_type, or data',
          code: 'VALIDATION_ERROR',
        })
      }
      await deliverEvent(orgId, event_type, data)
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
