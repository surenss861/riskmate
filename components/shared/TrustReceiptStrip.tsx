/**
 * TrustReceiptStrip - Who/when/what/why + role indicator
 * 
 * Shows: actor (role + identity) + timestamp + action + reason
 * Used in event rows, audit logs, and timeline views
 */

'use client'

import { User, Clock, Shield, FileText } from 'lucide-react'
import type { EventCategory } from '@/lib/audit/eventMapper'

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

export interface TrustReceiptStripProps {
  actorName?: string
  actorRole?: string
  actorEmail?: string
  occurredAt: string
  eventType: string
  category?: EventCategory
  summary?: string
  reason?: string // Why this action was taken
  policyStatement?: string // Policy that applies
  className?: string
  compact?: boolean // Smaller version for dense layouts
}

/**
 * TrustReceiptStrip - Who/when/what/why + role indicator
 * 
 * @example
 * ```tsx
 * <TrustReceiptStrip
 *   actorName="John Doe"
 *   actorRole="Safety Lead"
 *   occurredAt="2025-01-10T12:00:00Z"
 *   eventType="job.created"
 *   category="operations"
 *   summary="Created new job for ABC Construction"
 *   reason="Standard workflow"
 * />
 * ```
 */
export function TrustReceiptStrip({
  actorName,
  actorRole,
  actorEmail,
  occurredAt,
  eventType,
  category,
  summary,
  reason,
  policyStatement,
  className,
  compact = false,
}: TrustReceiptStripProps) {
  // Format event type for display
  const displayType = eventType.includes('.') 
    ? eventType.split('.').slice(-1)[0].replace(/_/g, ' ')
    : eventType.replace(/_/g, ' ')

  const getCategoryIcon = () => {
    switch (category) {
      case 'governance':
        return <Shield className="w-3 h-3" />
      case 'operations':
        return <FileText className="w-3 h-3" />
      case 'access':
        return <User className="w-3 h-3" />
      default:
        return <FileText className="w-3 h-3" />
    }
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-2 text-xs text-white/60 min-w-0 flex-wrap ${className}`}>
        {actorName && (
          <div className="flex items-center gap-1 min-w-0">
            <User className="w-3 h-3 flex-shrink-0" />
            <span className="font-medium text-white/80 truncate min-w-0">{actorName}</span>
            {actorRole && (
              <span className="text-white/50 flex-shrink-0">({actorRole})</span>
            )}
          </div>
        )}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Clock className="w-3 h-3" />
          <span>{formatRelativeTime(occurredAt)}</span>
        </div>
        {category && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {getCategoryIcon()}
            <span className="capitalize">{category}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`space-y-2 p-3 bg-white/5 border border-white/10 rounded-lg ${className}`}>
      {/* Actor + Role */}
      <div className="flex items-center gap-2 text-sm min-w-0">
        <User className="w-4 h-4 text-white/60 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium text-white truncate min-w-0">{actorName || 'System'}</span>
            {actorRole && (
              <span className="text-xs px-2 py-0.5 bg-white/10 rounded text-white/70 flex-shrink-0">
                {actorRole}
              </span>
            )}
          </div>
          {actorEmail && (
            <div className="text-xs text-white/50 truncate min-w-0">{actorEmail}</div>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-white/60 flex-shrink-0">
          <Clock className="w-3 h-3" />
          <time dateTime={occurredAt}>{formatRelativeTime(occurredAt)}</time>
        </div>
      </div>

      {/* Event Type + Category */}
      <div className="flex items-center gap-2 text-xs min-w-0">
        {category && (
          <div className="flex items-center gap-1 text-white/60 flex-shrink-0">
            {getCategoryIcon()}
            <span className="capitalize">{category}</span>
          </div>
        )}
        <span className="text-white/50 flex-shrink-0">•</span>
        <span className="font-mono text-white/70 truncate min-w-0">{displayType}</span>
      </div>

      {/* Summary */}
      {summary && (
        <div className="text-sm text-white/90 break-words">
          {summary}
        </div>
      )}

      {/* Reason / Policy */}
      {reason && (
        <div className="text-xs text-white/60 italic break-words">
          Why: {reason}
        </div>
      )}

      {policyStatement && (
        <div className="mt-2 pt-2 border-t border-white/10 text-xs">
          <div className="font-medium text-white/80 mb-1">Policy:</div>
          <div className="text-white/70 break-words">{policyStatement}</div>
        </div>
      )}
    </div>
  )
}

