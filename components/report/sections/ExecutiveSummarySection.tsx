/**
 * Executive Summary Section Component
 * Renders high-level summary at the start of every packet
 */

interface ExecutiveSummarySectionProps {
  data: {
    riskScore: number | null
    riskLevel: string | null
    hazardCount: number
    controlsTotal: number
    controlsComplete: number
    attestationsCount: number
    evidenceCount: number
    jobStatus: string
    packetType: string
  }
}

export function ExecutiveSummarySection({ data }: ExecutiveSummarySectionProps) {
  const controlsPercent = data.controlsTotal > 0 
    ? Math.round((data.controlsComplete / data.controlsTotal) * 100) 
    : 0

  const getRiskColor = (level: string | null) => {
    if (!level) return '#666'
    const lower = level.toLowerCase()
    if (lower === 'critical') return '#dc2626'
    if (lower === 'high') return '#ea580c'
    if (lower === 'medium') return '#ca8a04'
    return '#16a34a'
  }

  const riskColor = getRiskColor(data.riskLevel)

  return (
    <div className="page">
      <h2 className="section-header">Executive Summary</h2>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '24pt',
        marginBottom: '24pt'
      }}>
        {/* Risk Score Card */}
        <div className="column-card" style={{ borderLeft: `4pt solid ${riskColor}` }}>
          <h3 className="card-title">Risk Assessment</h3>
          <div style={{ fontSize: '32pt', fontWeight: 'bold', color: riskColor, marginBottom: '8pt' }}>
            {data.riskScore !== null ? data.riskScore : 'N/A'}
          </div>
          <div style={{ fontSize: '11pt', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {data.riskLevel || 'Unknown'} Risk
          </div>
        </div>

        {/* Controls Status Card */}
        <div className="column-card">
          <h3 className="card-title">Controls Status</h3>
          <div style={{ fontSize: '24pt', fontWeight: 'bold', marginBottom: '8pt' }}>
            {data.controlsComplete} / {data.controlsTotal}
          </div>
          <div style={{ fontSize: '11pt', color: '#666' }}>
            {controlsPercent}% Complete
          </div>
          {data.controlsTotal === 0 && (
            <div style={{ fontSize: '9pt', color: '#999', fontStyle: 'italic', marginTop: '8pt' }}>
              No controls defined
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', 
        gap: '16pt',
        marginBottom: '24pt'
      }}>
        <div className="column-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '20pt', fontWeight: 'bold', marginBottom: '4pt' }}>
            {data.hazardCount}
          </div>
          <div style={{ fontSize: '9pt', color: '#666', textTransform: 'uppercase' }}>
            Hazards
          </div>
        </div>

        <div className="column-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '20pt', fontWeight: 'bold', marginBottom: '4pt' }}>
            {data.attestationsCount}
          </div>
          <div style={{ fontSize: '9pt', color: '#666', textTransform: 'uppercase' }}>
            Attestations
          </div>
        </div>

        <div className="column-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '20pt', fontWeight: 'bold', marginBottom: '4pt' }}>
            {data.evidenceCount}
          </div>
          <div style={{ fontSize: '9pt', color: '#666', textTransform: 'uppercase' }}>
            Evidence Items
          </div>
        </div>

        <div className="column-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '20pt', fontWeight: 'bold', marginBottom: '4pt', textTransform: 'capitalize' }}>
            {data.jobStatus}
          </div>
          <div style={{ fontSize: '9pt', color: '#666', textTransform: 'uppercase' }}>
            Job Status
          </div>
        </div>
      </div>

      {/* Packet Purpose Statement */}
      <div style={{ 
        padding: '16pt', 
        backgroundColor: '#f5f5f5', 
        borderRadius: '6pt',
        fontSize: '10pt',
        lineHeight: '1.6',
        color: '#333'
      }}>
        <strong>Packet Purpose:</strong> This {data.packetType} packet provides a comprehensive record of job documentation, 
        risk assessment, controls applied, and compliance verification. All records are timestamped, immutable, 
        and serve as defensible proof of due diligence.
      </div>
    </div>
  )
}

