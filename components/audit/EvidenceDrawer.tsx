'use client'

import { X, ExternalLink, Download, FileText, Calendar, User, Building2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { buttonStyles } from '@/lib/styles/design-system'

interface EvidenceDrawerProps {
  isOpen: boolean
  onClose: () => void
  jobId?: string
  jobName?: string
  siteName?: string
  events?: Array<{
    id: string
    event_type: string
    user_name?: string
    created_at: string
    summary?: string
  }>
  onExportEvidence: () => void
}

export function EvidenceDrawer({ isOpen, onClose, jobId, jobName, siteName, events = [], onExportEvidence }: EvidenceDrawerProps) {
  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80"
        />
        
        {/* Drawer */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="relative ml-auto w-full max-w-2xl bg-[#0A0A0A] border-l border-white/10 shadow-2xl overflow-y-auto"
        >
          <div className="sticky top-0 bg-[#0A0A0A] border-b border-white/10 p-6 flex items-center justify-between z-10">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Evidence Bundle</h2>
              {jobName && (
                <p className="text-sm text-white/60">{jobName}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white/60" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Job Info */}
            {jobId && (
              <div className="bg-white/5 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-3">Related Resource</h3>
                <div className="space-y-2">
                  {jobName && (
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="w-4 h-4 text-white/60" />
                      <span className="text-white/90">{jobName}</span>
                    </div>
                  )}
                  {siteName && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="w-4 h-4 text-white/60" />
                      <span className="text-white/90">{siteName}</span>
                    </div>
                  )}
                  <div className="flex gap-2 mt-3">
                    <a
                      href={`/operations/jobs/${jobId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${buttonStyles.secondary} text-xs py-1.5 flex items-center gap-1`}
                    >
                      View Job
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href={`/operations/jobs/${jobId}?view=packet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${buttonStyles.secondary} text-xs py-1.5 flex items-center gap-1`}
                    >
                      Job Packet
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Timeline */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">Timeline</h3>
                <button
                  onClick={onExportEvidence}
                  className={`${buttonStyles.secondary} text-xs py-1.5 flex items-center gap-1`}
                >
                  <Download className="w-3 h-3" />
                  Export Evidence Slice
                </button>
              </div>
              <div className="space-y-3">
                {events.length > 0 ? (
                  events.map((event) => (
                    <div key={event.id} className="bg-white/5 rounded-lg p-3 border border-white/10">
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-[#F97316] mt-2 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-white">{event.event_type}</span>
                            {event.user_name && (
                              <span className="text-xs text-white/60 flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {event.user_name}
                              </span>
                            )}
                          </div>
                          {event.summary && (
                            <p className="text-xs text-white/70 mb-2">{event.summary}</p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-white/50">
                            <Calendar className="w-3 h-3" />
                            {new Date(event.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-white/60 text-center py-8">No related events found</p>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

