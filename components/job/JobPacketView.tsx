'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Download, FileText, Shield, CheckCircle, Clock, User, Flag, Upload, X, Image as ImageIcon, ExternalLink, Loader2 } from 'lucide-react'
import { cardStyles, buttonStyles, typography } from '@/lib/styles/design-system'
import { jobsApi } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { TrustReceiptStrip, IntegrityBadge, EnforcementBanner, EmptyState } from '@/components/shared'
import { getEffectivePhotoCategory, type PhotoCategory } from '@/lib/utils/photoCategory'

export type { PhotoCategory }

function getDefaultCategory(jobStatus: string): PhotoCategory {
  if (jobStatus === 'draft') return 'before'
  if (jobStatus === 'completed' || jobStatus === 'archived') return 'after'
  return 'during'
}

type UploadTaskStatus = 'uploading' | 'success' | 'failed'

interface UploadTask {
  id: string
  file: File
  status: UploadTaskStatus
  progress: number
  error?: string
  category?: PhotoCategory
}

interface Attachment {
  id: string
  name: string
  type: 'photo' | 'document' | 'permit' | 'inspection'
  url?: string
  file_path?: string
  created_at: string
  category?: PhotoCategory
}

interface Signoff {
  id: string
  signer_id: string
  signer_role: string
  signer_name: string
  signoff_type: string
  status: 'pending' | 'signed' | 'rejected'
  signed_at?: string
  comments?: string
}

interface JobPacketViewProps {
  job: {
    id: string
    client_name: string
    job_type: string
    location: string
    status: string
    risk_score: number | null
    risk_level: string | null
    review_flag?: boolean
    flagged_at?: string | null
    site_id?: string | null
    site_name?: string | null
    start_date?: string | null
    end_date?: string | null
  }
  mitigations?: Array<{
    id: string
    title: string
    description: string
    done: boolean
  }>
  auditTimeline?: Array<{
    id: string
    event_type: string
    user_name?: string
    created_at: string
    metadata?: any
  }>
  attachments?: Attachment[]
  signoffs?: Signoff[]
  onExport?: (packType: 'insurance' | 'audit' | 'incident' | 'compliance') => void
  onAttachmentUploaded?: () => void
  onAttachmentCategoryChange?: (docId: string, category: PhotoCategory) => Promise<void>
}

export function JobPacketView({ 
  job, 
  mitigations = [], 
  auditTimeline = [], 
  attachments = [],
  signoffs = [],
  onExport,
  onAttachmentUploaded,
  onAttachmentCategoryChange,
}: JobPacketViewProps) {
  const router = useRouter()
  const [selectedPack, setSelectedPack] = useState<'insurance' | 'audit' | 'incident' | 'compliance' | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadQueue, setUploadQueue] = useState<UploadTask[]>([])
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [uploadCategory, setUploadCategory] = useState<PhotoCategory>(() => getDefaultCategory(job.status))
  const [photoFilter, setPhotoFilter] = useState<'all' | PhotoCategory>('all')
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setUploadCategory(getDefaultCategory(job.status))
  }, [job.status])

  const runUpload = async (task: UploadTask, category?: PhotoCategory) => {
    if (task.status !== 'uploading') return
    const fileType = task.file.type.startsWith('image/') ? 'photo' :
      task.file.name.includes('permit') ? 'permit' :
      task.file.name.includes('inspection') ? 'inspection' : 'document'
    const isPhoto = fileType === 'photo'
    const photoCategory = category ?? task.category
    try {
      await jobsApi.uploadDocument(job.id, task.file, {
        name: task.file.name,
        type: fileType,
        description: `Uploaded for ${selectedPack || 'job'} packet`,
        ...(isPhoto && photoCategory ? { category: photoCategory } : {}),
      })
      setUploadQueue((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: 'success' as const, progress: 100 } : t))
      )
      onAttachmentUploaded?.()
      setTimeout(() => {
        setUploadQueue((prev) => prev.filter((t) => t.id !== task.id))
      }, 2000)
    } catch (err: any) {
      setUploadQueue((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? { ...t, status: 'failed' as const, error: err?.message || 'Upload failed' }
            : t
        )
      )
    } finally {
      setUploadQueue((prev) => {
        const othersStillUploading = prev.some((t) => t.id !== task.id && t.status === 'uploading')
        if (!othersStillUploading) setTimeout(() => setUploading(false), 0)
        return prev
      })
    }
  }

  const retryUpload = (taskId: string) => {
    setUploadQueue((prev) => {
      const task = prev.find((t) => t.id === taskId)
      if (!task) return prev
      const updated = prev.map((t) =>
        t.id === taskId ? { ...t, status: 'uploading' as const, progress: 0, error: undefined } : t
      )
      setTimeout(() => runUpload({ ...task, status: 'uploading', progress: 0 }), 0)
      return updated
    })
    setUploadError(null)
  }

  // Determine packet purpose based on job state
  const getPacketPurpose = () => {
    if (job.review_flag) {
      return 'This packet documents a job flagged for review, including risk assessment, mitigations, and accountability trail. Generated for governance and compliance review.'
    }
    if (job.risk_score && job.risk_score > 75) {
      return 'This packet documents a high-risk job, including all risk factors, mitigations, and proof of due diligence. Generated for insurance and legal defensibility.'
    }
    return 'This packet consolidates all job documentation, risk assessment, mitigations, and audit trail into a single exportable artifact. Generated for compliance, insurance, and legal purposes.'
  }

  const getRiskColor = (level: string | null) => {
    switch (level?.toLowerCase()) {
      case 'critical': return 'text-red-400'
      case 'high': return 'text-orange-400'
      case 'medium': return 'text-yellow-400'
      case 'low': return 'text-green-400'
      default: return 'text-white/60'
    }
  }

  const proofPacks = [
    {
      type: 'insurance' as const,
      title: 'Insurance Packet',
      description: 'Completed jobs + audit trail + risk summary',
      icon: Shield,
      contents: [
        'Job summary',
        'Risk score + flags',
        'Mitigations/checklist',
        'Audit timeline',
        'Attachments placeholder',
      ],
    },
    {
      type: 'audit' as const,
      title: 'Audit Packet',
      description: 'Role enforcement + violations + corrective actions',
      icon: FileText,
      contents: [
        'Capability violations',
        'Role assignment record',
        'Access governance trail',
        'Corrective actions',
      ],
    },
    {
      type: 'incident' as const,
      title: 'Incident Packet',
      description: 'Flagged job + escalation trail + accountability timeline',
      icon: Flag,
      contents: [
        'Flagged job details',
        'Escalation trail',
        'Accountability timeline',
        'Mitigation checklist',
      ],
    },
    {
      type: 'compliance' as const,
      title: 'Client Compliance Packet',
      description: 'Proof of sign-offs + checklist completion',
      icon: CheckCircle,
      contents: [
        'Attestations (role-based)',
        'Checklist completion',
        'Evidence photos',
        'Compliance status',
      ],
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`${typography.h2} mb-2`}>Job Packet</h2>
          <p className="text-white/60 text-sm">
            Exportable proof bundles for insurance, audits, incidents, and compliance
          </p>
          <div className="mt-2">
            <button
              onClick={() => router.push(`/operations/audit?job_id=${job.id}`)}
              className="text-xs text-[#F97316] hover:text-[#FB923C] underline flex items-center gap-1"
            >
              View complete governance evidence trail in Compliance Ledger
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
        <button
          onClick={() => window.print()}
          className={`${buttonStyles.secondary} flex items-center gap-2`}
        >
          <Download className="w-4 h-4" />
          Print View
        </button>
      </div>

      {/* Why This Exists - Legal Artifact Context */}
      <div className={`${cardStyles.base} p-4 bg-white/5 border-white/10`}>
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-[#F97316] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-white mb-1">Legal Artifact & Governance Record</p>
            <p className="text-xs text-white/60 leading-relaxed">
              {getPacketPurpose()} All records are timestamped, immutable, and exportable. This packet serves as defensible proof of due diligence, risk management, and compliance accountability.
            </p>
            <p className="text-xs text-white/50 mt-2 italic" suppressHydrationWarning>
              Generated by Riskmate • {new Date().toISOString().split('T')[0]} • All timestamps in UTC
            </p>
          </div>
        </div>
      </div>

      {/* Proof Pack Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {proofPacks.map((pack) => {
          const Icon = pack.icon
          return (
            <motion.button
              key={pack.type}
              onClick={() => {
                setSelectedPack(pack.type)
                onExport?.(pack.type)
              }}
              className={`${cardStyles.base} p-6 text-left hover:border-[#F97316]/30 transition-colors ${
                selectedPack === pack.type ? 'border-[#F97316]' : ''
              }`}
              whileHover={{ y: -2 }}
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 bg-[#F97316]/10 rounded-lg">
                  <Icon className="w-6 h-6 text-[#F97316]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-1">{pack.title}</h3>
                  <p className="text-sm text-white/60">{pack.description}</p>
                </div>
              </div>
              <div className="border-t border-white/5 pt-4">
                <p className="text-xs text-white/50 mb-2 font-medium">Includes:</p>
                <ul className="space-y-1">
                  {pack.contents.map((item, i) => (
                    <li key={i} className="text-sm text-white/70 flex items-center gap-2">
                      <span className="text-[#F97316]">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-4 pt-4 border-t border-white/5">
                <span className="text-xs text-[#F97316] font-medium">
                  {selectedPack === pack.type ? 'Selected' : 'Click to Export'} →
                </span>
              </div>
            </motion.button>
          )
        })}
      </div>

      {/* Job Packet Content (Printable) */}
      <div className={`${cardStyles.base} p-8 print:border-0 print:shadow-none`}>
        {/* Job Summary */}
        <section className="mb-8 pb-8 border-b border-white/5">
          <h3 className={`${typography.h3} mb-4`}>Job Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-white/50 mb-1">Client</p>
              <p className="font-semibold">{job.client_name}</p>
            </div>
            <div>
              <p className="text-sm text-white/50 mb-1">Job Type</p>
              <p className="font-semibold">{job.job_type}</p>
            </div>
            <div>
              <p className="text-sm text-white/50 mb-1">Location</p>
              <p className="font-semibold">{job.location}</p>
              {job.site_name && (
                <p className="text-xs text-white/60 mt-1">Site: {job.site_name}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-white/50 mb-1">Status</p>
              <p className="font-semibold capitalize">{job.status}</p>
            </div>
          </div>
        </section>

        {/* Risk Score + Flags */}
        <section className="mb-8 pb-8 border-b border-white/5">
          <h3 className={`${typography.h3} mb-4`}>Risk Assessment</h3>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-sm text-white/50 mb-1">Risk Score</p>
              <p className={`text-3xl font-bold ${getRiskColor(job.risk_level)}`}>
                {job.risk_score ?? 'N/A'}
              </p>
              <p className="text-sm text-white/60 capitalize">{job.risk_level || 'Not assessed'}</p>
            </div>
            {job.review_flag && (
              <div className="flex items-center gap-2 px-4 py-2 bg-orange-500/20 border border-orange-500/30 rounded-lg">
                <Flag className="w-4 h-4 text-orange-400" />
                <div>
                  <p className="text-sm font-semibold text-orange-400">Flagged for Review</p>
                  {job.flagged_at && (
                    <p className="text-xs text-white/60">
                      Flagged: {new Date(job.flagged_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Controls & Corrective Actions */}
        {mitigations.length > 0 && (
          <section className="mb-8 pb-8 border-b border-white/5">
            <h3 className={`${typography.h3} mb-4`}>Controls & Corrective Actions</h3>
            <div className="space-y-3">
              {mitigations.map((mitigation) => (
                <div
                  key={mitigation.id}
                  className="flex items-start gap-3 p-4 bg-white/5 rounded-lg"
                >
                  <div className={`mt-0.5 ${mitigation.done ? 'text-green-400' : 'text-white/40'}`}>
                    {mitigation.done ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <Clock className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${mitigation.done ? 'line-through text-white/60' : ''}`}>
                      {mitigation.title}
                    </p>
                    {mitigation.description && (
                      <p className="text-sm text-white/60 mt-1">{mitigation.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Chain of Custody */}
        {auditTimeline.length > 0 && (
          <section className="mb-8 pb-8 border-b border-white/5">
            <h3 className={`${typography.h3} mb-4`}>Chain of Custody</h3>
            <div className="space-y-4">
              {auditTimeline.map((event) => (
                <div key={event.id} className="flex items-start gap-4">
                  <div className="w-2 h-2 rounded-full bg-[#F97316] mt-2" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold capitalize">{event.event_type.replace(/_/g, ' ')}</p>
                      {event.user_name && (
                        <span className="text-sm text-white/60 flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {event.user_name}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-white/60">
                      {new Date(event.created_at).toLocaleString()}
                    </p>
                    {event.metadata && Object.keys(event.metadata).length > 0 && (
                      <div className="mt-2 p-2 bg-white/5 rounded text-xs text-white/70">
                        {JSON.stringify(event.metadata, null, 2)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Evidence */}
        <section className="mb-8 pb-8 border-b border-white/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className={`${typography.h3}`}>Evidence</h3>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={`${buttonStyles.secondary} flex items-center gap-2 text-sm`}
            >
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading...' : 'Upload File'}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx"
            className="hidden"
            onChange={async (e) => {
              const files = Array.from(e.target.files || [])
              if (files.length === 0) return

              setUploadError(null)
              const photoFiles = files.filter((f) => f.type.startsWith('image/'))
              const nonPhotoFiles = files.filter((f) => !f.type.startsWith('image/'))

              if (photoFiles.length > 0) {
                setPendingFiles(photoFiles)
                setUploadCategory(getDefaultCategory(job.status))
                setUploadModalOpen(true)
              }

              if (nonPhotoFiles.length > 0) {
                setUploading(true)
                const nonPhotoTasks: UploadTask[] = nonPhotoFiles.map((file) => ({
                  id: `${job.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                  file,
                  status: 'uploading' as const,
                  progress: 0,
                }))
                setUploadQueue((prev) => [...prev, ...nonPhotoTasks])
                nonPhotoTasks.forEach((t) => runUpload(t))
              }

              if (fileInputRef.current) {
                fileInputRef.current.value = ''
              }
            }}
          />

          {/* Photo upload modal: category selector then upload */}
          {uploadModalOpen && pendingFiles.length > 0 && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setUploadModalOpen(false)}>
              <div className={`${cardStyles.base} p-6 max-w-md w-full border border-white/20`} onClick={(e) => e.stopPropagation()}>
                <h4 className={`${typography.h3} mb-2`}>Add Photo Evidence</h4>
                <p className="text-sm text-white/60 mb-4">Choose when this photo was taken relative to the job.</p>
                <div className="flex gap-2 mb-4">
                  {(['before', 'during', 'after'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setUploadCategory(cat)}
                      className={`flex-1 py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors ${
                        uploadCategory === cat
                          ? 'bg-[#2563eb] border-[#2563eb] text-white'
                          : 'bg-white/5 border-white/20 text-white/80 hover:bg-white/10'
                      }`}
                    >
                      {cat === 'before' && '📸 Before'}
                      {cat === 'during' && '🔧 During'}
                      {cat === 'after' && '✅ After'}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-white/50 mb-4">{pendingFiles.length} photo(s) selected</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setUploadModalOpen(false); setPendingFiles([]) }}
                    className={`${buttonStyles.secondary} flex-1`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setUploading(true)
                      const newTasks: UploadTask[] = pendingFiles.map((file) => ({
                        id: `${job.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                        file,
                        status: 'uploading' as const,
                        progress: 0,
                        category: uploadCategory,
                      }))
                      setUploadQueue((prev) => [...prev, ...newTasks])
                      setUploadModalOpen(false)
                      setPendingFiles([])
                      newTasks.forEach((t) => runUpload(t, uploadCategory))
                    }}
                    className={`${buttonStyles.primary} flex-1 flex items-center justify-center gap-2`}
                  >
                    <Upload className="w-4 h-4" />
                    Upload
                  </button>
                </div>
              </div>
            </div>
          )}

          {uploadQueue.length > 0 && (
            <div className="mb-4 space-y-2">
              {uploadQueue.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-white/10 bg-white/5"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/90 truncate">{task.file.name}</p>
                    {task.status === 'uploading' && (
                      <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-[#F97316] animate-pulse"
                          style={{ width: '40%' }}
                        />
                      </div>
                    )}
                    {task.status === 'failed' && task.error && (
                      <p className="text-xs text-red-400 mt-1">{task.error}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {task.status === 'uploading' && (
                      <Loader2 className="w-4 h-4 text-white/60 animate-spin" />
                    )}
                    {task.status === 'success' && (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                    {task.status === 'failed' && (
                      <button
                        type="button"
                        onClick={() => retryUpload(task.id)}
                        className="text-xs font-medium text-[#F97316] hover:text-[#ea580c]"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {uploadError && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-sm text-red-400">
              {uploadError}
            </div>
          )}
          {(() => {
            const photos = attachments.filter((a) => a.type === 'photo')
            const nonPhotoAttachments = attachments.filter((a) => a.type !== 'photo')
            const jobStart = job.start_date ?? null
            const jobEnd = job.end_date ?? null
            const effectiveCat = (p: Attachment) => getEffectivePhotoCategory(p, jobStart, jobEnd)
            const allCount = photos.length
            const beforeCount = photos.filter((p) => effectiveCat(p) === 'before').length
            const duringCount = photos.filter((p) => effectiveCat(p) === 'during').length
            const afterCount = photos.filter((p) => effectiveCat(p) === 'after').length
            const filteredAttachments =
              photoFilter === 'all'
                ? photos
                : photos.filter((p) => effectiveCat(p) === photoFilter)
            const categoryBadgeClass = (cat: PhotoCategory) => {
              if (cat === 'before') return 'bg-[#e3f2fd] text-[#1976d2]'
              if (cat === 'after') return 'bg-[#e8f5e9] text-[#388e3c]'
              return 'bg-[#fff3e0] text-[#f57c00]'
            }
            return (
              <>
                {photos.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span className="text-xs text-white/50 mr-1">Photos:</span>
                    {(['all', 'before', 'during', 'after'] as const).map((tab) => {
                      const count = tab === 'all' ? allCount : tab === 'before' ? beforeCount : tab === 'during' ? duringCount : afterCount
                      return (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setPhotoFilter(tab)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            photoFilter === tab
                              ? 'bg-[#2563eb] text-white'
                              : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)} ({count})
                        </button>
                      )
                    })}
                  </div>
                )}
                {attachments.length === 0 && uploadQueue.length === 0 ? (
                  <div className="p-6 bg-white/5 rounded-lg border border-dashed border-white/10 text-center">
                    <FileText className="w-8 h-8 text-white/40 mx-auto mb-2" />
                    <p className="text-sm text-white/60 mb-2">Upload permit / photo / inspection</p>
                    <p className="text-xs text-white/40">Supports images, PDFs, and documents</p>
                  </div>
                ) : filteredAttachments.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {filteredAttachments.map((attachment) => {
                      const isPhoto = attachment.type === 'photo'
                      const cat = (isPhoto ? effectiveCat(attachment) : null) as PhotoCategory | null
                      return (
                        <div
                          key={attachment.id}
                          className="relative p-3 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
                        >
                          {isPhoto && attachment.url && (
                            <div className="absolute top-2 right-2 z-10">
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setCategoryDropdownOpen(categoryDropdownOpen === attachment.id ? null : attachment.id)}
                                  className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${categoryBadgeClass(cat!)} hover:opacity-90`}
                                >
                                  {cat!.toUpperCase()}
                                </button>
                                {categoryDropdownOpen === attachment.id && onAttachmentCategoryChange && (
                                  <>
                                    <div className="absolute top-full right-0 mt-1 py-1 min-w-[100px] rounded-lg bg-[#1a1a1a] border border-white/20 shadow-xl z-20">
                                      {(['before', 'during', 'after'] as const).map((newCat) => (
                                        <button
                                          key={newCat}
                                          type="button"
                                          onClick={async () => {
                                            await onAttachmentCategoryChange(attachment.id, newCat)
                                            setCategoryDropdownOpen(null)
                                          }}
                                          className="block w-full text-left px-3 py-1.5 text-sm text-white/90 hover:bg-white/10"
                                        >
                                          {newCat.charAt(0).toUpperCase() + newCat.slice(1)}
                                        </button>
                                      ))}
                                    </div>
                                    <div
                                      className="fixed inset-0 z-10"
                                      aria-hidden
                                      onClick={() => setCategoryDropdownOpen(null)}
                                    />
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-2 mb-2">
                            {isPhoto ? (
                              <ImageIcon className="w-4 h-4 text-white/60" />
                            ) : (
                              <FileText className="w-4 h-4 text-white/60" />
                            )}
                            <span className="text-xs text-white/50 capitalize">{attachment.type}</span>
                          </div>
                          {isPhoto && attachment.url && (
                            <div className="w-full h-24 rounded bg-white/5 mb-2 overflow-hidden">
                              <img src={attachment.url} alt="" className="w-full h-full object-cover" />
                            </div>
                          )}
                          <p className="text-sm text-white/80 truncate mb-1" title={attachment.name}>
                            {attachment.name}
                          </p>
                          <p className="text-xs text-white/40">
                            {new Date(attachment.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="p-6 bg-white/5 rounded-lg border border-dashed border-white/10 text-center">
                    <p className="text-sm text-white/60">No photos in this category</p>
                  </div>
                )}
                {nonPhotoAttachments.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-white/5">
                    <h4 className="text-sm font-medium text-white/80 mb-3">Documents</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {nonPhotoAttachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="relative p-3 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="w-4 h-4 text-white/60" />
                            <span className="text-xs text-white/50 capitalize">{attachment.type}</span>
                          </div>
                          <p className="text-sm text-white/80 truncate mb-1" title={attachment.name}>
                            {attachment.name}
                          </p>
                          <p className="text-xs text-white/40">
                            {new Date(attachment.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )
          })()}
        </section>

        {/* Attestations (Role-based) - Sealed Records */}
        <section>
          <h3 className={`${typography.h3} mb-4`}>Sealed Records</h3>
          <p className="text-xs text-white/50 mb-4">
            Role-based attestations that seal this job record. Each seal creates an immutable ledger event.
          </p>
          {signoffs.length > 0 ? (
            <div className="space-y-4">
              {signoffs.map((signoff) => {
                // Determine event type based on signoff status and type
                const eventType = signoff.status === 'signed' 
                  ? 'attestation.sealed'
                  : signoff.status === 'rejected'
                  ? 'attestation.rejected'
                  : 'attestation.pending'
                
                // Determine integrity status (following "Trust UI must never lie")
                const integrityStatus: 'verified' | 'unverified' | 'mismatch' | 'pending' = 
                  signoff.status === 'signed' ? 'unverified' : 'pending' // Default to unverified until verification is implemented
                
                // Summary text
                const summary = signoff.status === 'signed'
                  ? `Record sealed for ${job.client_name}`
                  : signoff.status === 'rejected'
                  ? `Attestation rejected: ${signoff.signoff_type}`
                  : `Pending attestation: ${signoff.signoff_type}`
                
                return (
                  <div key={signoff.id} className="space-y-3 p-4 bg-white/5 rounded-lg border border-white/10 min-w-0">
                    {/* TrustReceiptStrip: Who/When/What/Why */}
                    <div className="min-w-0">
                      <TrustReceiptStrip
                        actorName={signoff.signer_name || 'Unknown'}
                        actorRole={signoff.signer_role || 'Member'}
                        occurredAt={signoff.signed_at || new Date().toISOString()}
                        eventType={eventType}
                        category="operations"
                        summary={summary}
                        reason={signoff.comments || signoff.signoff_type || 'Standard attestation'}
                        policyStatement={signoff.status === 'rejected' ? `Rejected attestation: ${signoff.comments || 'No reason provided'}` : undefined}
                      />
                    </div>
                    
                    {/* IntegrityBadge */}
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <div className="flex-shrink-0">
                        <IntegrityBadge
                          status={integrityStatus}
                          showDetails
                        />
                      </div>
                      {signoff.status === 'signed' && (
                        <span className="text-xs text-emerald-400 flex-shrink-0">• Record Sealed</span>
                      )}
                      {signoff.status === 'rejected' && (
                        <span className="text-xs text-red-400 flex-shrink-0">• Rejected</span>
                      )}
                      {signoff.status === 'pending' && (
                        <span className="text-xs text-yellow-400 flex-shrink-0">• Pending Seal</span>
                      )}
                    </div>
                    
                    {/* EnforcementBanner for rejected attestations */}
                    {signoff.status === 'rejected' && signoff.comments && (
                      <EnforcementBanner
                        action={`Attempted to seal record: ${signoff.signoff_type}`}
                        blocked={true}
                        eventId={signoff.id}
                        policyStatement={signoff.comments || 'Attestation was rejected'}
                        actorRole={signoff.signer_role}
                        severity="material"
                      />
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState
              title="No sealed records"
              description="No attestations have sealed this record yet."
              hint="Seals create immutable attestations in the compliance ledger."
            />
          )}
        </section>
      </div>
    </div>
  )
}

