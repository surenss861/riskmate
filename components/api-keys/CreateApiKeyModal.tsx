'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button, Input, GlassCard } from '@/components/shared'

export const API_KEY_SCOPES = [
  'jobs:read',
  'jobs:write',
  'hazards:read',
  'hazards:write',
  'reports:read',
  'team:read',
  'webhooks:manage',
] as const

export interface ApiKeyRow {
  id: string
  name: string
  key_prefix: string
  scopes: string[]
  last_used_at: string | null
  expires_at: string | null
  created_at: string
  revoked_at: string | null
}

interface CreateApiKeyModalProps {
  open: boolean
  onClose: () => void
  onCreated: (key: ApiKeyRow) => void
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }
  return (
    <Button type="button" variant="secondary" size="sm" onClick={handleCopy} className="shrink-0">
      {copied ? 'Copied!' : 'Copy key'}
    </Button>
  )
}

export function CreateApiKeyModal({ open, onClose, onCreated }: CreateApiKeyModalProps) {
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<Set<string>>(new Set())
  const [expiresAt, setExpiresAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [createdRow, setCreatedRow] = useState<ApiKeyRow | null>(null)
  const prevOpenRef = useRef(open)

  const resetForm = useCallback(() => {
    setName('')
    setScopes(new Set())
    setExpiresAt('')
    setError(null)
    setCreatedKey(null)
    setCreatedRow(null)
  }, [])

  useEffect(() => {
    const wasOpen = prevOpenRef.current
    if (wasOpen && !open) resetForm()
    prevOpenRef.current = open
  }, [open, resetForm])

  const toggleScope = (scope: string) => {
    setScopes((prev) => {
      const next = new Set(prev)
      if (next.has(scope)) next.delete(scope)
      else next.add(scope)
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          scopes: Array.from(scopes),
          // Send end-of-day UTC for the selected date so the key is valid for the full day (avoids midnight-UTC expiry).
          expires_at: expiresAt.trim()
            ? `${expiresAt.trim()}T23:59:59.999Z`
            : null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((json as { message?: string }).message ?? 'Failed to create API key')
        return
      }
      const data = json?.data
      if (data?.key && data?.id) {
        setCreatedKey(data.key)
        setCreatedRow({
          id: data.id,
          name: data.name,
          key_prefix: data.key_prefix,
          scopes: data.scopes ?? [],
          last_used_at: null,
          expires_at: data.expires_at ?? null,
          created_at: data.created_at ?? new Date().toISOString(),
          revoked_at: null,
        })
      } else {
        setError('Invalid response from server')
      }
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDone = () => {
    if (createdRow) onCreated(createdRow)
    onClose()
    resetForm()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" role="dialog" aria-modal="true" aria-labelledby="create-api-key-title">
      <GlassCard className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <h2 id="create-api-key-title" className="text-xl font-semibold text-white mb-4">
          {createdKey ? 'API key created' : 'Create API key'}
        </h2>

        {createdKey ? (
          <div className="space-y-4">
            <p className="text-amber-200 text-sm font-medium">
              Save this key — it will not be shown again.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="flex-1 min-w-0 p-3 rounded bg-white/10 text-white/90 text-sm break-all font-mono">
                {createdKey}
              </code>
              <CopyButton text={createdKey} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="primary" onClick={handleDone}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="api-key-name" className="block text-sm font-medium text-white/80 mb-1">
                Name
              </label>
              <Input
                id="api-key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Procore Integration"
                required
                className="w-full"
              />
            </div>
            <div>
              <span className="block text-sm font-medium text-white/80 mb-2">Scopes</span>
              <div className="flex flex-wrap gap-2">
                {API_KEY_SCOPES.map((scope) => (
                  <label key={scope} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scopes.has(scope)}
                      onChange={() => toggleScope(scope)}
                      className="rounded border-white/30 bg-white/10 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-white/90 font-mono">{scope}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="api-key-expires" className="block text-sm font-medium text-white/80 mb-1">
                Expiry (optional)
              </label>
              <Input
                id="api-key-expires"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full"
              />
            </div>
            {error && (
              <p className="text-red-300 text-sm">{error}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={submitting || !name.trim()}>
                {submitting ? 'Creating…' : 'Create API key'}
              </Button>
            </div>
          </form>
        )}
      </GlassCard>
    </div>
  )
}
