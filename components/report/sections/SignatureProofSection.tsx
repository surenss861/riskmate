/**
 * Signature Proof Section Component
 * Final page showing signature attestations, run information, and proof of signing
 */

import { formatPdfTimestamp } from '@/lib/utils/pdfFormatUtils'
import { pdfTheme } from '@/lib/design-system/pdfTheme'

interface Signature {
  signer_name: string
  signer_email?: string | null
  signer_title: string
  signature_role: 'prepared_by' | 'reviewed_by' | 'approved_by' | 'other'
  signed_at: string
  signature_svg: string
  attestation_text?: string | null
}

interface SignatureProofSectionProps {
  data: {
    reportRunId: string
    reportRunHash: string
    reportRunCreatedAt: string
    signatures: Signature[]
    isDraft?: boolean
    requiredRoles?: string[]
  }
}

const ROLE_LABELS: Record<string, string> = {
  prepared_by: 'Prepared By',
  reviewed_by: 'Reviewed By',
  approved_by: 'Approved By',
  other: 'Signature',
}

export function SignatureProofSection({ data }: SignatureProofSectionProps) {
  const { reportRunId, reportRunHash, reportRunCreatedAt, signatures, isDraft = false, requiredRoles = [] } = data
  
  const signedCount = signatures.length
  const totalRequired = requiredRoles.length || 3 // Default to 3 if not provided
  const missingRoles = requiredRoles.filter(
    role => !signatures.some(sig => sig.signature_role === role)
  )
  
  const attestationText = 'I attest this report is accurate to the best of my knowledge.'

  return (
    <div className="page">
      <h2 className="section-header">Signature Proof & Attestation</h2>
      
      {/* Draft Warning */}
      {isDraft && (
        <div style={{
          backgroundColor: '#FFF4E6',
          border: `${pdfTheme.borders.medium} solid #ca8a04`,
          borderRadius: pdfTheme.borders.radius,
          padding: pdfTheme.spacing.cardPadding,
          marginBottom: pdfTheme.spacing.sectionGap,
        }}>
          <div style={{
            fontSize: pdfTheme.typography.sizes.h2,
            fontWeight: pdfTheme.typography.weights.bold,
            color: '#ca8a04',
            marginBottom: pdfTheme.spacing.textGap,
          }}>
            DRAFT — {signedCount}/{totalRequired} SIGNED
          </div>
          {missingRoles.length > 0 && (
            <div style={{
              fontSize: pdfTheme.typography.sizes.body,
              color: pdfTheme.colors.ink,
              marginTop: pdfTheme.spacing.textGap,
            }}>
              <strong>Missing Signatures:</strong> {missingRoles.map(role => ROLE_LABELS[role] || role).join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Report Run Information */}
      <div className="column-card" style={{ marginBottom: pdfTheme.spacing.sectionGap }}>
        <h3 className="card-title">Report Run Information</h3>
        <div className="detail-list">
          <div className="detail-item">
            <strong>Run ID:</strong> {reportRunId}
          </div>
          <div className="detail-item">
            <strong>Created:</strong> {formatPdfTimestamp(reportRunCreatedAt)}
          </div>
          <div className="detail-item" style={{ 
            fontFamily: 'monospace', 
            fontSize: pdfTheme.typography.sizes.caption,
            wordBreak: 'break-all',
            overflowWrap: 'break-word',
            backgroundColor: '#FAFAFA',
            padding: '12pt',
            borderRadius: pdfTheme.borders.radius,
            border: `${pdfTheme.borders.thin} solid ${pdfTheme.colors.borders}`,
            marginTop: '8pt',
          }}>
            <strong style={{ display: 'block', marginBottom: '6pt' }}>Run Hash (SHA-256):</strong>
            <div style={{ 
              fontFamily: 'monospace',
              fontSize: '9pt',
              letterSpacing: '0.5px',
              wordBreak: 'break-all',
              overflowWrap: 'break-word'
            }}>
              {reportRunHash}
            </div>
          </div>
        </div>
      </div>

      {/* Signatures Table */}
      <div style={{ marginBottom: pdfTheme.spacing.sectionGap }}>
        <h3 className="card-title" style={{ marginBottom: pdfTheme.spacing.textGap }}>
          Signatures
        </h3>
        
        {signatures.length === 0 ? (
          <div style={{
            padding: pdfTheme.spacing.cardPadding,
            border: `${pdfTheme.borders.medium} solid ${pdfTheme.colors.borders}`,
            borderRadius: pdfTheme.borders.radius,
            backgroundColor: '#FAFAFA',
            textAlign: 'center',
            color: pdfTheme.colors.muted,
            fontStyle: 'italic',
          }}>
            No signatures have been captured for this report run.
          </div>
        ) : (
          <div style={{
            border: `${pdfTheme.borders.medium} solid ${pdfTheme.colors.borders}`,
            borderRadius: pdfTheme.borders.radius,
            overflow: 'hidden',
          }}>
            {signatures.map((sig, idx) => (
              <div
                key={idx}
                style={{
                  borderBottom: idx < signatures.length - 1 
                    ? `${pdfTheme.borders.thin} solid ${pdfTheme.colors.borders}` 
                    : 'none',
                  padding: pdfTheme.spacing.cardPadding,
                  backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                }}
              >
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '200pt 1fr',
                  gap: pdfTheme.spacing.textGap,
                  marginBottom: pdfTheme.spacing.textGap,
                }}>
                  <div style={{ fontWeight: pdfTheme.typography.weights.semibold, color: pdfTheme.colors.ink }}>
                    {ROLE_LABELS[sig.signature_role] || sig.signature_role}:
                  </div>
                  <div style={{ color: pdfTheme.colors.ink }}>
                    {sig.signer_name}
                    {sig.signer_email && (
                      <div style={{ fontSize: pdfTheme.typography.sizes.small, color: pdfTheme.colors.muted, marginTop: '2pt' }}>
                        {sig.signer_email}
                      </div>
                    )}
                    <div style={{ fontSize: pdfTheme.typography.sizes.small, color: pdfTheme.colors.muted, marginTop: '2pt' }}>
                      {sig.signer_title}
                    </div>
                  </div>
                </div>
                
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '200pt 1fr',
                  gap: pdfTheme.spacing.textGap,
                  marginBottom: pdfTheme.spacing.textGap,
                }}>
                  <div style={{ fontWeight: pdfTheme.typography.weights.semibold, color: pdfTheme.colors.ink }}>
                    Signed At:
                  </div>
                  <div style={{ color: pdfTheme.colors.ink }}>
                    {formatPdfTimestamp(sig.signed_at)}
                  </div>
                </div>
                
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '200pt 1fr',
                  gap: pdfTheme.spacing.textGap,
                  marginBottom: pdfTheme.spacing.textGap,
                }}>
                  <div style={{ fontWeight: pdfTheme.typography.weights.semibold, color: pdfTheme.colors.ink }}>
                    Signature Method:
                  </div>
                  <div style={{ color: pdfTheme.colors.ink }}>
                    Drawn Signature
                  </div>
                </div>
                
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '200pt 1fr',
                  gap: pdfTheme.spacing.textGap,
                  marginBottom: pdfTheme.spacing.textGap,
                }}>
                  <div style={{ fontWeight: pdfTheme.typography.weights.semibold, color: pdfTheme.colors.ink }}>
                    Hash at Sign Time:
                  </div>
                  <div style={{ 
                    fontFamily: 'monospace',
                    fontSize: pdfTheme.typography.sizes.caption,
                    color: pdfTheme.colors.ink,
                    wordBreak: 'break-all',
                  }}>
                    {reportRunHash.substring(0, 32)}...
                  </div>
                </div>
                
                <div style={{
                  border: `${pdfTheme.borders.thin} solid ${pdfTheme.colors.borders}`,
                  borderRadius: pdfTheme.borders.radius,
                  padding: '12pt',
                  backgroundColor: '#FFFFFF',
                  marginBottom: pdfTheme.spacing.textGap,
                  minHeight: '80pt',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <div
                    dangerouslySetInnerHTML={{ __html: sig.signature_svg }}
                    style={{
                      maxHeight: '60pt',
                      maxWidth: '100%',
                    }}
                  />
                </div>
                
                <div style={{
                  padding: pdfTheme.spacing.textGap,
                  backgroundColor: '#E6F7E6',
                  border: `${pdfTheme.borders.thin} solid #16a34a`,
                  borderRadius: pdfTheme.borders.radius,
                }}>
                  <div style={{
                    fontWeight: pdfTheme.typography.weights.semibold,
                    color: '#16a34a',
                    marginBottom: '4pt',
                    fontSize: pdfTheme.typography.sizes.small,
                  }}>
                    Attestation Statement:
                  </div>
                  <div style={{
                    fontSize: pdfTheme.typography.sizes.body,
                    color: pdfTheme.colors.ink,
                  }}>
                    {sig.attestation_text || attestationText}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confidential Notice */}
      <div className="integrity-confidential" style={{ marginTop: pdfTheme.spacing.sectionGap }}>
        <strong>CONFIDENTIAL</strong> — This document contains sensitive information and is intended only for authorized recipients.
        Unauthorized disclosure, copying, or distribution is prohibited.
      </div>
    </div>
  )
}

