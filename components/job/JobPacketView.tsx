'use client'

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Download, FileText, Shield, CheckCircle, Clock, User, Flag, Upload, X, Image as ImageIcon } from 'lucide-react'
import { cardStyles, buttonStyles, typography } from '@/lib/styles/design-system'
import { jobsApi } from '@/lib/api'

interface Attachment {
  id: string
  name: string
  type: 'photo' | 'document' | 'permit' | 'inspection'
  url?: string
  file_path?: string
  created_at: string
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
}

export function JobPacketView({ 
  job, 
  mitigations = [], 
  auditTimeline = [], 
  attachments = [],
  signoffs = [],
  onExport,
  onAttachmentUploaded 
}: JobPacketViewProps) {
  const [selectedPack, setSelectedPack] = useState<'insurance' | 'audit' | 'incident' | 'compliance' | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
        'Role assignment history',
        'Access change log',
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
        'Sign-offs (role-based)',
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
        </div>
        <button
          onClick={() => window.print()}
          className={`${buttonStyles.secondary} flex items-center gap-2`}
        >
          <Download className="w-4 h-4" />
          Print View
        </button>
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
              className={`${cardStyles.default} p-6 text-left hover:border-[#F97316]/30 transition-colors ${
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
      <div className={`${cardStyles.default} p-8 print:border-0 print:shadow-none`}>
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

        {/* Mitigations/Checklist */}
        {mitigations.length > 0 && (
          <section className="mb-8 pb-8 border-b border-white/5">
            <h3 className={`${typography.h3} mb-4`}>Mitigations & Checklist</h3>
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

        {/* Audit Timeline */}
        {auditTimeline.length > 0 && (
          <section className="mb-8 pb-8 border-b border-white/5">
            <h3 className={`${typography.h3} mb-4`}>Audit Timeline</h3>
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

        {/* Attachments */}
        <section className="mb-8 pb-8 border-b border-white/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className={`${typography.h3}`}>Attachments</h3>
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

              setUploading(true)
              setUploadError(null)

              try {
                for (const file of files) {
                  const fileType = file.type.startsWith('image/') ? 'photo' : 
                                  file.name.includes('permit') ? 'permit' :
                                  file.name.includes('inspection') ? 'inspection' : 'document'
                  
                  await jobsApi.uploadDocument(job.id, file, {
                    name: file.name,
                    type: fileType,
                    description: `Uploaded for ${selectedPack || 'job'} packet`,
                  })
                }
                onAttachmentUploaded?.()
                if (fileInputRef.current) {
                  fileInputRef.current.value = ''
                }
              } catch (err: any) {
                setUploadError(err.message || 'Upload failed')
              } finally {
                setUploading(false)
              }
            }}
          />
          {uploadError && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-sm text-red-400">
              {uploadError}
            </div>
          )}
          {attachments.length === 0 ? (
            <div className="p-6 bg-white/5 rounded-lg border border-dashed border-white/10 text-center">
              <FileText className="w-8 h-8 text-white/40 mx-auto mb-2" />
              <p className="text-sm text-white/60 mb-2">Upload permit / photo / inspection</p>
              <p className="text-xs text-white/40">Supports images, PDFs, and documents</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="p-3 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    {attachment.type === 'photo' ? (
                      <ImageIcon className="w-4 h-4 text-white/60" />
                    ) : (
                      <FileText className="w-4 h-4 text-white/60" />
                    )}
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
          )}
        </section>

        {/* Sign-offs (Role-based) */}
        <section>
          <h3 className={`${typography.h3} mb-4`}>Sign-offs</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-white/5 rounded-lg">
              <p className="text-sm text-white/50 mb-2">Safety Lead</p>
              <p className="text-sm text-white/40 italic">Pending signature</p>
            </div>
            <div className="p-4 bg-white/5 rounded-lg">
              <p className="text-sm text-white/50 mb-2">Owner</p>
              <p className="text-sm text-white/40 italic">Pending signature</p>
            </div>
          </div>
          <p className="text-xs text-white/40 mt-4 italic">
            Role-based sign-offs coming in v2
          </p>
        </section>
      </div>
    </div>
  )
}

