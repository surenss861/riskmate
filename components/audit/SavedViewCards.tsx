'use client'

import { Shield, FileCheck, AlertTriangle, UserCheck, Download, Package, UserPlus, CheckCircle, FileText, Ban, Flag } from 'lucide-react'
import { buttonStyles } from '@/lib/styles/design-system'
import { terms } from '@/lib/terms'
import { ActionButton, PackCard, IntegrityBadge } from '@/components/shared'
import { useViewPackHistory } from '@/lib/hooks/useViewPackHistory'
import { getViewIntegrityStatus } from '@/lib/utils/viewIntegrity'

interface SavedViewCardsProps {
  activeView: string
  selectedCount?: number // Number of selected items (action buttons require selection)
  onSelectView: (view: 'review-queue' | 'insurance-ready' | 'governance-enforcement' | 'incident-review' | 'access-review' | '') => void
  onExportCSV: (view: string) => void // CSV export only (human ops workflow)
  onExportCSVLoading?: boolean // Loading state for CSV export
  onAssign?: (view: string) => void
  onResolve?: (view: string) => void
  onExportEnforcement?: (view: string) => void
  onCreateCorrectiveAction?: (view: string) => void
  onCloseIncident?: (view: string) => void
  onRevokeAccess?: (view: string) => void
  onFlagSuspicious?: (view: string) => void
}

export function SavedViewCards({ 
  activeView, 
  selectedCount = 0,
  onSelectView, 
  onExportCSV,
  onExportCSVLoading = false,
  onAssign,
  onResolve,
  onExportEnforcement,
  onCreateCorrectiveAction,
  onCloseIncident,
  onRevokeAccess,
  onFlagSuspicious,
}: SavedViewCardsProps) {
  // Hook calls must be at top level - fetch pack history for all views
  const reviewQueuePack = useViewPackHistory('review-queue')
  const insuranceReadyPack = useViewPackHistory('insurance-ready')
  const governanceEnforcementPack = useViewPackHistory('governance-enforcement')
  const incidentReviewPack = useViewPackHistory('incident-review')
  const accessReviewPack = useViewPackHistory('access-review')
  
  // Map view IDs to their pack history
  const packHistoryMap = {
    'review-queue': reviewQueuePack,
    'insurance-ready': insuranceReadyPack,
    'governance-enforcement': governanceEnforcementPack,
    'incident-review': incidentReviewPack,
    'access-review': accessReviewPack,
  }
  
  const views = [
    {
      id: 'review-queue',
      title: 'Review Queue',
      icon: AlertTriangle,
      description: 'What needs human action right now? Flagged items, critical events, blocked actions, and unresolved exposure.',
      color: 'bg-orange-500/25 border-orange-500/40 text-orange-300',
      hoverColor: 'hover:bg-orange-500/35',
      priority: true,
      primaryAction: {
        label: 'Assign',
        icon: UserPlus,
        handler: onAssign,
      },
      secondaryAction: {
        label: 'Resolve',
        icon: CheckCircle,
        handler: onResolve,
      },
    },
    {
      id: 'insurance-ready',
      title: 'Insurance-Ready',
      icon: FileCheck,
      description: 'Give insurer/client a clean, defensible package fast. Completed work records, verified controls, complete evidence, and attestations.',
      color: 'bg-green-500/20 border-green-500/30 text-green-400',
      hoverColor: 'hover:bg-green-500/30',
      // No primary action - Generate Proof Pack moved to Advanced/Integrations menu
    },
    {
      id: 'governance-enforcement',
      title: 'Governance Enforcement',
      icon: Shield,
      description: 'Show blocked actions + policy enforcement evidence. Proves role enforcement and separation of duties.',
      color: 'bg-red-500/20 border-red-500/30 text-red-400',
      hoverColor: 'hover:bg-red-500/30',
      primaryAction: {
        label: 'Export Enforcement Report',
        icon: FileText,
        handler: onExportEnforcement,
      },
    },
    {
      id: 'incident-review',
      title: 'Incident Review',
      icon: AlertTriangle,
      description: 'Complete incident trail: detection → response → corrective actions → closure. Flagged work records, escalations, and high-severity events.',
      color: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400',
      hoverColor: 'hover:bg-yellow-500/30',
      primaryAction: {
        label: 'Create Corrective Action',
        icon: AlertTriangle,
        handler: onCreateCorrectiveAction,
      },
      secondaryAction: {
        label: 'Close Incident',
        icon: CheckCircle,
        handler: onCloseIncident,
      },
    },
    {
      id: 'access-review',
      title: 'Access Review',
      icon: UserCheck,
      description: 'Who got access, who lost access, and why. Role changes, login events, access revocations, and permission grants.',
      color: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
      hoverColor: 'hover:bg-blue-500/30',
      primaryAction: {
        label: 'Revoke Access',
        icon: Ban,
        handler: onRevokeAccess,
      },
      secondaryAction: {
        label: 'Flag Suspicious',
        icon: Flag,
        handler: onFlagSuspicious,
      },
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {views.map((view) => {
        const Icon = view.icon
        const isActive = activeView === view.id
        
        // Get pack history for this view (stub: returns null for now)
        const packHistory = packHistoryMap[view.id as keyof typeof packHistoryMap]
        const lastPack = packHistory?.lastPack || null
        
        // Get integrity status for this view (defaults to unverified)
        const viewIntegrityStatus = getViewIntegrityStatus(view.id)
        
        return (
          <div
            key={view.id}
            className={`${view.color} ${view.hoverColor} border rounded-lg p-4 cursor-pointer transition-all ${
              isActive ? 'ring-2 ring-[#F97316] ring-offset-2 ring-offset-[#0A0A0A]' : ''
            } ${
              view.id === 'review-queue' ? 'shadow-lg shadow-orange-500/20' : ''
            }`}
            onClick={() => onSelectView(isActive ? '' : view.id as any)}
          >
            <div className="flex items-start justify-between mb-3">
              <Icon className="w-6 h-6 flex-shrink-0" />
              <div className="flex items-center gap-2">
                {/* Integrity Badge - Top right */}
                <IntegrityBadge 
                  status={viewIntegrityStatus}
                  className="flex-shrink-0"
                />
                {isActive && (
                  <span className="text-xs px-2 py-0.5 bg-[#F97316] text-white rounded flex-shrink-0">Active</span>
                )}
              </div>
            </div>
            <h3 className="font-semibold mb-2 text-white">{view.title}</h3>
            <p className="text-sm text-white/70 mb-3">{view.description}</p>
            
            {/* Primary Action Button */}
            {view.primaryAction && (() => {
              // Action buttons (Assign, Resolve, Create Corrective Action, etc.) require selection
              const requiresSelection = ['Assign', 'Resolve', 'Create Corrective Action', 'Close Incident', 'Revoke Access', 'Flag Suspicious'].includes(view.primaryAction.label)
              const isDisabled = requiresSelection && selectedCount === 0
              
              return (
                <div onClick={(e) => e.stopPropagation()}>
                  <ActionButton
                    onClick={() => view.primaryAction?.handler?.(view.id)}
                    disabled={isDisabled}
                    disabledReason={isDisabled ? 'Select at least 1 item from the list below' : undefined}
                    variant="primary"
                    className="w-full text-xs py-2 mb-2 flex items-center justify-center gap-2 font-medium"
                    icon={view.primaryAction.icon ? <view.primaryAction.icon className="w-3.5 h-3.5" /> : undefined}
                  >
                    {view.primaryAction.label}
                  </ActionButton>
                </div>
              )
            })()}

            {/* Secondary Action Button (if exists) */}
            {view.secondaryAction && (() => {
              // Action buttons require selection
              const requiresSelection = ['Assign', 'Resolve', 'Create Corrective Action', 'Close Incident', 'Revoke Access', 'Flag Suspicious'].includes(view.secondaryAction.label)
              const isDisabled = requiresSelection && selectedCount === 0
              
              return (
                <div onClick={(e) => e.stopPropagation()}>
                  <ActionButton
                    onClick={() => view.secondaryAction?.handler?.(view.id)}
                    disabled={isDisabled}
                    disabledReason={isDisabled ? 'Select at least 1 item from the list below' : undefined}
                    variant="secondary"
                    className="w-full text-xs py-1.5 mb-2 flex items-center justify-center gap-1.5"
                    icon={view.secondaryAction.icon ? <view.secondaryAction.icon className="w-3 h-3" /> : undefined}
                  >
                    {view.secondaryAction.label}
                  </ActionButton>
                </div>
              )
            })()}

            {/* Export CSV Button (consistent across all cards, human ops workflow) */}
            <div onClick={(e) => e.stopPropagation()}>
              <ActionButton
                onClick={() => onExportCSV(view.id)}
                loading={onExportCSVLoading}
                variant="secondary"
                className="w-full text-xs py-1.5 mb-3 flex items-center justify-center gap-1"
                disabledReason={onExportCSVLoading ? 'Exporting...' : undefined}
                icon={<Download className="w-3 h-3" />}
              >
                Export CSV
              </ActionButton>
            </div>
            
            {/* Pack Preview Slot - Below CTA area */}
            <div onClick={(e) => e.stopPropagation()} className="mt-3 -mb-1">
              {lastPack ? (
                <PackCard
                  variant="compact"
                  packId={lastPack.packId}
                  packType={lastPack.packType}
                  generatedAt={lastPack.generatedAt}
                  integrityStatus={lastPack.integrityStatus ?? 'unverified'}
                  contents={lastPack.contents}
                  onClick={() => {
                    // TODO: Open Pack History drawer with view filter applied
                    // This will be implemented when pack history API is ready
                    console.log('View pack history for:', view.id)
                  }}
                />
              ) : (
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs text-white/60 text-center">
                  No proof packs generated for this view yet.
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

