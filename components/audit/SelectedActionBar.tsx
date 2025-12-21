'use client'

import { X, UserCheck, CheckCircle2, AlertTriangle, UserX, Flag, ShieldCheck, FileCheck } from 'lucide-react'
import { buttonStyles } from '@/lib/styles/design-system'
import type { SavedView } from '@/app/operations/audit/page'

interface SelectedActionBarProps {
  selectedCount: number
  activeView: SavedView
  userRole?: string
  isExecutive?: boolean
  onClearSelection: () => void
  onAssign: () => void
  onResolve: () => void
  onCreateCorrectiveAction: () => void
  onCloseIncident: () => void
  onRevokeAccess: () => void
  onFlagSuspicious: () => void
}

export function SelectedActionBar({
  selectedCount,
  activeView,
  userRole,
  isExecutive,
  onClearSelection,
  onAssign,
  onResolve,
  onCreateCorrectiveAction,
  onCloseIncident,
  onRevokeAccess,
  onFlagSuspicious,
}: SelectedActionBarProps) {
  if (selectedCount === 0) return null

  const isReadOnly = isExecutive || userRole === 'executive'

  return (
    <div className="sticky top-0 z-40 bg-gradient-to-r from-[#0A0A0A] via-[#1A1A1A] to-[#0A0A0A] border-b border-white/10 px-6 py-3 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-white font-medium">
            {selectedCount} {selectedCount === 1 ? 'item' : 'items'} selected
          </div>
          <button
            onClick={onClearSelection}
            className="text-white/60 hover:text-white transition-colors text-sm flex items-center gap-1"
          >
            <X size={14} />
            Clear
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeView === 'review-queue' && (
            <>
              <button
                onClick={onAssign}
                disabled={isReadOnly}
                title={isReadOnly ? 'Read-only by governance policy' : 'Assign selected items'}
                className={`${buttonStyles.secondary} ${buttonStyles.sizes.sm} flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <UserCheck size={16} />
                Assign
              </button>
              <button
                onClick={onResolve}
                disabled={isReadOnly}
                title={isReadOnly ? 'Read-only by governance policy' : 'Resolve selected items'}
                className={`${buttonStyles.secondary} ${buttonStyles.sizes.sm} flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <CheckCircle2 size={16} />
                Resolve
              </button>
            </>
          )}

          {activeView === 'incident-review' && (
            <>
              <button
                onClick={onCreateCorrectiveAction}
                disabled={isReadOnly}
                title={isReadOnly ? 'Read-only by governance policy' : 'Create corrective action'}
                className={`${buttonStyles.secondary} ${buttonStyles.sizes.sm} flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <AlertTriangle size={16} />
                Create Corrective Action
              </button>
              <button
                onClick={onCloseIncident}
                disabled={isReadOnly}
                title={isReadOnly ? 'Read-only by governance policy' : 'Close incident'}
                className={`${buttonStyles.secondary} ${buttonStyles.sizes.sm} flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <FileCheck size={16} />
                Close Incident
              </button>
            </>
          )}

          {activeView === 'access-review' && (
            <>
              <button
                onClick={onRevokeAccess}
                disabled={isReadOnly || userRole !== 'owner' && userRole !== 'admin'}
                title={isReadOnly ? 'Read-only by governance policy' : userRole !== 'owner' && userRole !== 'admin' ? 'Only owners and admins can revoke access' : 'Revoke access'}
                className={`${buttonStyles.secondary} ${buttonStyles.sizes.sm} flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <UserX size={16} />
                Revoke Access
              </button>
              <button
                onClick={onFlagSuspicious}
                disabled={isReadOnly}
                title={isReadOnly ? 'Read-only by governance policy' : 'Flag suspicious access'}
                className={`${buttonStyles.secondary} ${buttonStyles.sizes.sm} flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Flag size={16} />
                Flag Suspicious
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

