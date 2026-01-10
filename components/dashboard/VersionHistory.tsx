'use client'

import { motion } from 'framer-motion'
import { useState, useMemo } from 'react'
import { Plus, Edit, Trash2, FileText, Image, CheckCircle, XCircle, User, Calendar } from 'lucide-react'
import { EventChip, TrustReceiptStrip, IntegrityBadge, EnforcementBanner, EmptyState } from '@/components/shared'
import { getEventMapping } from '@/lib/audit/eventMapper'

interface VersionHistoryEntry {
  id: string
  field: string
  oldValue: string | null
  newValue: string | null
  changedBy: string
  changedAt: string
  changeType: 'created' | 'updated' | 'deleted'
  actionType?: 'job_created' | 'hazard_added' | 'hazard_removed' | 'mitigation_completed' | 'photo_uploaded' | 'evidence_approved' | 'evidence_rejected' | 'template_applied' | 'worker_assigned' | 'worker_unassigned' | 'status_changed' | 'pdf_generated'
  metadata?: {
    templateId?: string
    workerId?: string
    documentId?: string
    photoCount?: number
  }
}

interface VersionHistoryProps {
  jobId: string
  entries: VersionHistoryEntry[]
}

export function VersionHistory({ jobId, entries }: VersionHistoryProps) {
  const [expanded, setExpanded] = useState(false)

  // Group entries by date
  const groupedEntries = useMemo(() => {
    const groups: { [key: string]: VersionHistoryEntry[] } = {}
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    entries.forEach((entry) => {
      const entryDate = new Date(entry.changedAt)
      entryDate.setHours(0, 0, 0, 0)

      let groupKey: string
      if (entryDate.getTime() === today.getTime()) {
        groupKey = 'Today'
      } else if (entryDate.getTime() === yesterday.getTime()) {
        groupKey = 'Yesterday'
      } else {
        groupKey = entryDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      }

      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(entry)
    })

    return groups
  }, [entries])

  const formatChange = (entry: VersionHistoryEntry) => {
    if (entry.actionType) {
      switch (entry.actionType) {
        case 'job_created':
          return 'Job created'
        case 'hazard_added':
          return `Hazard added: ${entry.field}`
        case 'hazard_removed':
          return `Hazard removed: ${entry.field}`
        case 'mitigation_completed':
          return `Mitigation completed: ${entry.field}`
        case 'photo_uploaded':
          return `Uploaded ${entry.metadata?.photoCount || 1} photo${(entry.metadata?.photoCount || 1) > 1 ? 's' : ''}`
        case 'evidence_approved':
          return `Evidence approved: ${entry.field}`
        case 'evidence_rejected':
          return `Evidence rejected: ${entry.field}`
        case 'template_applied':
          return `Template applied: ${entry.field}`
        case 'worker_assigned':
          return `Worker assigned: ${entry.field}`
        case 'worker_unassigned':
          return `Worker unassigned: ${entry.field}`
        case 'status_changed':
          return `Status changed to ${entry.newValue}`
        case 'pdf_generated':
          return 'PDF report generated'
        default:
          break
      }
    }

    if (entry.changeType === 'created') {
      return `Created ${entry.field}`
    }
    if (entry.changeType === 'deleted') {
      return `Deleted ${entry.field}`
    }
    return `Updated ${entry.field}`
  }

  const getChangeIcon = (entry: VersionHistoryEntry) => {
    if (entry.actionType) {
      switch (entry.actionType) {
        case 'job_created':
          return <Plus size={16} className="text-[#F97316]" />
        case 'hazard_added':
        case 'hazard_removed':
          return <FileText size={16} className="text-orange-400" />
        case 'mitigation_completed':
          return <CheckCircle size={16} className="text-green-400" />
        case 'photo_uploaded':
          return <Image size={16} className="text-blue-400" />
        case 'evidence_approved':
          return <CheckCircle size={16} className="text-green-400" />
        case 'evidence_rejected':
          return <XCircle size={16} className="text-red-400" />
        case 'template_applied':
          return <FileText size={16} className="text-purple-400" />
        case 'worker_assigned':
        case 'worker_unassigned':
          return <User size={16} className="text-cyan-400" />
        case 'status_changed':
          return <Edit size={16} className="text-yellow-400" />
        case 'pdf_generated':
          return <FileText size={16} className="text-[#F97316]" />
        default:
          break
      }
    }

    switch (entry.changeType) {
      case 'created':
        return <Plus size={16} className="text-green-400" />
      case 'updated':
        return <Edit size={16} className="text-blue-400" />
      case 'deleted':
        return <Trash2 size={16} className="text-red-400" />
      default:
        return <FileText size={16} className="text-white/60" />
    }
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-[#121212]/80 backdrop-blur-sm p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Chain of Custody</h3>
        <EmptyState
          title="No chain of custody events"
          description="No ledger events exist for this record in the selected range."
          hint="If this seems wrong, check filters or data scope."
        />
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-white/10 bg-[#121212]/80 backdrop-blur-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Chain of Custody</h3>
          <p className="text-xs text-white/50 mt-0.5">
            Immutable ledger events for this work record
          </p>
        </div>
        {entries.length > 5 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-[#F97316] hover:text-[#FB923C] transition-colors"
          >
            {expanded ? 'Show Less' : `Show All (${entries.length})`}
          </button>
        )}
      </div>

      <div className="space-y-6">
        {Object.entries(groupedEntries)
          .slice(0, expanded ? undefined : 1)
          .map(([dateGroup, groupEntries]) => (
            <div key={dateGroup}>
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={14} className="text-white/40" />
                <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                  {dateGroup}
                </h4>
              </div>
              <div className="space-y-2 pl-5 border-l border-white/10">
                {(expanded || dateGroup === 'Today' ? groupEntries : groupEntries.slice(0, 5)).map((entry, index) => {
                  // Map VersionHistoryEntry to event format for trust components
                  const eventType = entry.actionType 
                    ? entry.actionType.replace(/_/g, '.')
                    : entry.changeType === 'created' 
                    ? 'job.created'
                    : entry.changeType === 'deleted'
                    ? 'job.deleted'
                    : 'job.updated'
                  
                  const mapping = getEventMapping(eventType)
                  
                  // Determine severity from actionType or default to 'info'
                  let severity: 'critical' | 'material' | 'info' = mapping.severity || 'info'
                  if (entry.actionType === 'evidence_rejected' || entry.changeType === 'deleted') {
                    severity = 'material'
                  }
                  
                  // Determine outcome from actionType or default to 'allowed'
                  let outcome: 'blocked' | 'allowed' | 'success' | 'failure' = mapping.outcome || 'allowed'
                  if (entry.actionType === 'evidence_approved' || entry.actionType === 'mitigation_completed') {
                    outcome = 'success'
                  } else if (entry.actionType === 'evidence_rejected') {
                    outcome = 'failure'
                  }
                  
                  const isBlocked = outcome === 'blocked' || outcome === 'failure'
                  
                  return (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="p-4 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors space-y-3"
                    >
                      {/* EventChip: Type + Severity + Outcome */}
                      <div>
                        <EventChip
                          eventType={eventType}
                          severity={severity}
                          outcome={outcome}
                          showOutcome
                        />
                      </div>
                      
                      {/* TrustReceiptStrip: Who/When/What/Why */}
                      <div>
                        <TrustReceiptStrip
                          actorName={entry.changedBy || 'System'}
                          actorRole={undefined}
                          occurredAt={entry.changedAt}
                          eventType={eventType}
                          category={mapping.category}
                          summary={formatChange(entry)}
                          compact
                        />
                      </div>
                      
                      {/* IntegrityBadge */}
                      <div>
                        <IntegrityBadge
                          status="unverified"
                          showDetails
                        />
                      </div>
                      
                      {/* EnforcementBanner: Show for blocked outcomes */}
                      {isBlocked && mapping.policyStatement && (
                        <div>
                          <EnforcementBanner
                            action={formatChange(entry)}
                            blocked={true}
                            eventId={entry.id}
                            policyStatement={mapping.policyStatement}
                            actorRole={undefined}
                            severity={severity}
                          />
                        </div>
                      )}
                      
                      {/* Metadata links */}
                      {(entry.metadata?.templateId || entry.metadata?.documentId) && (
                        <div className="flex items-center gap-2 text-xs text-white/50 pt-2 border-t border-white/10">
                          {entry.metadata?.templateId && (
                            <button className="text-[#F97316] hover:text-[#FB923C] transition-colors">
                              View template
                            </button>
                          )}
                          {entry.metadata?.documentId && (
                            <button className="text-[#F97316] hover:text-[#FB923C] transition-colors">
                              View evidence
                            </button>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

