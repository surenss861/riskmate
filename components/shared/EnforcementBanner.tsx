/**
 * EnforcementBanner - "Policy blocked this action → logged as ..."
 * 
 * Shows when an action was blocked by policy enforcement
 * Displays the policy reason and links to the ledger event
 */

'use client'

import { Shield, AlertTriangle, XCircle, ExternalLink } from 'lucide-react'
import { Badge } from './Badge'

export interface EnforcementBannerProps {
  action: string // What was attempted
  blocked: boolean // Whether it was blocked
  eventId: string // Ledger event ID
  policyStatement: string // Policy that was violated/enforced
  actorRole?: string // Role of the actor
  severity: 'critical' | 'material' | 'info'
  className?: string
  onViewLedger?: (eventId: string) => void // Optional callback to view ledger event
}

/**
 * EnforcementBanner - Policy enforcement notice
 * 
 * @example
 * ```tsx
 * <EnforcementBanner
 *   action="Attempted to update job status"
 *   blocked={true}
 *   eventId="evt_abc123"
 *   policyStatement="Executives cannot modify job records. Only Safety Leads and Admins can update job status."
 *   actorRole="executive"
 *   severity="critical"
 *   onViewLedger={(id) => router.push(`/operations/audit?event=${id}`)}
 * />
 * ```
 */
export function EnforcementBanner({
  action,
  blocked,
  eventId,
  policyStatement,
  actorRole,
  severity,
  className,
  onViewLedger,
}: EnforcementBannerProps) {
  const getSeverityConfig = () => {
    switch (severity) {
      case 'critical':
        return {
          variant: 'critical' as const,
          bgColor: 'bg-red-500/10 border-red-500/30',
          textColor: 'text-red-200',
          icon: <XCircle className="w-5 h-5" />,
        }
      case 'material':
        return {
          variant: 'warning' as const,
          bgColor: 'bg-yellow-500/10 border-yellow-500/30',
          textColor: 'text-yellow-200',
          icon: <AlertTriangle className="w-5 h-5" />,
        }
      case 'info':
        return {
          variant: 'neutral' as const,
          bgColor: 'bg-blue-500/10 border-blue-500/30',
          textColor: 'text-blue-200',
          icon: <Shield className="w-5 h-5" />,
        }
    }
  }

  const config = getSeverityConfig()

  return (
    <div className={`p-4 rounded-lg border ${config.bgColor} ${className} min-w-0`}>
      <div className="flex items-start gap-3 min-w-0">
        <div className={`mt-0.5 ${config.textColor} flex-shrink-0`}>
          {config.icon}
        </div>
        <div className="flex-1 space-y-2 min-w-0">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className={`font-semibold ${config.textColor} flex-shrink-0`}>
              {blocked ? 'Policy Blocked' : 'Policy Enforced'}
            </span>
            <Badge variant={config.variant} className="text-xs flex-shrink-0">
              {severity.toUpperCase()}
            </Badge>
            {actorRole && (
              <span className="text-xs text-white/60 truncate min-w-0" title={actorRole}>
                Role: <span className="font-medium text-white/80">{actorRole}</span>
              </span>
            )}
          </div>
          
          <div className="text-sm text-white/90 break-words min-w-0">
            <span className="font-medium">Action:</span> {action}
          </div>
          
          <div className="text-sm text-white/80 break-words min-w-0">
            <span className="font-medium">Policy:</span> {policyStatement}
          </div>
          
          <div className="flex items-center gap-2 text-xs text-white/60 pt-2 border-t border-white/10 min-w-0 flex-wrap">
            <span className="flex-shrink-0">Logged as:</span>
            <code className="px-2 py-0.5 bg-white/10 rounded font-mono truncate min-w-0" title={eventId}>
              {eventId.slice(0, 16)}...
            </code>
            {onViewLedger && (
              <button
                onClick={() => onViewLedger(eventId)}
                className="flex items-center gap-1 text-white/70 hover:text-white transition-colors underline flex-shrink-0"
              >
                View in Ledger
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

