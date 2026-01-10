/**
 * EvidenceStamp - Timestamp + uploader + file hash indicator
 * 
 * Shows: "fingerprinted" badge with timestamp and uploader
 * Used on evidence files, documents, and photos
 */

'use client'

import { Fingerprint, Clock, User, CheckCircle2 } from 'lucide-react'
import { Badge } from './Badge'

// Format relative time helper (inline to avoid dependency)
const formatRelativeTime = (date: string) => {
  const now = new Date()
  const eventDate = new Date(date)
  const diffMs = now.getTime() - eventDate.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return eventDate.toLocaleDateString()
}

export interface EvidenceStampProps {
  uploadedAt: string
  uploadedBy?: string
  uploadedByRole?: string
  fileHash?: string // Optional: don't expose raw hash unless needed
  verified?: boolean // Whether the file integrity has been verified
  linkedEventIds?: string[] // Ledger events this evidence links to
  className?: string
  compact?: boolean
}

/**
 * EvidenceStamp - Timestamp + uploader + file hash indicator
 * 
 * @example
 * ```tsx
 * <EvidenceStamp
 *   uploadedAt="2025-01-10T12:00:00Z"
 *   uploadedBy="John Doe"
 *   uploadedByRole="Safety Lead"
 *   fileHash="sha256:abc123..."
 *   verified={true}
 *   linkedEventIds={['evt_123', 'evt_456']}
 * />
 * ```
 */
export function EvidenceStamp({
  uploadedAt,
  uploadedBy,
  uploadedByRole,
  fileHash,
  verified,
  linkedEventIds,
  className,
  compact = false,
}: EvidenceStampProps) {
  if (compact) {
    return (
      <div className={`flex items-center gap-2 text-xs text-white/60 ${className}`}>
        <Fingerprint className="w-3 h-3" />
        <span className="text-white/80">Fingerprinted</span>
        {verified && (
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
        )}
        <span className="text-white/50">•</span>
        <span>{formatRelativeTime(uploadedAt)}</span>
        {uploadedBy && (
          <>
            <span className="text-white/50">•</span>
            <span className="text-white/70">{uploadedBy}</span>
          </>
        )}
      </div>
    )
  }

  return (
    <div className={`p-3 bg-white/5 border border-white/10 rounded-lg space-y-2 ${className}`}>
      {/* Fingerprint badge */}
      <div className="flex items-center gap-2">
        <Badge 
          variant={verified ? 'success' : 'neutral'} 
          className="inline-flex items-center gap-1.5"
        >
          <Fingerprint className="w-3 h-3" />
          <span className="text-xs font-medium">Fingerprinted</span>
          {verified && (
            <CheckCircle2 className="w-3 h-3" />
          )}
        </Badge>
        {fileHash && (
          <code className="text-xs font-mono text-white/50">
            {fileHash.slice(0, 16)}...
          </code>
        )}
      </div>

      {/* Uploader + Timestamp */}
      <div className="flex items-center gap-3 text-xs text-white/70">
        {uploadedBy && (
          <div className="flex items-center gap-1">
            <User className="w-3 h-3 text-white/50" />
            <span className="font-medium">{uploadedBy}</span>
            {uploadedByRole && (
              <span className="text-white/50">({uploadedByRole})</span>
            )}
          </div>
        )}
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-white/50" />
          <time dateTime={uploadedAt}>{formatRelativeTime(uploadedAt)}</time>
        </div>
      </div>

      {/* Linked events */}
      {linkedEventIds && linkedEventIds.length > 0 && (
        <div className="pt-2 border-t border-white/10 text-xs text-white/60">
          <div className="font-medium mb-1">Linked to {linkedEventIds.length} ledger event{linkedEventIds.length > 1 ? 's' : ''}</div>
          <div className="flex flex-wrap gap-1">
            {linkedEventIds.slice(0, 3).map((eventId) => (
              <code key={eventId} className="text-xs font-mono bg-white/5 px-1.5 py-0.5 rounded">
                {eventId.slice(0, 12)}...
              </code>
            ))}
            {linkedEventIds.length > 3 && (
              <span className="text-white/50">+{linkedEventIds.length - 3} more</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

