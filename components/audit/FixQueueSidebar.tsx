'use client'

import { X, AlertTriangle, XCircle, Clock, CheckSquare } from 'lucide-react'
import { buttonStyles } from '@/lib/styles/design-system'
import { motion, AnimatePresence } from 'framer-motion'

export type FixQueueItem = {
  id: string
  rule_code: string
  rule_name: string
  category: 'evidence' | 'controls' | 'attestations' | 'incidents' | 'access'
  severity: 'critical' | 'material' | 'info'
  work_record_id?: string
  work_record_name?: string
  affected_id?: string
  affected_name?: string
  fix_action_type: 'upload_evidence' | 'create_evidence' | 'request_attestation' | 'complete_controls' | 'create_control' | 'resolve_incident' | 'review_item' | 'mark_resolved'
}

interface FixQueueSidebarProps {
  isOpen: boolean
  items: FixQueueItem[]
  onRemove: (id: string) => void
  onClear: () => void
  onFix: (item: FixQueueItem) => void
  onBulkResolve?: () => void
}

export function FixQueueSidebar({
  isOpen,
  items,
  onRemove,
  onClear,
  onFix,
  onBulkResolve,
}: FixQueueSidebarProps) {
  if (!isOpen) return null

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-4 h-4 text-red-400" />
      case 'material':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />
      default:
        return <Clock className="w-4 h-4 text-blue-400" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-red-500/30 bg-red-500/10'
      case 'material':
        return 'border-yellow-500/30 bg-yellow-500/10'
      default:
        return 'border-blue-500/30 bg-blue-500/10'
    }
  }

  const fixActionLabel = (type: string) => {
    switch (type) {
      case 'upload_evidence':
        return 'Upload Evidence'
      case 'request_attestation':
        return 'Request Attestation'
      case 'complete_controls':
        return 'Complete Controls'
      case 'resolve_incident':
        return 'Resolve Incident'
      case 'review_item':
        return 'Review Item'
      default:
        return 'Fix'
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: 400 }}
          animate={{ x: 0 }}
          exit={{ x: 400 }}
          className="fixed right-0 top-0 h-full w-96 bg-[#1A1A1A] border-l border-white/10 z-40 flex flex-col shadow-2xl"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-[#F97316]" />
              <h2 className="text-lg font-semibold text-white">Fix Queue</h2>
              {items.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#F97316] text-black text-xs font-medium">
                  {items.length}
                </span>
              )}
            </div>
            {items.length > 0 && (
              <button
                onClick={onClear}
                className="text-xs text-white/60 hover:text-white transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {items.length === 0 ? (
              <div className="text-center py-12">
                <CheckSquare className="w-12 h-12 text-white/20 mx-auto mb-4" />
                <p className="text-sm text-white/60">No items in queue</p>
                <p className="text-xs text-white/40 mt-2">
                  Click &quot;Resolve&quot; on readiness items to add them here
                </p>
              </div>
            ) : (
              items.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className={`border rounded-lg p-3 ${getSeverityColor(item.severity)}`}
                >
                  <div className="flex items-start gap-2 mb-2">
                    {getSeverityIcon(item.severity)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-white/80 truncate">
                          {item.rule_code}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          item.severity === 'critical' ? 'bg-red-500/30 text-red-300' :
                          item.severity === 'material' ? 'bg-yellow-500/30 text-yellow-300' :
                          'bg-blue-500/30 text-blue-300'
                        }`}>
                          {item.severity}
                        </span>
                      </div>
                      <p className="text-sm text-white font-medium truncate mb-1">
                        {item.rule_name}
                      </p>
                      {item.work_record_name && (
                        <p className="text-xs text-white/50 truncate">
                          {item.work_record_name}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => onRemove(item.id)}
                      className="text-white/40 hover:text-white transition-colors flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => onFix(item)}
                    className={`${buttonStyles.primary} w-full text-sm mt-2`}
                  >
                    {fixActionLabel(item.fix_action_type)}
                  </button>
                </motion.div>
              ))
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="p-4 border-t border-white/10">
              <div className="text-xs text-white/50 mb-3">
                {items.filter(i => i.severity === 'critical').length} critical,{' '}
                {items.filter(i => i.severity === 'material').length} material
              </div>
              
              {/* Action type breakdown */}
              <div className="text-xs text-white/40 mb-3 space-y-1">
                {(() => {
                  const actionCounts = items.reduce((acc, item) => {
                    const action = (item.fix_action_type === 'upload_evidence' || item.fix_action_type === 'create_evidence') ? 'evidence' :
                                   item.fix_action_type === 'request_attestation' ? 'attestation' :
                                   (item.fix_action_type === 'complete_controls' || item.fix_action_type === 'create_control') ? 'control' :
                                   'resolve'
                    acc[action] = (acc[action] || 0) + 1
                    return acc
                  }, {} as Record<string, number>)
                  
                  const preview = Object.entries(actionCounts)
                    .map(([action, count]) => {
                      const label = action === 'evidence' ? 'evidence' : action === 'attestation' ? 'attestations' : action === 'control' ? 'controls' : 'resolutions'
                      return `${count} ${label}`
                    })
                    .join(', ')
                  
                  return preview ? `Will create/request: ${preview}` : null
                })()}
              </div>
              
              {onBulkResolve ? (
                <button
                  onClick={onBulkResolve}
                  className={`${buttonStyles.primary} w-full`}
                >
                  Bulk Resolve ({items.length})
                </button>
              ) : (
                <button
                  onClick={() => {
                    // Fix all items individually (fallback)
                    items.forEach(item => onFix(item))
                  }}
                  className={`${buttonStyles.primary} w-full`}
                >
                  Fix All ({items.length})
                </button>
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

