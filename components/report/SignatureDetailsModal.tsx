'use client'

import { useState } from 'react'
import { X, ChevronDown, ChevronUp } from 'lucide-react'
import { formatPdfTimestamp } from '@/lib/utils/pdfFormatUtils'
import { sanitizeSvg } from '@/lib/utils/sanitizeSvg'
import { Button } from '@/components/shared'

interface Signature {
  id: string
  signer_name: string
  signer_title: string
  signature_role: 'prepared_by' | 'reviewed_by' | 'approved_by' | 'other'
  signature_svg: string
  signed_at: string
  signer_user_id?: string | null
  signer_email?: string | null
  ip_address?: string | null
  user_agent?: string | null
}

interface ReportRun {
  id: string
  data_hash: string
}

interface SignatureDetailsModalProps {
  signature: Signature
  reportRun: ReportRun
  onClose: () => void
}

const ROLE_LABELS: Record<string, string> = {
  prepared_by: 'Prepared By',
  reviewed_by: 'Reviewed By',
  approved_by: 'Approved By',
  other: 'Signature',
}

export function SignatureDetailsModal({
  signature,
  reportRun,
  onClose,
}: SignatureDetailsModalProps) {
  const [showDeviceInfo, setShowDeviceInfo] = useState(false)
  const attestationText = 'I attest this report is accurate to the best of my knowledge.'
  const hasDeviceInfo = !!(signature.ip_address || signature.user_agent)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1A1A1A] border border-white/10 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-2xl font-bold text-white">Signature Details</h2>
            <p className="text-sm text-white/60 mt-1">Audit trail and attestation evidence</p>
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
          {/* Signature Preview */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <div className="text-sm text-white/60 mb-2">Signature</div>
            <div
              className="border border-white/20 rounded p-3 bg-white"
              dangerouslySetInnerHTML={{ __html: sanitizeSvg(signature.signature_svg) }}
              style={{ maxHeight: '120px', overflow: 'hidden' }}
            />
          </div>

          {/* Signer Information */}
          <div className="space-y-4">
            <div>
              <div className="text-sm text-white/60 mb-1">Signer</div>
              <div className="text-lg text-white font-medium">{signature.signer_name}</div>
              {signature.signer_email && (
                <div className="text-sm text-white/60 mt-1">{signature.signer_email}</div>
              )}
              <div className="text-sm text-white/60 mt-1">{signature.signer_title}</div>
            </div>

            <div>
              <div className="text-sm text-white/60 mb-1">Role</div>
              <div className="text-white">{ROLE_LABELS[signature.signature_role]}</div>
            </div>

            <div>
              <div className="text-sm text-white/60 mb-1">Signed At</div>
              <div className="text-white">{formatPdfTimestamp(signature.signed_at)}</div>
              <div className="text-xs text-white/40 mt-1">Eastern Time (ET)</div>
            </div>
          </div>

          {/* Run Information */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 space-y-3">
            <div className="text-sm text-blue-400 font-medium">Report Run Information</div>
            <div>
              <div className="text-xs text-white/60 mb-1">Run ID</div>
              <div className="font-mono text-sm text-white/90">{reportRun.id}</div>
            </div>
            <div>
              <div className="text-xs text-white/60 mb-1">Run Hash (SHA-256)</div>
              <div className="font-mono text-xs text-white/90 break-all">
                {reportRun.data_hash}
              </div>
              <div className="text-xs text-white/40 mt-1">
                This signature is tied to this exact run snapshot
              </div>
            </div>
          </div>

          {/* Attestation */}
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <div className="text-sm text-green-400 font-medium mb-2">Attestation Statement</div>
            <div className="text-sm text-white/90">{attestationText}</div>
            <div className="text-xs text-white/50 mt-2">
              Accepted at signing time
            </div>
          </div>

          {/* Device & Network Information (Always shown, collapsed by default) */}
          <div className="border-t border-white/10 pt-4">
            <button
              onClick={() => setShowDeviceInfo(!showDeviceInfo)}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="text-sm text-white/60 font-medium">Device & Network Information</div>
              {showDeviceInfo ? (
                <ChevronUp className="w-4 h-4 text-white/60" />
              ) : (
                <ChevronDown className="w-4 h-4 text-white/60" />
              )}
            </button>
            {showDeviceInfo && (
              <div className="mt-3 space-y-2">
                <div className="text-xs text-white/50">
                  IP Address: {signature.ip_address ? (
                    <span className="text-white/70 font-mono">{signature.ip_address}</span>
                  ) : (
                    <span className="text-white/40 italic">Not captured</span>
                  )}
                </div>
                <div className="text-xs text-white/50 break-all">
                  User Agent: {signature.user_agent ? (
                    <span className="text-white/70">{signature.user_agent.substring(0, 150)}{signature.user_agent.length > 150 ? '...' : ''}</span>
                  ) : (
                    <span className="text-white/40 italic">Not captured</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-white/10">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
