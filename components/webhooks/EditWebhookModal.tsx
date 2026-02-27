'use client'

import { useState, useEffect } from 'react'
import { Button, Input, GlassCard } from '@/components/shared'
import type { WebhookEndpoint } from './AddWebhookModal'

const EVENT_TYPES = [
  'job.created', 'job.updated', 'job.completed', 'job.deleted',
  'hazard.created', 'hazard.updated', 'signature.added', 'report.generated',
  'evidence.uploaded', 'team.member_added',
]

const EVENT_GROUPS: { label: string; events: string[] }[] = [
  { label: 'Jobs', events: ['job.created', 'job.updated', 'job.completed', 'job.deleted'] },
  { label: 'Hazards', events: ['hazard.created', 'hazard.updated'] },
  { label: 'Other', events: ['signature.added', 'report.generated', 'evidence.uploaded', 'team.member_added'] },
]

interface EditWebhookModalProps {
  open: boolean
  endpoint: WebhookEndpoint | null
  onClose: () => void
  onSaved: () => void
}

export function EditWebhookModal({ open, endpoint, onClose, onSaved }: EditWebhookModalProps) {
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (endpoint) {
      setUrl(endpoint.url)
      setDescription(endpoint.description ?? '')
      setIsActive(endpoint.is_active ?? true)
      setSelectedEvents(new Set(endpoint.events || []))
    }
  }, [endpoint])

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
    if (!endpoint) return
    setError(null)
    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }
    try {
      new URL(url)
    } catch {
      setError('Please enter a valid URL')
      return
    }
    if (selectedEvents.size === 0) {
      setError('Select at least one event type')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/webhooks/${endpoint.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          url: url.trim(),
          description: description.trim() || null,
          events: Array.from(selectedEvents),
          is_active: isActive,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json?.message || 'Failed to update')
        return
      }
      onSaved()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open || !endpoint) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <GlassCard className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Edit webhook</h2>
          <button type="button" onClick={onClose} className="text-white/70 hover:text-white" aria-label="Close">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-white/90 mb-1">Endpoint URL</label>
            <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} className="w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/90 mb-1">Description (optional)</label>
            <Input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full" />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="edit-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-white/20"
            />
            <label htmlFor="edit-active" className="text-sm text-white/90">Active</label>
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
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border cursor-pointer"
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
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      </GlassCard>
    </div>
  )
}
