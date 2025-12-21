'use client'

import { useState } from 'react'
import { CheckCircle, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { useSelectedRows } from '@/lib/hooks/useSelectedRows'
import { buttonStyles } from '@/lib/styles/design-system'

interface AuditEvent {
  id: string
  event_name?: string
  event_type?: string
  created_at: string
  category?: string
  severity?: 'critical' | 'material' | 'info'
  outcome?: 'blocked' | 'allowed' | 'success' | 'failure'
  actor_name?: string
  actor_email?: string
  job_title?: string
  work_record_id?: string
  job_id?: string
  summary?: string
  metadata?: any
}

interface EventSelectionTableProps {
  events: AuditEvent[]
  view: string
  selectedIds?: string[] // Optional: use external selection state if provided
  onSelect?: (eventId: string) => void
  onRowClick?: (event: AuditEvent) => void
  showActions?: boolean
  userRole?: string
}

export function EventSelectionTable({ 
  events, 
  view,
  selectedIds: externalSelectedIds,
  onSelect, 
  onRowClick,
  showActions = false,
  userRole
}: EventSelectionTableProps) {
  // Use external selection if provided, otherwise use internal hook
  const internalSelection = useSelectedRows()
  const selectedIds = externalSelectedIds || internalSelection.selectedIds
  const toggleSelection = internalSelection.toggleSelection
  const isSelected = (id: string) => selectedIds.includes(id)
  const clearSelection = internalSelection.clearSelection
  const selectedCount = selectedIds.length
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleExpanded = (eventId: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId)
    } else {
      newExpanded.add(eventId)
    }
    setExpandedRows(newExpanded)
  }

  const handleCheckboxClick = (e: React.MouseEvent, eventId: string) => {
    e.stopPropagation()
    toggleSelection(eventId)
    onSelect?.(eventId)
  }

  const isReadOnly = userRole === 'executive'

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#121212]/80 backdrop-blur-sm p-6 text-center">
        <p className="text-white/60">No events found for this view.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#121212]/80 backdrop-blur-sm overflow-hidden">
      {/* Table Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-white">
            {view === 'review-queue' && 'Review Queue'}
            {view === 'access-review' && 'Access Events'}
            {view === 'incident-review' && 'Incident Timeline'}
            {view === 'governance-enforcement' && 'Enforcement Events'}
            {view === 'insurance-ready' && 'Insurance-Ready Records'}
          </h3>
          {selectedCount > 0 && (
            <span className="text-sm text-white/60">
              {selectedCount} selected
              <button
                onClick={clearSelection}
                className="ml-2 text-xs text-[#F97316] hover:text-[#FFC857]"
              >
                Clear
              </button>
            </span>
          )}
        </div>
        <div className="text-sm text-white/60">
          {events.length} {events.length === 1 ? 'event' : 'events'}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-white/5 border-b border-white/10">
            <tr>
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedIds.length === events.length && events.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      events.forEach(event => toggleSelection(event.id))
                    } else {
                      clearSelection()
                    }
                  }}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#F97316] focus:ring-[#F97316]"
                  disabled={isReadOnly}
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Event</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Severity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Outcome</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Actor</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {events.map((event) => {
              const selected = isSelected(event.id)
              const expanded = expandedRows.has(event.id)
              
              return (
                <tr
                  key={event.id}
                  className={`hover:bg-white/5 transition-colors cursor-pointer ${
                    selected ? 'bg-[#F97316]/10' : ''
                  }`}
                  onClick={() => {
                    if (!isReadOnly) {
                      toggleSelection(event.id)
                      onSelect?.(event.id)
                    }
                    onRowClick?.(event)
                  }}
                >
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(e) => handleCheckboxClick(e as any, event.id)}
                      onClick={(e) => e.stopPropagation()}
                      disabled={isReadOnly}
                      className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#F97316] focus:ring-[#F97316]"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleExpanded(event.id)
                        }}
                        className="text-white/40 hover:text-white/60"
                      >
                        {expanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                      <div>
                        <div className="text-sm font-medium text-white">
                          {event.event_name || event.event_type || 'Unknown Event'}
                        </div>
                        {event.job_title && (
                          <div className="text-xs text-white/60">{event.job_title}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs px-2 py-1 rounded bg-white/10 text-white/80">
                      {event.category || 'operations'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded ${
                      event.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                      event.severity === 'material' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {event.severity || 'info'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded ${
                      event.outcome === 'blocked' ? 'bg-red-500/20 text-red-400' :
                      event.outcome === 'failure' ? 'bg-orange-500/20 text-orange-400' :
                      'bg-green-500/20 text-green-400'
                    }`}>
                      {event.outcome || 'allowed'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-white/80">
                    {event.actor_name || event.actor_email || 'System'}
                  </td>
                  <td className="px-6 py-4 text-sm text-white/60">
                    {new Date(event.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    {expanded && (
                      <div className="text-xs text-white/60 space-y-1">
                        {event.summary && <div>{event.summary}</div>}
                        {event.work_record_id && (
                          <div>
                            Work Record: <span className="text-[#F97316]">{event.work_record_id.slice(0, 8)}...</span>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Selected Actions Bar */}
      {selectedCount > 0 && showActions && !isReadOnly && (
        <div className="px-6 py-3 border-t border-white/10 bg-white/5 flex items-center justify-between">
          <span className="text-sm text-white/80">
            {selectedCount} {selectedCount === 1 ? 'item' : 'items'} selected
          </span>
          <div className="flex gap-2">
            {/* Actions will be injected by parent component via props */}
          </div>
        </div>
      )}
    </div>
  )
}


