/**
 * IntegrityBadge - Visual indicator of ledger integrity verification status
 * 
 * Shows: "Verified" / "Unverified" / "Mismatch"
 * Used across all pages to indicate trust status of data
 */

'use client'

import { Shield, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { Badge } from './Badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export type IntegrityStatus = 'verified' | 'unverified' | 'mismatch' | 'pending'

export interface IntegrityBadgeProps {
  status: IntegrityStatus
  verifiedThrough?: string // Event ID or timestamp
  lastVerified?: string // ISO timestamp
  errorDetails?: {
    failingEventId?: string
    expectedHash?: string
    gotHash?: string
  }
  className?: string
  showDetails?: boolean // Show tooltip with details
}

/**
 * IntegrityBadge - Visual indicator of ledger integrity verification
 * 
 * @example
 * ```tsx
 * <IntegrityBadge 
 *   status="verified" 
 *   verifiedThrough="evt_abc123"
 *   lastVerified="2025-01-10T12:00:00Z"
 *   showDetails
 * />
 * ```
 */
export function IntegrityBadge({
  status,
  verifiedThrough,
  lastVerified,
  errorDetails,
  className,
  showDetails = false,
}: IntegrityBadgeProps) {
  const getBadgeConfig = () => {
    switch (status) {
      case 'verified':
        return {
          variant: 'success' as const,
          icon: <CheckCircle2 className="w-3 h-3" />,
          label: 'Verified',
          description: 'Ledger integrity verified. All events are chain-linked and tamper-evident.',
        }
      case 'unverified':
        return {
          variant: 'warning' as const,
          icon: <AlertTriangle className="w-3 h-3" />,
          label: 'Unverified',
          description: 'Ledger integrity not yet verified. Verification runs automatically.',
        }
      case 'mismatch':
        return {
          variant: 'critical' as const,
          icon: <XCircle className="w-3 h-3" />,
          label: 'Mismatch',
          description: 'Ledger integrity check failed. Chain verification detected discrepancy.',
        }
      case 'pending':
        return {
          variant: 'neutral' as const,
          icon: <Shield className="w-3 h-3" />,
          label: 'Verifying...',
          description: 'Ledger integrity verification in progress.',
        }
      default:
        return {
          variant: 'neutral' as const,
          icon: <Shield className="w-3 h-3" />,
          label: 'Unknown',
          description: 'Integrity status unknown.',
        }
    }
  }

  const config = getBadgeConfig()

  // If showDetails is true, wrap in native title attribute (works everywhere)
  const title = showDetails ? (() => {
    const parts: string[] = [config.description]
    if (verifiedThrough) parts.push(`Verified through: ${verifiedThrough.slice(0, 12)}...`)
    if (lastVerified) parts.push(`Last verified: ${new Date(lastVerified).toLocaleString()}`)
    if (errorDetails) {
      parts.push(`Failing event: ${errorDetails.failingEventId?.slice(0, 12)}...`)
      if (errorDetails.expectedHash) parts.push(`Expected: ${errorDetails.expectedHash.slice(0, 16)}...`)
      if (errorDetails.gotHash) parts.push(`Got: ${errorDetails.gotHash.slice(0, 16)}...`)
    }
    return parts.join('\n')
  })() : undefined

  return (
    <Badge 
      variant={config.variant} 
      className={`inline-flex items-center gap-1.5 ${className}`}
      title={title}
    >
      {config.icon}
      <span>{config.label}</span>
    </Badge>
  )
}

