'use client'

import { Shield, FileCheck, AlertTriangle, UserCheck, Download, Package, UserPlus, CheckCircle, FileText, Ban, Flag } from 'lucide-react'
import { buttonStyles } from '@/lib/styles/design-system'
import { terms } from '@/lib/terms'
import { ActionButton } from '@/components/shared'

interface SavedViewCardsProps {
  activeView: string
  selectedCount?: number // Number of selected items (action buttons require selection)
  onSelectView: (view: 'review-queue' | 'insurance-ready' | 'governance-enforcement' | 'incident-review' | 'access-review' | '') => void
  onExportCSV: (view: string) => void // CSV export only (human ops workflow)
  onExportCSVLoading?: boolean // Loading state for CSV export
  onGeneratePack?: (view: string) => void
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
  onGeneratePack,
  onAssign,
  onResolve,
  onExportEnforcement,
  onCreateCorrectiveAction,
  onCloseIncident,
  onRevokeAccess,
  onFlagSuspicious,
}: SavedViewCardsProps) {
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
      primaryAction: {
        label: 'Generate Proof Pack',
        icon: Package,
        handler: onGeneratePack,
      },
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
              {isActive && (
                <span className="text-xs px-2 py-0.5 bg-[#F97316] text-white rounded">Active</span>
              )}
            </div>
            <h3 className="font-semibold mb-2 text-white">{view.title}</h3>
            <p className="text-sm text-white/70 mb-3">{view.description}</p>
            
            {/* Primary Action Button */}
            {view.primaryAction && (() => {
              // Action buttons (Assign, Resolve, Create Corrective Action, etc.) require selection
              // Export buttons (Generate Proof Pack, Export Enforcement Report) don't require selection
              const requiresSelection = ['Assign', 'Resolve', 'Create Corrective Action', 'Close Incident', 'Revoke Access', 'Flag Suspicious'].includes(view.primaryAction.label)
              const isDisabled = requiresSelection && selectedCount === 0
              
              return (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!isDisabled) {
                      view.primaryAction?.handler?.(view.id)
                    }
                  }}
                  disabled={isDisabled}
                  title={isDisabled ? 'Select at least 1 item from the list below' : undefined}
                  className={`${buttonStyles.primary} w-full text-xs py-2 mb-2 flex items-center justify-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {view.primaryAction.icon && <view.primaryAction.icon className="w-3.5 h-3.5" />}
                  {view.primaryAction.label}
                </button>
              )
            })()}

            {/* Secondary Action Button (if exists) */}
            {view.secondaryAction && (() => {
              // Action buttons require selection
              const requiresSelection = ['Assign', 'Resolve', 'Create Corrective Action', 'Close Incident', 'Revoke Access', 'Flag Suspicious'].includes(view.secondaryAction.label)
              const isDisabled = requiresSelection && selectedCount === 0
              
              return (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!isDisabled) {
                      view.secondaryAction?.handler?.(view.id)
                    }
                  }}
                  disabled={isDisabled}
                  title={isDisabled ? 'Select at least 1 item from the list below' : undefined}
                  className={`${buttonStyles.secondary} w-full text-xs py-1.5 mb-2 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {view.secondaryAction.icon && <view.secondaryAction.icon className="w-3 h-3" />}
                  {view.secondaryAction.label}
                </button>
              )
            })()}

            {/* Export CSV Button (consistent across all cards, human ops workflow) */}
            <div onClick={(e) => e.stopPropagation()}>
              <ActionButton
                onClick={() => onExportCSV(view.id)}
                loading={onExportCSVLoading}
                variant="secondary"
                className="w-full text-xs py-1.5 mt-2 flex items-center justify-center gap-1"
                disabledReason={onExportCSVLoading ? 'Exporting...' : undefined}
                icon={<Download className="w-3 h-3" />}
              >
                Export CSV
              </ActionButton>
            </div>
          </div>
        )
      })}
    </div>
  )
}

