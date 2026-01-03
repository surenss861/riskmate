/**
 * Integrity & Verification Section Component
 * Final page showing document hash, run ID, and chain of custody
 */

interface IntegrityVerificationSectionProps {
  data: {
    reportRunId: string
    documentHash: string
    hashAlgorithm: string
    generatedAt: string
    jobId: string
    packetType: string
  }
}

export function IntegrityVerificationSection({ data }: IntegrityVerificationSectionProps) {
  return (
    <div className="page">
      <h2 className="section-header">Integrity & Verification</h2>
      
      <div style={{ marginBottom: '32pt' }}>
        <p style={{ fontSize: '11pt', lineHeight: '1.8', color: '#333', marginBottom: '24pt' }}>
          This document has been cryptographically signed and verified. The information below provides 
          proof of authenticity, immutability, and chain of custody for this report packet.
        </p>
      </div>

      {/* Verification Details */}
      <div className="column-card" style={{ marginBottom: '24pt' }}>
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
            <strong>Generated:</strong> {new Date(data.generatedAt).toLocaleString('en-US', { 
              timeZone: 'UTC',
              dateStyle: 'long',
              timeStyle: 'long'
            })} UTC
          </div>
        </div>
      </div>

      {/* Hash Information */}
      <div className="column-card" style={{ marginBottom: '24pt' }}>
        <h3 className="card-title">Document Hash</h3>
        <div className="detail-list">
          <div className="detail-item">
            <strong>Hash Algorithm:</strong> {data.hashAlgorithm}
          </div>
          <div className="detail-item" style={{ 
            fontFamily: 'monospace', 
            fontSize: '10pt',
            wordBreak: 'break-all',
            backgroundColor: '#f5f5f5',
            padding: '8pt',
            borderRadius: '4pt'
          }}>
            <strong>Hash Value:</strong><br />
            {data.documentHash}
          </div>
        </div>
      </div>

      {/* What This Proves */}
      <div style={{ 
        padding: '20pt', 
        backgroundColor: '#f9f9f9', 
        borderRadius: '6pt',
        border: '1pt solid #e0e0e0'
      }}>
        <h3 style={{ fontSize: '14pt', fontWeight: 'bold', marginBottom: '16pt', color: '#111' }}>
          What This Proves
        </h3>
        <ul style={{ 
          listStyle: 'none', 
          padding: 0, 
          margin: 0,
          fontSize: '10pt',
          lineHeight: '2',
          color: '#333'
        }}>
          <li style={{ marginBottom: '8pt', paddingLeft: '20pt', position: 'relative' }}>
            <span style={{ position: 'absolute', left: 0 }}>✓</span>
            <strong>Records are timestamped:</strong> All events and data points include precise UTC timestamps
          </li>
          <li style={{ marginBottom: '8pt', paddingLeft: '20pt', position: 'relative' }}>
            <span style={{ position: 'absolute', left: 0 }}>✓</span>
            <strong>Edits are logged:</strong> All changes to job data are recorded in the audit trail
          </li>
          <li style={{ marginBottom: '8pt', paddingLeft: '20pt', position: 'relative' }}>
            <span style={{ position: 'absolute', left: 0 }}>✓</span>
            <strong>Evidence is tied to event IDs:</strong> All photos, documents, and attestations are linked to specific job events
          </li>
          <li style={{ marginBottom: '8pt', paddingLeft: '20pt', position: 'relative' }}>
            <span style={{ position: 'absolute', left: 0 }}>✓</span>
            <strong>Document integrity:</strong> This hash verifies the document has not been altered since generation
          </li>
          <li style={{ paddingLeft: '20pt', position: 'relative' }}>
            <span style={{ position: 'absolute', left: 0 }}>✓</span>
            <strong>Chain of custody:</strong> The Report Run ID provides a permanent record of this specific report generation
          </li>
        </ul>
      </div>

      {/* Confidential Notice */}
      <div style={{ 
        marginTop: '32pt',
        padding: '12pt',
        textAlign: 'center',
        fontSize: '9pt',
        color: '#666',
        borderTop: '1pt solid #e0e0e0',
        paddingTop: '16pt'
      }}>
        <strong>CONFIDENTIAL</strong> — This document contains sensitive information and is intended only for authorized recipients.
        Unauthorized disclosure, copying, or distribution is prohibited.
      </div>
    </div>
  )
}

