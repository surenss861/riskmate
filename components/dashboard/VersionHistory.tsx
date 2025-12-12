'use client'

import { motion } from 'framer-motion'
import { useState, useMemo } from 'react'
import { Plus, Edit, Trash2, FileText, Image, CheckCircle, XCircle, User, Calendar } from 'lucide-react'

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
        <h3 className="text-lg font-semibold text-white mb-2">Version History</h3>
        <p className="text-sm text-white font-medium mb-2">No activity recorded yet</p>
        <p className="text-xs text-white/60 max-w-md">
          Every change to this job is logged here automatically. This creates an audit trail for compliance, insurance, and legal protection. Activity will appear as you work on the job.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-white/10 bg-[#121212]/80 backdrop-blur-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Version History</h3>
          <p className="text-xs text-white/50 mt-0.5">
            Track all changes made to this job
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
                {(expanded || dateGroup === 'Today' ? groupEntries : groupEntries.slice(0, 5)).map((entry, index) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="flex items-start gap-3 p-3 rounded-lg bg-[#121212]/60 border border-white/10 hover:bg-[#121212]/80 transition-colors group"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {getChangeIcon(entry)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/90 mb-1 group-hover:text-white transition-colors">
                        {formatChange(entry)}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-white/50">
                        <span>by {entry.changedBy}</span>
                        <span>•</span>
                        <span>{new Date(entry.changedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                        {entry.metadata?.templateId && (
                          <>
                            <span>•</span>
                            <button className="text-[#F97316] hover:text-[#FB923C] transition-colors">
                              View template
                            </button>
                          </>
                        )}
                        {entry.metadata?.documentId && (
                          <>
                            <span>•</span>
                            <button className="text-[#F97316] hover:text-[#FB923C] transition-colors">
                              View evidence
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

