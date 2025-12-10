'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { X, Edit, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface HazardTemplate {
  id: string
  name: string
  trade?: string
  description?: string
  hazard_ids: string[]
}

interface JobTemplate {
  id: string
  name: string
  trade?: string
  job_type?: string
  client_type?: string
  description?: string
  hazard_template_ids: string[]
}

interface RiskFactor {
  id: string
  code: string
  name: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: string
}

interface TemplateDetailDrawerProps {
  template: HazardTemplate | JobTemplate
  type: 'hazard' | 'job'
  organizationId: string
  usageCount: number
  riskFactors: RiskFactor[]
  onClose: () => void
  onEdit: () => void
}

export function TemplateDetailDrawer({
  template,
  type,
  organizationId,
  usageCount,
  riskFactors,
  onClose,
  onEdit,
}: TemplateDetailDrawerProps) {
  const router = useRouter()
  const [recentJobs, setRecentJobs] = useState<Array<{
    id: string
    client_name: string
    status: string
    created_at: string
  }>>([])
  const [loadingJobs, setLoadingJobs] = useState(true)

  useEffect(() => {
    loadRecentJobs()
  }, [template.id, type])

  const loadRecentJobs = async () => {
    try {
      const supabase = createSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('jobs')
        .select('id, client_name, status, created_at')
        .eq('organization_id', organizationId)
        .eq('applied_template_id', template.id)
        .eq('applied_template_type', type)
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) throw error
      setRecentJobs(data || [])
    } catch (err) {
      console.error('Failed to load recent jobs:', err)
    } finally {
      setLoadingJobs(false)
    }
  }

  const templateHazards = type === 'hazard'
    ? riskFactors.filter((rf) => (template as HazardTemplate).hazard_ids?.includes(rf.id))
    : []

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-end"
        onClick={onClose}
      >
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md h-full bg-[#121212] border-l border-white/10 shadow-2xl overflow-y-auto"
        >
          <div className="sticky top-0 bg-[#121212] border-b border-white/10 p-6 flex items-center justify-between z-10">
            <h2 className="text-xl font-semibold text-white">Template Details</h2>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Template Info */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">{template.name}</h3>
              {template.trade && (
                <p className="text-sm text-white/60 mb-1">Trade: {template.trade}</p>
              )}
              {type === 'job' && (template as JobTemplate).job_type && (
                <p className="text-sm text-white/60 mb-1">
                  Job Type: {(template as JobTemplate).job_type}
                </p>
              )}
              {template.description && (
                <p className="text-sm text-white/70 mt-3">{template.description}</p>
              )}
            </div>

            {/* Usage Stats */}
            <div className="p-4 rounded-lg border border-white/10 bg-white/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">Used in</span>
                <span className="text-lg font-semibold text-[#F97316]">{usageCount} job{usageCount !== 1 ? 's' : ''}</span>
              </div>
              {usageCount > 0 && (
                <button
                  onClick={() => {
                    router.push(`/dashboard/jobs?template=${template.id}`)
                    onClose()
                  }}
                  className="text-xs text-[#F97316] hover:text-[#FB923C] flex items-center gap-1 mt-2"
                >
                  View all jobs <ExternalLink size={12} />
                </button>
              )}
            </div>

            {/* Hazards List */}
            {type === 'hazard' && templateHazards.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-white mb-3">
                  Hazards ({templateHazards.length})
                </h4>
                <div className="space-y-2">
                  {templateHazards.map((hazard) => (
                    <div
                      key={hazard.id}
                      className="p-3 rounded-lg border border-white/10 bg-black/20"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-white">{hazard.name}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            hazard.severity === 'critical'
                              ? 'bg-red-500/20 text-red-400'
                              : hazard.severity === 'high'
                              ? 'bg-orange-500/20 text-orange-400'
                              : hazard.severity === 'medium'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-blue-500/20 text-blue-400'
                          }`}
                        >
                          {hazard.severity}
                        </span>
                      </div>
                      <p className="text-xs text-white/50 mt-0.5">{hazard.category}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Jobs */}
            {usageCount > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-white mb-3">Recent Jobs</h4>
                {loadingJobs ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#F97316] mx-auto" />
                  </div>
                ) : recentJobs.length > 0 ? (
                  <div className="space-y-2">
                    {recentJobs.map((job) => (
                      <button
                        key={job.id}
                        onClick={() => {
                          router.push(`/dashboard/jobs/${job.id}`)
                          onClose()
                        }}
                        className="w-full text-left p-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-white">{job.client_name}</p>
                            <p className="text-xs text-white/50 mt-0.5">
                              {new Date(job.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <span className="text-xs px-2 py-1 rounded bg-white/10 text-white/70">
                            {job.status}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-white/50">No jobs found</p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="pt-4 border-t border-white/10">
              <button
                onClick={onEdit}
                className="w-full px-4 py-2 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Edit size={16} />
                Edit Template
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

