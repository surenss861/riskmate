/**
 * Executive Summary Section Component
 * Renders high-level summary with defensibility assessment
 */

import { pdfTheme } from '@/lib/design-system/pdfTheme'

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
    previousRunId?: string | null
  }
}

export function ExecutiveSummarySection({ data }: ExecutiveSummarySectionProps) {
  const controlsPercent = data.controlsTotal > 0 
    ? Math.round((data.controlsComplete / data.controlsTotal) * 100) 
    : 0

  // Defensibility assessment
  const isDefensible = data.controlsComplete === data.controlsTotal && data.controlsTotal > 0 && data.riskScore !== null
  const defensibilityReason = isDefensible 
    ? 'All required controls completed, risk assessment complete'
    : data.controlsTotal === 0
    ? 'No controls defined - add controls to improve defensibility'
    : data.controlsComplete < data.controlsTotal
    ? `${data.controlsTotal - data.controlsComplete} control(s) pending completion`
    : 'Risk assessment incomplete'

  // Top 3 gaps
  const gaps: string[] = []
  if (data.controlsTotal === 0) {
    gaps.push('No controls/mitigations defined')
  } else if (data.controlsComplete < data.controlsTotal) {
    gaps.push(`${data.controlsTotal - data.controlsComplete} control(s) incomplete`)
  }
  if (data.attestationsCount === 0) {
    gaps.push('No attestations/signatures collected')
  }
  if (data.evidenceCount === 0) {
    gaps.push('No evidence photos uploaded')
  }
  if (data.riskScore === null) {
    gaps.push('Risk assessment not completed')
  }
  // Limit to top 3
  const topGaps = gaps.slice(0, 3)

  const getRiskBadgeClass = (level: string | null) => {
    if (!level) return 'risk-badge-low'
    const lower = level.toLowerCase()
    if (lower === 'critical') return 'risk-badge-critical'
    if (lower === 'high') return 'risk-badge-high'
    if (lower === 'medium') return 'risk-badge-medium'
    return 'risk-badge-low'
  }

  return (
    <div className="page">
      <h2 className="section-header">Executive Summary</h2>
      
      {/* What Changed Since Last Run */}
      <div className="column-card" style={{ marginBottom: pdfTheme.spacing.sectionGap, borderLeft: `4pt solid ${pdfTheme.colors.borders}` }}>
        <h3 className="card-title">What Changed Since Last Run</h3>
        <div style={{ 
          fontSize: pdfTheme.typography.sizes.body, 
          color: pdfTheme.colors.muted,
          lineHeight: pdfTheme.typography.lineHeight.normal
        }}>
          {data.previousRunId ? (
            <>
              Prior run exists: <span style={{ fontFamily: 'monospace', fontSize: pdfTheme.typography.sizes.caption }}>
                {data.previousRunId.substring(0, 8).toUpperCase()}
              </span>
              <br />
              <span style={{ fontSize: pdfTheme.typography.sizes.caption, fontStyle: 'italic' }}>
                Detailed comparison not yet enabled. Review individual runs for complete change history.
              </span>
            </>
          ) : (
            <>
              No prior run found for this job.
              <br />
              <span style={{ fontSize: pdfTheme.typography.sizes.caption, fontStyle: 'italic' }}>
                This is the first report run for this job.
              </span>
            </>
          )}
        </div>
      </div>

      {/* Defensibility Assessment */}
      <div className="column-card" style={{ marginBottom: pdfTheme.spacing.sectionGap, borderLeft: `4pt solid ${isDefensible ? '#16a34a' : pdfTheme.colors.accent}` }}>
        <h3 className="card-title">Defensibility Status</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: pdfTheme.spacing.textGap, marginBottom: pdfTheme.spacing.textGap }}>
          <div style={{ 
            fontSize: pdfTheme.typography.sizes.h2, 
            fontWeight: pdfTheme.typography.weights.bold,
            color: isDefensible ? '#16a34a' : pdfTheme.colors.accent
          }}>
            {isDefensible ? '✓ Defensible' : '⚠ Not Defensible'}
          </div>
        </div>
        <div style={{ 
          fontSize: pdfTheme.typography.sizes.body, 
          color: pdfTheme.colors.ink,
          lineHeight: pdfTheme.typography.lineHeight.normal
        }}>
          {defensibilityReason}
        </div>
        {topGaps.length > 0 && (
          <div style={{ marginTop: pdfTheme.spacing.textGap, paddingTop: pdfTheme.spacing.textGap, borderTop: `${pdfTheme.borders.thin} solid ${pdfTheme.colors.borders}` }}>
            <div style={{ 
              fontSize: pdfTheme.typography.sizes.caption, 
              fontWeight: pdfTheme.typography.weights.semibold,
              color: pdfTheme.colors.muted,
              marginBottom: '6pt',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Top Gaps to Address
            </div>
            <ul style={{ 
              listStyle: 'none', 
              padding: 0, 
              margin: 0,
              fontSize: pdfTheme.typography.sizes.body
            }}>
              {topGaps.map((gap, idx) => (
                <li key={idx} style={{ 
                  marginBottom: '4pt',
                  paddingLeft: '16pt',
                  position: 'relative',
                  color: pdfTheme.colors.ink
                }}>
                  <span style={{ position: 'absolute', left: 0 }}>•</span>
                  {gap}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      {/* Key Metrics - 2-column grid */}
      <div className="pdf-grid-2" style={{ marginBottom: pdfTheme.spacing.sectionGap }}>
        {/* Risk Score Card */}
        <div className="column-card">
          <h3 className="card-title">Risk Assessment</h3>
          <div style={{ 
            fontSize: '32pt', 
            fontWeight: pdfTheme.typography.weights.bold, 
            color: pdfTheme.colors.ink, 
            marginBottom: '8pt',
            lineHeight: 1
          }}>
            {data.riskScore !== null ? data.riskScore : 'N/A'}
          </div>
          {data.riskLevel && (
            <div className={`risk-badge ${getRiskBadgeClass(data.riskLevel)}`}>
              {data.riskLevel.toUpperCase()}
            </div>
          )}
        </div>

        {/* Controls Status Card */}
        <div className="column-card">
          <h3 className="card-title">Controls Status</h3>
          <div style={{ 
            fontSize: '24pt', 
            fontWeight: pdfTheme.typography.weights.bold, 
            marginBottom: '8pt',
            lineHeight: 1
          }}>
            {data.controlsComplete} / {data.controlsTotal}
          </div>
          <div style={{ 
            fontSize: pdfTheme.typography.sizes.body, 
            color: pdfTheme.colors.muted 
          }}>
            {controlsPercent}% Complete
          </div>
          {data.controlsTotal === 0 && (
            <div style={{ 
              fontSize: pdfTheme.typography.sizes.caption, 
              color: pdfTheme.colors.muted, 
              fontStyle: 'italic', 
              marginTop: '8pt' 
            }}>
              No controls defined
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats Grid - 4-column */}
      <div className="pdf-grid-4" style={{ marginBottom: pdfTheme.spacing.sectionGap }}>
        <div className="column-card" style={{ textAlign: 'center' }}>
          <div style={{ 
            fontSize: '20pt', 
            fontWeight: pdfTheme.typography.weights.bold, 
            marginBottom: '4pt',
            color: pdfTheme.colors.ink
          }}>
            {data.hazardCount}
          </div>
          <div style={{ 
            fontSize: pdfTheme.typography.sizes.caption, 
            color: pdfTheme.colors.muted, 
            textTransform: 'uppercase' 
          }}>
            Hazards
          </div>
        </div>

        <div className="column-card" style={{ textAlign: 'center' }}>
          <div style={{ 
            fontSize: '20pt', 
            fontWeight: pdfTheme.typography.weights.bold, 
            marginBottom: '4pt',
            color: pdfTheme.colors.ink
          }}>
            {data.attestationsCount}
          </div>
          <div style={{ 
            fontSize: pdfTheme.typography.sizes.caption, 
            color: pdfTheme.colors.muted, 
            textTransform: 'uppercase' 
          }}>
            Attestations
          </div>
        </div>

        <div className="column-card" style={{ textAlign: 'center' }}>
          <div style={{ 
            fontSize: '20pt', 
            fontWeight: pdfTheme.typography.weights.bold, 
            marginBottom: '4pt',
            color: pdfTheme.colors.ink
          }}>
            {data.evidenceCount}
          </div>
          <div style={{ 
            fontSize: pdfTheme.typography.sizes.caption, 
            color: pdfTheme.colors.muted, 
            textTransform: 'uppercase' 
          }}>
            Evidence Items
          </div>
        </div>

        <div className="column-card" style={{ textAlign: 'center' }}>
          <div style={{ 
            fontSize: '20pt', 
            fontWeight: pdfTheme.typography.weights.bold, 
            marginBottom: '4pt',
            textTransform: 'capitalize',
            color: pdfTheme.colors.ink
          }}>
            {data.jobStatus}
          </div>
          <div style={{ 
            fontSize: pdfTheme.typography.sizes.caption, 
            color: pdfTheme.colors.muted, 
            textTransform: 'uppercase' 
          }}>
            Job Status
          </div>
        </div>
      </div>

      {/* Packet Purpose Statement */}
      <div className="column-card" style={{ 
        backgroundColor: '#FAFAFA'
      }}>
        <div style={{ 
          fontSize: pdfTheme.typography.sizes.body,
          lineHeight: pdfTheme.typography.lineHeight.relaxed,
          color: pdfTheme.colors.ink
        }}>
          <strong>Packet Purpose:</strong> This {data.packetType} packet provides a comprehensive record of job documentation, 
          risk assessment, controls applied, and compliance verification. All records are timestamped, immutable, 
          and serve as defensible proof of due diligence.
        </div>
      </div>
    </div>
  )
}
