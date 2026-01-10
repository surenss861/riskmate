/**
 * EventChip - Canonical event type + severity indicator
 * 
 * Shows: event type + severity badge
 * Used in event lists, timeline views, and audit logs
 */

'use client'

import { Badge } from './Badge'
import type { EventSeverity } from '@/lib/audit/eventMapper'
import { AlertTriangle, Shield, Info, XCircle, CheckCircle } from 'lucide-react'

export interface EventChipProps {
  eventType: string
  severity: EventSeverity
  outcome?: 'blocked' | 'allowed' | 'success' | 'failure'
  className?: string
  showOutcome?: boolean
}

/**
 * EventChip - Canonical event type + severity indicator
 * 
 * @example
 * ```tsx
 * <EventChip 
 *   eventType="auth.role_violation"
 *   severity="critical"
 *   outcome="blocked"
 *   showOutcome
 * />
 * ```
 */
export function EventChip({
  eventType,
  severity,
  outcome,
  className,
  showOutcome = false,
}: EventChipProps) {
  const getSeverityConfig = () => {
    switch (severity) {
      case 'critical':
        return {
          variant: 'critical' as const,
          icon: <XCircle className="w-3 h-3" />,
          label: 'CRITICAL',
        }
      case 'material':
        return {
          variant: 'warning' as const,
          icon: <AlertTriangle className="w-3 h-3" />,
          label: 'MATERIAL',
        }
      case 'info':
        return {
          variant: 'neutral' as const,
          icon: <Info className="w-3 h-3" />,
          label: 'INFO',
        }
      default:
        return {
          variant: 'neutral' as const,
          icon: <Info className="w-3 h-3" />,
          label: 'INFO',
        }
    }
  }

  const getOutcomeConfig = () => {
    if (!outcome) return null
    
    switch (outcome) {
      case 'blocked':
        return {
          variant: 'critical' as const,
          icon: <XCircle className="w-3 h-3" />,
          label: 'BLOCKED',
        }
      case 'allowed':
      case 'success':
        return {
          variant: 'success' as const,
          icon: <CheckCircle className="w-3 h-3" />,
          label: 'ALLOWED',
        }
      case 'failure':
        return {
          variant: 'critical' as const,
          icon: <XCircle className="w-3 h-3" />,
          label: 'FAILED',
        }
      default:
        return null
    }
  }

  const severityConfig = getSeverityConfig()
  const outcomeConfig = getOutcomeConfig()

  // Format event type for display (remove namespace prefix)
  const displayType = eventType.includes('.') 
    ? eventType.split('.').slice(-1)[0].replace(/_/g, ' ')
    : eventType.replace(/_/g, ' ')

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {/* Event type */}
      <Badge variant={severityConfig.variant} className="inline-flex items-center gap-1.5">
        {severityConfig.icon}
        <span className="text-xs font-medium uppercase">{severityConfig.label}</span>
      </Badge>
      
      {/* Outcome badge (if shown) */}
      {showOutcome && outcomeConfig && (
        <Badge variant={outcomeConfig.variant} className="inline-flex items-center gap-1.5">
          {outcomeConfig.icon}
          <span className="text-xs font-medium uppercase">{outcomeConfig.label}</span>
        </Badge>
      )}
      
      {/* Event type name (subtle) */}
      <span className="text-xs text-white/60 font-mono">
        {displayType}
      </span>
    </div>
  )
}

