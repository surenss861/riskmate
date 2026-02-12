'use client'

import { useState, useEffect } from 'react'
import { SignatureCapture, SignatureData } from './SignatureCapture'
import { SignatureDetailsModal } from './SignatureDetailsModal'
import { Button } from '@/components/shared'
import { Badge } from '@/lib/design-system/components/Badge'
import { formatPdfTimestamp } from '@/lib/utils/pdfFormatUtils'
import { sanitizeSvg } from '@/lib/utils/sanitizeSvg'
import { Copy, Check, Eye } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Toast } from '@/components/dashboard/Toast'

interface Signature {
  id: string
  signer_name: string
  signer_title: string
  signature_role: 'prepared_by' | 'reviewed_by' | 'approved_by' | 'other'
  signature_svg: string
  signed_at: string
  signer_user_id?: string | null
  ip_address?: string | null
  user_agent?: string | null
}

interface ReportRun {
  id: string
  created_at?: string
  generated_at?: string
  data_hash: string
  status: string
  generated_by: string
  pdf_generated_at?: string | null
}

interface TeamSignaturesProps {
  jobId: string
  reportRunId?: string | null
  readOnly?: boolean
  onReportRunCreated?: (runId: string) => void
  onExport?: () => void
  /** Called when signature list loads or changes (e.g. after signing). Use for tab badge: (signed, total). */
  onSignaturesChange?: (signed: number, total: number) => void
}

const REQUIRED_ROLES: Array<'prepared_by' | 'reviewed_by' | 'approved_by'> = [
  'prepared_by',
  'reviewed_by',
  'approved_by',
]

const ROLE_LABELS: Record<string, string> = {
  prepared_by: 'Prepared By',
  reviewed_by: 'Reviewed By',
  approved_by: 'Approved By',
  other: 'Signature',
}

export function TeamSignatures({ 
  jobId, 
  reportRunId: initialReportRunId, 
  readOnly = false,
  onReportRunCreated,
  onExport,
  onSignaturesChange,
}: TeamSignaturesProps) {
  const [signatures, setSignatures] = useState<Signature[]>([])
  const [reportRun, setReportRun] = useState<ReportRun | null>(null)
  const [reportRunId, setReportRunId] = useState<string | null>(initialReportRunId || null)
  const [loading, setLoading] = useState(true)
  const [captureOpen, setCaptureOpen] = useState<{
    role: 'prepared_by' | 'reviewed_by' | 'approved_by' | 'other'
  } | null>(null)
  const [detailsOpen, setDetailsOpen] = useState<Signature | null>(null)
  const [creatingReportRun, setCreatingReportRun] = useState(false)
  const [copiedHash, setCopiedHash] = useState(false)
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'member' | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Load current user info
  useEffect(() => {
    const loadUserInfo = async () => {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()
        if (userData?.role) {
          setUserRole(userData.role as 'owner' | 'admin' | 'member')
        }
      }
    }
    loadUserInfo()
  }, [])

  // Load report run and signatures
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        // If we have a reportRunId, load the run and signatures
        if (reportRunId) {
          // Load report run details
          const runResponse = await fetch(`/api/reports/runs/${reportRunId}`)
          if (runResponse.ok) {
            const { data: runData } = await runResponse.json()
            setReportRun(runData)
          }

          // Load signatures
          const sigResponse = await fetch(`/api/reports/runs/${reportRunId}/signatures`)
          if (sigResponse.ok) {
            const { data: sigData } = await sigResponse.json()
            setSignatures(sigData || [])
          }
        } else {
          // Try to find the latest non-superseded report run for this job with packet_type=insurance
          const latestRunResponse = await fetch(`/api/reports/runs?job_id=${jobId}&packet_type=insurance&limit=10`)
          if (latestRunResponse.ok) {
            const { data: runs } = await latestRunResponse.json()
            if (runs && runs.length > 0) {
              // Prefer non-superseded runs, fallback to latest
              const activeRun = runs.find((r: ReportRun) => r.status !== 'superseded') || runs[0]
              setReportRun(activeRun)
              setReportRunId(activeRun.id)
              if (onReportRunCreated) {
                onReportRunCreated(activeRun.id)
              }

              // Load signatures for this run
              const sigResponse = await fetch(`/api/reports/runs/${activeRun.id}/signatures`)
              if (sigResponse.ok) {
                const { data: sigData } = await sigResponse.json()
                setSignatures(sigData || [])
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to load report run or signatures:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [jobId, reportRunId])

  // Notify parent of signature count for tab badge (updates when signatures load or change)
  useEffect(() => {
    if (!loading && onSignaturesChange) {
      const signed = signatures.filter((s) => 
        REQUIRED_ROLES.includes(s.signature_role as 'prepared_by' | 'reviewed_by' | 'approved_by')
      ).length
      onSignaturesChange(signed, REQUIRED_ROLES.length)
    }
  }, [loading, signatures, onSignaturesChange])

  const handleCreateReportRun = async () => {
    if (creatingReportRun) return

    setCreatingReportRun(true)
    try {
      // Use runs/active with force_new=true so a new run is created (and prior active run superseded) instead of returning existing
      const response = await fetch(`/api/reports/runs/active?job_id=${jobId}&packet_type=insurance&force_new=true`, {
        method: 'GET',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to get or create report run')
      }

      const { data } = await response.json()
      const runData = data?.id ? data : null
      const newRunId = runData?.id

      if (newRunId) {
        setReportRunId(newRunId)
        if (onReportRunCreated) {
          onReportRunCreated(newRunId)
        }
        setReportRun(runData)
      }
    } catch (error: any) {
      setToast({ message: error.message || 'Failed to create report run', type: 'error' })
      console.error('Failed to create report run:', error)
    } finally {
      setCreatingReportRun(false)
    }
  }

  const handleCopyHash = async () => {
    if (!reportRun?.data_hash) return
    try {
      await navigator.clipboard.writeText(reportRun.data_hash)
      setCopiedHash(true)
      setTimeout(() => setCopiedHash(false), 2000)
    } catch (err) {
      console.error('Failed to copy hash:', err)
    }
  }

  // Check if user can sign for a specific role
  const canSignForRole = (role: 'prepared_by' | 'reviewed_by' | 'approved_by'): { canSign: boolean; reason?: string } => {
    if (readOnly) return { canSign: false, reason: 'Read-only mode' }
    if (!currentUserId) return { canSign: false, reason: 'Not authenticated' }
    if (!reportRun) return { canSign: false, reason: 'No report run' }
    if (reportRun.status === 'superseded') return { canSign: false, reason: 'Run superseded' }
    if (reportRun.status === 'complete') return { canSign: false, reason: 'Run complete' }

    // Check if already signed
    const existing = signatures.find(s => s.signature_role === role)
    if (existing) return { canSign: false, reason: 'Already signed' }

    // Role-based permissions
    if (role === 'prepared_by') {
      // Prepared By: creator or owner/admin
      if (reportRun.generated_by === currentUserId) return { canSign: true }
      if (userRole === 'owner' || userRole === 'admin') return { canSign: true }
      return { canSign: false, reason: 'Only the report creator or admins can sign as Prepared By' }
    }

    if (role === 'reviewed_by') {
      // Reviewed By: must be different from Prepared By signer
      const preparedBy = signatures.find(s => s.signature_role === 'prepared_by')
      if (preparedBy?.signer_user_id === currentUserId) {
        return { canSign: false, reason: 'Cannot review a report you prepared' }
      }
      // Any authenticated user can review
      return { canSign: true }
    }

    if (role === 'approved_by') {
      // Approved By: admin/owner only
      if (userRole === 'owner' || userRole === 'admin') return { canSign: true }
      return { canSign: false, reason: 'Only admins and owners can approve' }
    }

    return { canSign: false, reason: 'Unknown role' }
  }

  // Auto-create run and open sign modal (idempotent). Ensure run is ready_for_signatures before signing.
  const handleSignNowClick = async (role: 'prepared_by' | 'reviewed_by' | 'approved_by') => {
    const permission = canSignForRole(role)
    if (!permission.canSign) {
      setToast({ message: permission.reason || 'Cannot sign for this role', type: 'error' })
      return
    }

    // If no run exists, get or create one (idempotent) via runs/active (always ready_for_signatures)
    if (!reportRunId) {
      setCreatingReportRun(true)
      try {
        const response = await fetch(`/api/reports/runs/active?job_id=${jobId}&packet_type=insurance`, {
          method: 'GET',
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.message || 'Failed to get or create report run')
        }

        const { data: runData } = await response.json()

        if (runData?.id) {
          setReportRunId(runData.id)
          setReportRun(runData)
          if (onReportRunCreated) {
            onReportRunCreated(runData.id)
          }
          setCaptureOpen({ role })
        }
      } catch (error: any) {
        setToast({ message: error.message || 'Failed to get or create report run', type: 'error' })
      } finally {
        setCreatingReportRun(false)
      }
      return
    }

    // Run exists: ensure it is ready_for_signatures before opening the signature modal
    if (reportRun?.status === 'draft') {
      setCreatingReportRun(true)
      try {
        const patchRes = await fetch(`/api/reports/runs/${reportRunId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'ready_for_signatures' }),
        })
        if (!patchRes.ok) {
          const err = await patchRes.json()
          throw new Error(err.message || 'Failed to prepare run for signing')
        }
        const { data: updatedRun } = await patchRes.json()
        setReportRun(updatedRun)
        setCaptureOpen({ role })
      } catch (error: any) {
        setToast({ message: error.message || 'Failed to prepare run for signing', type: 'error' })
      } finally {
        setCreatingReportRun(false)
      }
    } else {
      setCaptureOpen({ role })
    }
  }

  const handleSaveSignature = async (data: SignatureData) => {
    if (!reportRunId || !captureOpen) return

    try {
      const formData = {
        signature_role: captureOpen.role,
        signature_svg: data.signatureSvg,
        signer_name: data.signerName,
        signer_title: data.signerTitle,
        attestationAccepted: true,
      }

      const response = await fetch(`/api/reports/runs/${reportRunId}/signatures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        
        // Handle 409 (already signed)
        if (response.status === 409) {
          setToast({ 
            message: error.message || 'Already signed. Refreshing...', 
            type: 'error' 
          })
          // Reload signatures
          const sigResponse = await fetch(`/api/reports/runs/${reportRunId}/signatures`)
          if (sigResponse.ok) {
            const { data: sigData } = await sigResponse.json()
            setSignatures(sigData || [])
          }
          return
        }
        
        throw new Error(error.message || 'Failed to save signature')
      }

      const { data: signatureData } = await response.json()
      const updatedSignatures = [...signatures, signatureData]
      setSignatures(updatedSignatures)
      setCaptureOpen(null)
      setToast({ message: 'Signature saved successfully', type: 'success' })
      
      // Auto-finalize when all signatures complete
      const allComplete = REQUIRED_ROLES.every((r) => {
        return updatedSignatures.find(s => s.signature_role === r)
      })
      
      if (allComplete && reportRun && reportRun.status !== 'complete' && reportRun.status !== 'final') {
        try {
          const finalizeResponse = await fetch(`/api/reports/runs/${reportRunId}/finalize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
          
          if (!finalizeResponse.ok) {
            const error = await finalizeResponse.json()
            throw new Error(error.message || 'Failed to finalize report run')
          }
          
          // Reload run to get updated status
          const runResponse = await fetch(`/api/reports/runs/${reportRunId}`)
          if (runResponse.ok) {
            const { data: runData } = await runResponse.json()
            setReportRun(runData)
            setToast({ message: 'All signatures complete. Run sealed.', type: 'success' })
          }
        } catch (err: any) {
          setToast({ message: err.message || 'Failed to finalize report run', type: 'error' })
          console.error('Failed to finalize run:', err)
        }
      }
    } catch (error: any) {
      setToast({ message: error.message || 'Failed to save signature', type: 'error' })
      console.error('Failed to save signature:', error)
    }
  }

  const getSignatureForRole = (role: string) => {
    return signatures.find((s) => s.signature_role === role)
  }

  const allRequiredSignaturesComplete = REQUIRED_ROLES.every((role) => {
    return !!getSignatureForRole(role)
  })

  const signedCount = signatures.filter(s => REQUIRED_ROLES.includes(s.signature_role as any)).length
  const missingRoles = REQUIRED_ROLES.filter(r => !getSignatureForRole(r))

  const runCreatedAt = reportRun?.generated_at || reportRun?.created_at
  const shortHash = reportRun?.data_hash 
    ? `${reportRun.data_hash.substring(0, 8)}…${reportRun.data_hash.substring(reportRun.data_hash.length - 6)}`
    : null

  if (loading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <div className="text-white/60">Loading signatures...</div>
      </div>
    )
  }

  return (
    <>
      {toast && (
        <Toast
          isOpen={true}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      
      <div className="space-y-4">
        {/* Header with primary action */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold text-white">✍️ Team Signatures</h2>
            {!readOnly && allRequiredSignaturesComplete && (reportRun?.status === 'complete' || reportRun?.status === 'final') && (
              <Badge variant="success">Complete • Sealed</Badge>
            )}
            {!readOnly && allRequiredSignaturesComplete && reportRun?.status !== 'complete' && reportRun?.status !== 'final' && (
              <Badge variant="success">Complete</Badge>
            )}
            {!readOnly && !allRequiredSignaturesComplete && reportRunId && (
              <Badge variant="warning">{signedCount}/{REQUIRED_ROLES.length} signed</Badge>
            )}
            {reportRun?.status === 'superseded' && (
              <Badge variant="warning">Superseded</Badge>
            )}
          </div>
          {!readOnly && (
            <div className="flex items-center gap-3 flex-wrap">
              {allRequiredSignaturesComplete && reportRunId && (
                <Button
                  variant="primary"
                  onClick={onExport || (() => {
                    window.location.href = `/api/reports/runs/${reportRunId}/download`
                  })}
                >
                  {reportRun?.status === 'complete' || reportRun?.status === 'final' 
                    ? 'Export Final Pack' 
                    : 'Generate PDF Pack'}
                </Button>
              )}
              {!reportRunId && (
                <Button
                  variant="secondary"
                  onClick={handleCreateReportRun}
                  disabled={creatingReportRun}
                >
                  {creatingReportRun ? 'Creating...' : 'Generate Report Run'}
                </Button>
              )}
              {reportRunId && (reportRun?.status !== 'superseded' && reportRun?.status !== 'complete' && reportRun?.status !== 'final') && (
                <Button
                  variant="secondary"
                  onClick={handleCreateReportRun}
                  disabled={creatingReportRun}
                >
                  {creatingReportRun ? 'Creating...' : 'Create New Run'}
                </Button>
              )}
              {(reportRun?.status === 'complete' || reportRun?.status === 'final') && (
                <Button
                  variant="secondary"
                  onClick={handleCreateReportRun}
                  disabled={creatingReportRun}
                >
                  {creatingReportRun ? 'Creating...' : 'Create New Run'}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Run status banner */}
        {reportRunId && reportRun && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-sm">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4 flex-wrap text-blue-400">
                {runCreatedAt && (
                  <>
                    <span>
                      Run created {formatPdfTimestamp(runCreatedAt)}
                    </span>
                    <span>•</span>
                  </>
                )}
                {shortHash && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs" title="Integrity SHA-256 for this run">
                        Hash: {shortHash}
                      </span>
                      <button
                        onClick={handleCopyHash}
                        className="text-blue-400/80 hover:text-blue-400 transition-colors"
                        title="Copy full hash"
                      >
                        {copiedHash ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <span>•</span>
                  </>
                )}
                <span>
                  {signedCount}/{REQUIRED_ROLES.length} signed
                </span>
                {reportRun.pdf_generated_at && (
                  <>
                    <span>•</span>
                    <span>
                      Exported {formatPdfTimestamp(reportRun.pdf_generated_at)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {!reportRunId && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-blue-400 text-sm">
            <p className="mb-2">No report run yet — signing will create one automatically.</p>
            <p className="text-blue-400/70 text-xs">This will freeze a snapshot of the current report data for signing.</p>
          </div>
        )}

        {reportRun?.status === 'superseded' && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 text-orange-400 text-sm">
            This report run has been superseded by a newer run. Create a new report run to capture signatures.
          </div>
        )}

        {/* Signature cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {REQUIRED_ROLES.map((role) => {
            const signature = getSignatureForRole(role)
            const isSigned = !!signature
            const permission = canSignForRole(role)

            return (
              <div
                key={role}
                className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white">{ROLE_LABELS[role]}</h3>
                  {isSigned ? (
                    <Badge variant="success">Signed</Badge>
                  ) : (
                    <Badge variant="warning">Pending</Badge>
                  )}
                </div>

                {isSigned && signature ? (
                  <div className="space-y-2">
                    <div className="h-28 rounded-lg bg-white/95 overflow-hidden p-3 border border-white/20">
                      <div
                        className="w-full h-full text-black [&_svg]:w-full [&_svg]:h-full [&_svg]:block [&_svg]:max-w-full [&_svg]:max-h-full [&_path]:stroke-current [&_path]:fill-none [&_path]:stroke-2"
                        dangerouslySetInnerHTML={{ __html: sanitizeSvg(signature.signature_svg) }}
                      />
                    </div>
                    <div className="text-sm text-white/90 font-medium">{signature.signer_name}</div>
                    <div className="text-xs text-white/60">{signature.signer_title}</div>
                    <div className="text-xs text-white/40">
                      Signed {formatPdfTimestamp(signature.signed_at)}
                    </div>
                    {!readOnly && reportRun && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setDetailsOpen(signature)}
                        className="w-full mt-2"
                      >
                        <Eye className="w-4 h-4 mr-1.5" />
                        View Details
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="border-2 border-dashed border-white/20 rounded p-4 bg-white/5 text-center text-white/40 text-sm min-h-[100px] flex items-center justify-center">
                      {permission.canSign ? (
                        <span>Unassigned</span>
                      ) : permission.reason ? (
                        <span className="text-xs">{permission.reason}</span>
                      ) : (
                        <span>Generate report run to enable signing</span>
                      )}
                    </div>
                    {!readOnly && permission.canSign && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleSignNowClick(role)}
                        className="w-full"
                        disabled={creatingReportRun}
                      >
                        Sign Now
                      </Button>
                    )}
                    {!readOnly && !permission.canSign && reportRunId && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setToast({ 
                            message: permission.reason || 'Cannot sign for this role', 
                            type: 'error' 
                          })
                        }}
                        className="w-full"
                        disabled
                      >
                        {permission.reason?.includes('admin') ? 'Request Approval' : 'Not Eligible'}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Export info */}
        {reportRunId && !allRequiredSignaturesComplete && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white/60">
            <div className="flex items-center justify-between">
              <span>
                Export available as <span className="text-white/80 font-medium">Draft</span> ({signedCount}/{REQUIRED_ROLES.length} signed)
                {missingRoles.length > 0 && (
                  <span className="text-xs text-white/50 block mt-1">
                    Missing: {missingRoles.map(r => ROLE_LABELS[r]).join(', ')}
                  </span>
                )}
              </span>
              {onExport && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onExport}
                >
                  Export Draft
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {captureOpen && reportRun && (
        <SignatureCapture
          role={captureOpen.role}
          onSave={handleSaveSignature}
          onCancel={() => setCaptureOpen(null)}
          reportRunId={reportRun.id}
          reportRunHash={reportRun.data_hash}
          reportRunCreatedAt={runCreatedAt || undefined}
        />
      )}

      {detailsOpen && reportRun && (
        <SignatureDetailsModal
          signature={detailsOpen}
          reportRun={reportRun}
          onClose={() => setDetailsOpen(null)}
        />
      )}
    </>
  )
}
