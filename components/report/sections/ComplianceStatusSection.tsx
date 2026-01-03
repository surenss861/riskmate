/**
 * Compliance Status Section Component
 * Renders compliance status summary with defensible messaging
 */

interface ComplianceStatusSectionProps {
  data: {
    status: string
    riskLevel: string
    controlsComplete: boolean
    hasAttestations: boolean
    controlsTotal?: number
    controlsCompleted?: number
  }
}

export function ComplianceStatusSection({ data }: ComplianceStatusSectionProps) {
  const controlsPercent = data.controlsTotal && data.controlsTotal > 0
    ? Math.round((data.controlsCompleted || 0) / data.controlsTotal * 100)
    : 0

  const getStatusColor = (status: string) => {
    const lower = status.toLowerCase()
    if (lower === 'complete' || lower === 'closed') return '#16a34a'
    if (lower === 'draft' || lower === 'pending') return '#ca8a04'
    return '#666'
  }

  const getRiskColor = (level: string) => {
    const lower = level.toLowerCase()
    if (lower === 'critical') return '#dc2626'
    if (lower === 'high') return '#ea580c'
    if (lower === 'medium') return '#ca8a04'
    return '#16a34a'
  }

  return (
    <div className="page">
      <h2 className="section-header">Compliance Status</h2>
      
      {/* Status Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '16pt',
        marginBottom: '24pt'
      }}>
        <div className="column-card" style={{ borderLeft: `4pt solid ${getStatusColor(data.status)}` }}>
          <h3 className="card-title">Job Status</h3>
          <div style={{ fontSize: '18pt', fontWeight: 'bold', color: getStatusColor(data.status), textTransform: 'capitalize' }}>
            {data.status}
          </div>
        </div>

        <div className="column-card" style={{ borderLeft: `4pt solid ${getRiskColor(data.riskLevel)}` }}>
          <h3 className="card-title">Risk Level</h3>
          <div style={{ fontSize: '18pt', fontWeight: 'bold', color: getRiskColor(data.riskLevel), textTransform: 'uppercase' }}>
            {data.riskLevel}
          </div>
        </div>
      </div>

      {/* Controls Status */}
      <div className="column-card" style={{ marginBottom: '24pt' }}>
        <h3 className="card-title">Controls Status</h3>
        {data.controlsTotal !== undefined && data.controlsTotal > 0 ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12pt' }}>
              <span style={{ fontSize: '14pt', fontWeight: 'bold' }}>
                {data.controlsCompleted || 0} / {data.controlsTotal} Complete
              </span>
              <span style={{ fontSize: '12pt', color: '#666' }}>
                {controlsPercent}%
              </span>
            </div>
            <div style={{ 
              width: '100%', 
              height: '8pt', 
              backgroundColor: '#e0e0e0', 
              borderRadius: '4pt',
              overflow: 'hidden'
            }}>
              <div style={{ 
                width: `${controlsPercent}%`, 
                height: '100%', 
                backgroundColor: data.controlsComplete ? '#16a34a' : '#ca8a04',
                transition: 'width 0.3s'
              }} />
            </div>
            {!data.controlsComplete && (
              <div style={{ marginTop: '12pt', fontSize: '10pt', color: '#666', fontStyle: 'italic' }}>
                Controls pending completion as of {new Date().toLocaleString('en-US', { timeZone: 'UTC' })} UTC
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: '11pt', color: '#666', fontStyle: 'italic' }}>
            No controls defined for this job
          </div>
        )}
      </div>

      {/* Attestations Status */}
      <div className="column-card">
        <h3 className="card-title">Attestations</h3>
        {data.hasAttestations ? (
          <div style={{ fontSize: '11pt', color: '#16a34a' }}>
            ✓ Attestations signed and verified
          </div>
        ) : (
          <div style={{ fontSize: '11pt', color: '#666' }}>
            <div style={{ marginBottom: '8pt', fontStyle: 'italic' }}>
              Attestations required for closure — pending
            </div>
            <div style={{ fontSize: '9pt', color: '#999' }}>
              Evidence requested but not uploaded as of {new Date().toLocaleString('en-US', { timeZone: 'UTC' })} UTC
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

