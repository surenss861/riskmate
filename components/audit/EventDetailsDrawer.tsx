'use client'

import { X, ExternalLink, User, FileText, Building2, Clock, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { buttonStyles } from '@/lib/styles/design-system'
import { useRouter } from 'next/navigation'

interface AuditEvent {
  id: string
  event_name?: string
  event_type?: string
  created_at: string
  category?: string
  category_tab?: 'governance' | 'operations' | 'access'
  severity?: 'critical' | 'material' | 'info'
  outcome?: 'blocked' | 'allowed' | 'success' | 'failure'
  actor_name?: string
  actor_email?: string
  actor_role?: string
  actor_id?: string
  job_id?: string
  job_name?: string
  job_title?: string
  site_id?: string
  site_name?: string
  target_type?: string
  target_id?: string
  metadata?: any
  summary?: string
}

interface EventDetailsDrawerProps {
  isOpen: boolean
  onClose: () => void
  event: AuditEvent | null
}

export function EventDetailsDrawer({ isOpen, onClose, event }: EventDetailsDrawerProps) {
  const router = useRouter()
  const [copied, setCopied] = useState<string | null>(null)

  if (!isOpen || !event) return null

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1A1A1A] border border-white/10 rounded-t-lg sm:rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-semibold text-white">Event Details</h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Event Summary */}
          <div>
            <h3 className="text-sm font-medium text-white/60 mb-2">Event</h3>
            <div className="bg-white/5 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-white font-mono text-sm">
                  {event.event_name || event.event_type || 'Unknown Event'}
                </span>
                <div className="flex gap-2">
                  {event.severity && (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      event.severity === 'critical' ? 'bg-red-500/30 text-red-300 border border-red-500/50' :
                      event.severity === 'material' ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {event.severity.toUpperCase()}
                    </span>
                  )}
                  {event.outcome && (
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      event.outcome === 'blocked' ? 'bg-red-500/20 text-red-400' :
                      'bg-green-500/20 text-green-400'
                    }`}>
                      {event.outcome.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
              {event.summary && (
                <p className="text-white/80 text-sm">{event.summary}</p>
              )}
            </div>
          </div>

          {/* Actor Information */}
          {event.actor_id && (
            <div>
              <h3 className="text-sm font-medium text-white/60 mb-2 flex items-center gap-2">
                <User className="w-4 h-4" />
                Actor
              </h3>
              <div className="bg-white/5 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">
                      {event.actor_name || event.actor_email || 'Unknown'}
                    </div>
                    {event.actor_role && (
                      <div className="text-white/60 text-sm">Role: {event.actor_role}</div>
                    )}
                    {event.actor_email && (
                      <div className="text-white/60 text-sm font-mono">{event.actor_email}</div>
                    )}
                  </div>
                  {event.actor_id && (
                    <button
                      onClick={() => handleCopy(event.actor_id!, 'actor_id')}
                      className="text-white/40 hover:text-white/60 transition-colors"
                      title="Copy Actor ID"
                    >
                      {copied === 'actor_id' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  )}
                </div>
                {event.actor_id && (
                  <div className="text-xs text-white/50 font-mono">
                    ID: {event.actor_id}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Target Information */}
          {(event.target_type || event.job_id) && (
            <div>
              <h3 className="text-sm font-medium text-white/60 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Target
              </h3>
              <div className="bg-white/5 rounded-lg p-4 space-y-2">
                {event?.job_name && event?.job_id && (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">{event.job_name}</div>
                      {event?.site_name && (
                        <div className="text-white/60 text-sm flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {event.site_name}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => router.push(`/operations/jobs/${event.job_id}`)}
                      className="text-[#F97316] hover:text-[#FFC857] transition-colors flex items-center gap-1 text-sm"
                    >
                      View <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                )}
                {event?.target_type && event?.target_id && (
                  <div className="text-xs text-white/50 font-mono">
                    Type: {event.target_type} | ID: {event.target_id}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timestamp */}
          {event?.created_at && (
            <div>
              <h3 className="text-sm font-medium text-white/60 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Timestamp
              </h3>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-white">{formatDate(event.created_at)}</div>
                <div className="text-xs text-white/50 font-mono mt-1">{event.created_at}</div>
              </div>
            </div>
          )}

          {/* Metadata */}
          {event?.metadata && Object.keys(event.metadata || {}).length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-white/60 mb-2">Metadata</h3>
              <div className="bg-black/20 rounded-lg p-4 overflow-x-auto">
                <pre className="text-xs text-white/80 font-mono whitespace-pre-wrap">
                  {JSON.stringify(event.metadata || {}, null, 2)}
                </pre>
                <button
                  onClick={() => handleCopy(JSON.stringify(event.metadata || {}, null, 2), 'metadata')}
                  className="mt-2 text-xs text-[#F97316] hover:text-[#FFC857] flex items-center gap-1"
                >
                  {copied === 'metadata' ? (
                    <>
                      <Check className="w-3 h-3" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" /> Copy JSON
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Full Event Data */}
          <div>
            <h3 className="text-sm font-medium text-white/60 mb-2">Full Event Data</h3>
            <div className="bg-black/20 rounded-lg p-4 overflow-x-auto">
              <pre className="text-xs text-white/80 font-mono whitespace-pre-wrap">
                {JSON.stringify(event || {}, null, 2)}
              </pre>
              <button
                onClick={() => handleCopy(JSON.stringify(event || {}, null, 2), 'full_event')}
                className="mt-2 text-xs text-[#F97316] hover:text-[#FFC857] flex items-center gap-1"
              >
                {copied === 'full_event' ? (
                  <>
                    <Check className="w-3 h-3" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" /> Copy Full JSON
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className={buttonStyles.primary}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

