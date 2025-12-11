'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'

interface VersionHistoryEntry {
  id: string
  field: string
  oldValue: string | null
  newValue: string | null
  changedBy: string
  changedAt: string
  changeType: 'created' | 'updated' | 'deleted'
}

interface VersionHistoryProps {
  jobId: string
  entries: VersionHistoryEntry[]
}

export function VersionHistory({ jobId, entries }: VersionHistoryProps) {
  const [expanded, setExpanded] = useState(false)

  const formatChange = (entry: VersionHistoryEntry) => {
    if (entry.changeType === 'created') {
      return `Created ${entry.field}`
    }
    if (entry.changeType === 'deleted') {
      return `Deleted ${entry.field}`
    }
    return `Updated ${entry.field} from "${entry.oldValue || 'empty'}" to "${entry.newValue || 'empty'}"`
  }

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'created':
        return '➕'
      case 'updated':
        return '✏️'
      case 'deleted':
        return '🗑️'
      default:
        return '📝'
    }
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-[#121212]/80 backdrop-blur-sm p-6">
        <h3 className="text-lg font-semibold text-white mb-2">Version History</h3>
        <p className="text-sm text-white/50">No changes recorded yet</p>
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

      <div className="space-y-3">
        {(expanded ? entries : entries.slice(0, 5)).map((entry, index) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-start gap-3 p-3 rounded-lg bg-[#121212]/60 border border-white/10"
          >
            <span className="text-lg">{getChangeIcon(entry.changeType)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/80 mb-1">{formatChange(entry)}</p>
              <div className="flex items-center gap-2 text-xs text-white/50">
                <span>by {entry.changedBy}</span>
                <span>•</span>
                <span>{new Date(entry.changedAt).toLocaleString()}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

