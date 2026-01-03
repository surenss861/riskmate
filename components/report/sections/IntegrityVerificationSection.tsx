/**
 * Integrity & Verification Section Component
 * Final page showing document hash, run ID, chain of custody, and QR code
 */

import { formatPdfTimestamp } from '@/lib/utils/pdfFormatUtils'
import { pdfTheme } from '@/lib/design-system/pdfTheme'

interface IntegrityVerificationSectionProps {
  data: {
    reportRunId: string
    documentHash: string
    hashAlgorithm: string
    generatedAt: string
    jobId: string
    packetType: string
    verificationUrl?: string
    qrCodeDataUrl?: string
  }
}

export function IntegrityVerificationSection({ data }: IntegrityVerificationSectionProps) {
  return (
    <div className="page">
      <h2 className="section-header">Integrity & Verification</h2>
      
      <div style={{ marginBottom: pdfTheme.spacing.sectionGap }}>
        <p style={{ 
          fontSize: pdfTheme.typography.sizes.body, 
          lineHeight: pdfTheme.typography.lineHeight.relaxed, 
          color: pdfTheme.colors.ink, 
          marginBottom: pdfTheme.spacing.sectionGap 
        }}>
          This document has been cryptographically signed and verified. The information below provides 
          proof of authenticity, immutability, and chain of custody for this report packet.
        </p>
      </div>

      {/* Verification Details - 2-column grid */}
      <div className="pdf-grid-2" style={{ marginBottom: pdfTheme.spacing.sectionGap }}>
        <div className="column-card">
          <h3 className="card-title">Document Verification</h3>
          <div className="detail-list">
            <div className="detail-item">
              <strong>Report Run ID:</strong> {data.reportRunId}
            </div>
            <div className="detail-item">
              <strong>Job ID:</strong> {data.jobId.substring(0, 8).toUpperCase()}
            </div>
            <div className="detail-item">
              <strong>Packet Type:</strong> {data.packetType}
            </div>
            <div className="detail-item">
              <strong>Generated:</strong> {formatPdfTimestamp(data.generatedAt)}
            </div>
          </div>
        </div>

        {/* Hash Information */}
        <div className="column-card">
          <h3 className="card-title">Document Hash</h3>
          <div className="detail-list">
            <div className="detail-item">
              <strong>Hash Algorithm:</strong> {data.hashAlgorithm || 'SHA-256'}
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
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap'
            }}>
              <strong style={{ display: 'block', marginBottom: '6pt' }}>Hash Value (SHA-256):</strong>
              <div style={{ 
                fontFamily: 'monospace',
                fontSize: '9pt',
                letterSpacing: '0.5px',
                wordBreak: 'break-all',
                overflowWrap: 'break-word'
              }}>
                {data.documentHash}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Verification */}
      {data.qrCodeDataUrl && data.verificationUrl && (
        <div className="qr-code-container">
          <div style={{ 
            fontSize: pdfTheme.typography.sizes.h3, 
            fontWeight: pdfTheme.typography.weights.semibold,
            marginBottom: pdfTheme.spacing.textGap,
            color: pdfTheme.colors.ink
          }}>
            Quick Verification
          </div>
          <img 
            src={data.qrCodeDataUrl} 
            alt="Verification QR Code" 
            className="qr-code-image"
          />
          <div style={{ 
            fontSize: pdfTheme.typography.sizes.caption, 
            color: pdfTheme.colors.muted,
            marginTop: pdfTheme.spacing.textGap
          }}>
            Scan to verify this document on RiskMate
          </div>
          {data.verificationUrl && (
            <div style={{ 
              fontSize: pdfTheme.typography.sizes.small, 
              color: pdfTheme.colors.muted,
              fontFamily: 'monospace',
              marginTop: '4pt',
              wordBreak: 'break-all'
            }}>
              {data.verificationUrl}
            </div>
          )}
        </div>
      )}

      {/* What This Proves */}
      <div className="integrity-section" style={{ marginTop: pdfTheme.spacing.sectionGap }}>
        <h3 style={{ 
          fontSize: pdfTheme.typography.sizes.h3, 
          fontWeight: pdfTheme.typography.weights.semibold, 
          marginBottom: pdfTheme.spacing.textGap, 
          color: pdfTheme.colors.ink 
        }}>
          What This Proves
        </h3>
        <ul className="integrity-proof-list">
          <li>
            <strong>Records are timestamped:</strong> All events and data points include precise UTC timestamps
          </li>
          <li>
            <strong>Edits are logged:</strong> All changes to job data are recorded in the audit trail
          </li>
          <li>
            <strong>Evidence is tied to event IDs:</strong> All photos, documents, and attestations are linked to specific job events
          </li>
          <li>
            <strong>Document integrity:</strong> This hash verifies the document has not been altered since generation
          </li>
          <li>
            <strong>Chain of custody:</strong> The Report Run ID provides a permanent record of this specific report generation
          </li>
        </ul>
      </div>

      {/* Confidential Notice */}
      <div className="integrity-confidential">
        <strong>CONFIDENTIAL</strong> — This document contains sensitive information and is intended only for authorized recipients.
        Unauthorized disclosure, copying, or distribution is prohibited.
      </div>
    </div>
  )
}
