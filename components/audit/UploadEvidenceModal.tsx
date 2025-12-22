'use client'

import { useState } from 'react'
import { X, Upload, FileText, AlertCircle } from 'lucide-react'
import { buttonStyles } from '@/lib/styles/design-system'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { recordAuditLog } from '@/lib/audit/auditLogger'

interface UploadEvidenceModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
  workRecordId: string
  workRecordName?: string
}

export function UploadEvidenceModal({
  isOpen,
  onClose,
  onComplete,
  workRecordId,
  workRecordName,
}: UploadEvidenceModalProps) {
  const [evidenceType, setEvidenceType] = useState<string>('document')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleSubmit = async () => {
    if (!file && !notes.trim()) {
      setError('Please upload a file or provide notes describing the evidence')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = createSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      // Get organization context
      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', session.user.id)
        .single()

      if (!userData) {
        throw new Error('User not found')
      }

      // If file is provided, upload it
      let documentId: string | null = null
      if (file) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${workRecordId}/${Date.now()}.${fileExt}`
        const filePath = `evidence/${fileName}`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file)

        if (uploadError) {
          throw new Error(`Upload failed: ${uploadError.message}`)
        }

        // Create document record
        const { data: docData, error: docError } = await supabase
          .from('job_documents')
          .insert({
            job_id: workRecordId,
            document_type: evidenceType,
            file_path: filePath,
            file_name: file.name,
            notes: notes.trim() || null,
            uploaded_by: session.user.id,
          })
          .select('id')
          .single()

        if (docError) {
          throw new Error(`Failed to create document record: ${docError.message}`)
        }

        documentId = docData.id
      } else {
        // Create document record without file (notes-only evidence)
        const { data: docData, error: docError } = await supabase
          .from('job_documents')
          .insert({
            job_id: workRecordId,
            document_type: evidenceType,
            notes: notes.trim(),
            uploaded_by: session.user.id,
          })
          .select('id')
          .single()

        if (docError) {
          throw new Error(`Failed to create document record: ${docError.message}`)
        }

        documentId = docData.id
      }

      // Write ledger entry
      await recordAuditLog(supabase, {
        organizationId: userData.organization_id,
        actorId: session.user.id,
        eventName: 'evidence.attached',
        targetType: 'job',
        targetId: workRecordId,
        metadata: {
          work_record_id: workRecordId,
          work_record_name: workRecordName,
          document_id: documentId,
          evidence_type: evidenceType,
          notes: notes.trim() || null,
          attached_at: new Date().toISOString(),
          summary: `Evidence attached to ${workRecordName || 'work record'}: ${evidenceType}`,
        },
      })

      onComplete()
      onClose()
      
      // Reset form
      setFile(null)
      setNotes('')
      setEvidenceType('document')
    } catch (err: any) {
      console.error('Failed to upload evidence:', err)
      setError(err.message || 'Failed to upload evidence. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1A1A1A] border border-white/10 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Upload className="w-5 h-5 text-[#F97316]" />
            <h2 className="text-xl font-semibold text-white">Upload Evidence</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {workRecordName && (
            <div className="bg-white/5 rounded-lg p-4">
              <p className="text-sm text-white/60 mb-1">Work Record</p>
              <p className="text-white font-medium">{workRecordName}</p>
            </div>
          )}

          {/* Evidence Type */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Evidence Type <span className="text-red-400">*</span>
            </label>
            <select
              value={evidenceType}
              onChange={(e) => setEvidenceType(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#F97316]"
            >
              <option value="document">Document</option>
              <option value="photo">Photo</option>
              <option value="certificate">Certificate</option>
              <option value="inspection">Inspection Report</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              File (Optional)
            </label>
            <div className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center hover:border-[#F97316]/50 transition-colors">
              <input
                type="file"
                onChange={handleFileChange}
                className="hidden"
                id="evidence-file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
              />
              <label
                htmlFor="evidence-file"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload className="w-8 h-8 text-white/40" />
                <span className="text-sm text-white/60">
                  {file ? file.name : 'Click to upload or drag and drop'}
                </span>
                <span className="text-xs text-white/40">
                  PDF, DOC, DOCX, JPG, PNG (max 10MB)
                </span>
              </label>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Notes <span className="text-red-400">*</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe the evidence or provide context..."
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:border-[#F97316] resize-none"
              required
            />
            {!file && !notes.trim() && (
              <p className="text-xs text-white/50 mt-1">
                Notes are required when no file is uploaded
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-400 font-medium">Error</p>
                <p className="text-sm text-red-300 mt-1">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-white/60 hover:text-white transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || (!file && !notes.trim())}
            className={buttonStyles.primary + (loading ? ' opacity-50 cursor-not-allowed' : '')}
          >
            {loading ? 'Uploading...' : 'Upload Evidence'}
          </button>
        </div>
      </div>
    </div>
  )
}

