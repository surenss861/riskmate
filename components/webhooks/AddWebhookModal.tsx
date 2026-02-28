'use client'

import { useState } from 'react'
import {
  Button,
  Input,
  GlassCard,
} from '@/components/shared'
import { WEBHOOK_EVENT_TYPES } from '@/lib/webhooks/trigger'

/** Static grouping for UI; event names must exist in WEBHOOK_EVENT_TYPES. */
const EVENT_GROUPS: { label: string; events: string[] }[] = [
  { label: 'Jobs', events: ['job.created', 'job.updated', 'job.completed', 'job.deleted'] },
  { label: 'Hazards', events: ['hazard.created', 'hazard.updated'] },
  { label: 'Other', events: ['signature.added', 'report.generated', 'evidence.uploaded', 'team.member_added'] },
]

export interface WebhookEndpoint {
  id: string
  url: string
  events: string[]
  is_active: boolean
  description: string | null
  created_at: string
  secret?: string
}

interface AddWebhookModalProps {
  open: boolean
  onClose: () => void
  onCreated: (endpoint: WebhookEndpoint & { secret?: string }) => void
  /** Target organization for the new endpoint; required so multi-org admins create in the intended tenant. */
  organizationId?: string | null
}

export function AddWebhookModal({ open, onClose, onCreated, organizationId }: AddWebhookModalProps) {
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdSecret, setCreatedSecret] = useState<string | null>(null)
  const [createdEndpoint, setCreatedEndpoint] = useState<WebhookEndpoint | null>(null)

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev)
      if (next.has(event)) next.delete(event)
      else next.add(event)
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }
    try {
      new URL(url)
    } catch {
      setError('Please enter a valid URL (e.g. https://...)')
      return
    }
    if (selectedEvents.size === 0) {
      setError('Select at least one event type')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          url: url.trim(),
          description: description.trim() || null,
          events: Array.from(selectedEvents),
          ...(organizationId ? { organization_id: organizationId } : {}),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json?.message || json?.error?.message || 'Failed to create webhook')
        return
      }
      const data = json.data
      if (data.secret) {
        setCreatedSecret(data.secret)
        setCreatedEndpoint({
          id: data.id,
          url: data.url,
          events: data.events || [],
          is_active: data.is_active ?? true,
          description: data.description ?? null,
          created_at: data.created_at,
        })
      } else {
        onCreated(data)
        onClose()
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCloseAfterSecret = () => {
    if (createdEndpoint && createdSecret) {
      onCreated({ ...createdEndpoint, secret: createdSecret })
    }
    setCreatedSecret(null)
    setCreatedEndpoint(null)
    setUrl('')
    setDescription('')
    setSelectedEvents(new Set())
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <GlassCard className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">
            {createdSecret ? 'Webhook created — save your secret' : 'Add webhook endpoint'}
          </h2>
          <button
            type="button"
            onClick={createdSecret ? handleCloseAfterSecret : onClose}
            className="text-white/70 hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {createdSecret ? (
          <div className="space-y-4">
            <p className="text-sm text-white/80">
              Copy this secret now. It won’t be shown again. Use it to verify webhook signatures.
            </p>
            <div className="rounded-lg bg-white/5 border border-white/10 p-3 font-mono text-sm text-white break-all">
              {createdSecret}
            </div>
            <Button onClick={handleCloseAfterSecret}>Done</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white/90 mb-1">Endpoint URL</label>
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://api.example.com/webhooks/riskmate"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/90 mb-1">Description (optional)</label>
              <Input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Procore integration"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">Events</label>
              <div className="space-y-3">
                {EVENT_GROUPS.map((group) => (
                  <div key={group.label}>
                    <span className="text-xs text-white/60 uppercase tracking-wide">{group.label}</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {group.events.map((event) => (
                        <button
                          key={event}
                          type="button"
                          onClick={() => toggleEvent(event)}
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer"
                          style={
                            selectedEvents.has(event)
                              ? { background: 'rgba(16,185,129,0.1)', color: 'rgb(52,211,153)', borderColor: 'rgba(16,185,129,0.2)' }
                              : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)', borderColor: 'rgba(255,255,255,0.1)' }
                          }
                        >
                          {event}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating…' : 'Add endpoint'}
              </Button>
            </div>
          </form>
        )}
      </GlassCard>
    </div>
  )
}
