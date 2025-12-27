'use client'

import { useState, useEffect } from 'react'
import { SignatureCapture, SignatureData } from './SignatureCapture'
import { Button } from '@/lib/design-system/components/Button'
import { Badge } from '@/lib/design-system/components/Badge'

interface Signature {
  id: string
  signer_name: string
  signer_title: string
  signature_role: 'prepared_by' | 'reviewed_by' | 'approved_by' | 'other'
  signature_svg: string
  signed_at: string
  signer_user_id?: string | null
}

interface TeamSignaturesProps {
  jobId: string
  reportRunId?: string | null
  readOnly?: boolean
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

export function TeamSignatures({ jobId, reportRunId, readOnly = false }: TeamSignaturesProps) {
  const [signatures, setSignatures] = useState<Signature[]>([])
  const [loading, setLoading] = useState(true)
  const [captureOpen, setCaptureOpen] = useState<{
    role: 'prepared_by' | 'reviewed_by' | 'approved_by' | 'other'
  } | null>(null)
  const [creatingReportRun, setCreatingReportRun] = useState(false)

  // Load signatures if reportRunId exists
  useEffect(() => {
    if (!reportRunId) {
      setLoading(false)
      return
    }

    const loadSignatures = async () => {
      try {
        const response = await fetch(`/api/reports/runs/${reportRunId}/signatures`)
        if (response.ok) {
          const { data } = await response.json()
          setSignatures(data || [])
        }
      } catch (error) {
        console.error('Failed to load signatures:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSignatures()
  }, [reportRunId])

  const handleOpenCapture = (role: 'prepared_by' | 'reviewed_by' | 'approved_by') => {
    if (readOnly) return
    if (!reportRunId) {
      alert('Please create a report run first by clicking "Generate Report"')
      return
    }
    setCaptureOpen({ role })
  }

  const handleSaveSignature = async (data: { signatureSvg: string; signerName: string; signerTitle: string }) => {
    if (!reportRunId || !captureOpen) return

    try {
      const formData = {
        signature_role: captureOpen.role,
        signature_svg: data.signatureSvg,
        signer_name: data.signerName,
        signer_title: data.signerTitle,
      }

      const response = await fetch(`/api/reports/runs/${reportRunId}/signatures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to save signature')
      }

      const { data: signatureData } = await response.json()
      setSignatures([...signatures, signatureData])
      setCaptureOpen(null)
    } catch (error: any) {
      alert(error.message || 'Failed to save signature')
      console.error('Failed to save signature:', error)
    }
  }

  const getSignatureForRole = (role: string) => {
    return signatures.find((s) => s.signature_role === role)
  }

  const allRequiredSignaturesComplete = REQUIRED_ROLES.every((role) => {
    return !!getSignatureForRole(role)
  })

  if (loading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <div className="text-white/60">Loading signatures...</div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">✍️ Team Signatures</h2>
          {!readOnly && allRequiredSignaturesComplete && (
            <Badge variant="success">All signatures complete</Badge>
          )}
          {!readOnly && !allRequiredSignaturesComplete && (
            <Badge variant="warning">Pending signatures</Badge>
          )}
        </div>

        {!reportRunId && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-yellow-400 text-sm">
            Create a report run to capture signatures. Click &quot;Generate Report&quot; first.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {REQUIRED_ROLES.map((role) => {
            const signature = getSignatureForRole(role)
            const isSigned = !!signature

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
                    <Badge variant="error">Missing</Badge>
                  )}
                </div>

                {isSigned && signature ? (
                  <div className="space-y-2">
                    <div
                      className="border border-white/20 rounded p-2 bg-white/5"
                      dangerouslySetInnerHTML={{ __html: signature.signature_svg }}
                      style={{ maxHeight: '80px', overflow: 'hidden' }}
                    />
                    <div className="text-sm text-white/90">{signature.signer_name}</div>
                    <div className="text-xs text-white/60">{signature.signer_title}</div>
                    <div className="text-xs text-white/40">
                      {new Date(signature.signed_at).toLocaleDateString()}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="border-2 border-dashed border-white/20 rounded p-4 bg-white/5 text-center text-white/40 text-sm">
                      No signature
                    </div>
                    {!readOnly && reportRunId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenCapture(role)}
                        className="w-full"
                      >
                        Sign Now
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {captureOpen && (
        <SignatureCapture
          role={captureOpen.role}
          onSave={handleSaveSignature}
          onCancel={() => setCaptureOpen(null)}
        />
      )}
    </>
  )
}

