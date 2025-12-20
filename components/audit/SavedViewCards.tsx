'use client'

import { Shield, FileCheck, AlertTriangle, UserCheck, Download } from 'lucide-react'
import { buttonStyles } from '@/lib/styles/design-system'

interface SavedViewCardsProps {
  activeView: string
  onSelectView: (view: 'review-queue' | 'insurance-ready' | 'governance-enforcement' | 'incident-review' | 'access-review' | '') => void
  onExport: (format: 'csv' | 'json', view: string) => void
}

export function SavedViewCards({ activeView, onSelectView, onExport }: SavedViewCardsProps) {
  const views = [
    {
      id: 'review-queue',
      title: 'Review Queue',
      icon: AlertTriangle,
      description: 'Outstanding governance issues requiring action: flagged jobs, critical events, blocked actions, and unresolved exposure.',
      color: 'bg-orange-500/25 border-orange-500/40 text-orange-300',
      hoverColor: 'hover:bg-orange-500/35',
      priority: true, // Mark as priority view
    },
    {
      id: 'insurance-ready',
      title: 'Insurance-Ready',
      icon: FileCheck,
      description: 'Includes completed jobs, proof packs, sign-offs, and risk summaries — ready for insurer request.',
      color: 'bg-green-500/20 border-green-500/30 text-green-400',
      hoverColor: 'hover:bg-green-500/30',
    },
    {
      id: 'governance-enforcement',
      title: 'Governance Enforcement',
      icon: Shield,
      description: 'Shows blocked actions + policy violations — proves role enforcement.',
      color: 'bg-red-500/20 border-red-500/30 text-red-400',
      hoverColor: 'hover:bg-red-500/30',
    },
    {
      id: 'incident-review',
      title: 'Incident Review',
      icon: AlertTriangle,
      description: 'Flagged jobs, escalations, and mitigation actions — complete incident trail.',
      color: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400',
      hoverColor: 'hover:bg-yellow-500/30',
    },
    {
      id: 'access-review',
      title: 'Access Review',
      icon: UserCheck,
      description: 'Role changes, login events, and access revocations — security governance record.',
      color: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
      hoverColor: 'hover:bg-blue-500/30',
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
            <p className="text-sm text-white/70 mb-4">{view.description}</p>
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onExport('csv', view.id)
                }}
                className={`${buttonStyles.secondary} flex-1 text-xs py-1.5 flex items-center justify-center gap-1`}
              >
                <Download className="w-3 h-3" />
                CSV
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onExport('json', view.id)
                }}
                className={`${buttonStyles.secondary} flex-1 text-xs py-1.5 flex items-center justify-center gap-1`}
              >
                <Download className="w-3 h-3" />
                JSON
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

