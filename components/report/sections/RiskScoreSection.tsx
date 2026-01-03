/**
 * Risk Score Section Component
 * Renders risk assessment with score, level, and top drivers
 * Uses minimal design with outline badges/chips
 */

import { pdfTheme } from '@/lib/design-system/pdfTheme'

interface RiskScoreSectionProps {
  data: {
    overallScore: number
    riskLevel: string
    factors: Array<{
      name?: string
      code?: string
      severity?: string
    }>
  }
  empty?: boolean
  emptyMessage?: string
}

export function RiskScoreSection({ data, empty, emptyMessage }: RiskScoreSectionProps) {
  // Skip empty sections (no page rendered)
  if (empty) {
    return null
  }

  const getRiskBadgeClass = (level: string) => {
    const lower = level.toLowerCase()
    if (lower === 'critical') return 'risk-badge-critical'
    if (lower === 'high') return 'risk-badge-high'
    if (lower === 'medium') return 'risk-badge-medium'
    return 'risk-badge-low'
  }

  const getSeverityChipClass = (severity: string) => {
    const lower = severity.toLowerCase()
    if (lower === 'critical' || lower === 'high') return 'severity-chip-high'
    if (lower === 'medium') return 'severity-chip-medium'
    return 'severity-chip-low'
  }

  return (
    <div className="page">
      <h2 className="section-header">Risk Assessment</h2>
      
      {/* Risk Score Display - 2-column grid */}
      <div className="pdf-grid-2">
        {/* Overall Risk Score Card */}
        <div className="column-card">
          <h3 className="card-title">Overall Risk Score</h3>
          <div style={{ 
            fontSize: '48pt', 
            fontWeight: pdfTheme.typography.weights.bold, 
            color: pdfTheme.colors.ink,
            marginBottom: '12pt',
            lineHeight: 1
          }}>
            {data.overallScore}
          </div>
          <div className={`risk-badge ${getRiskBadgeClass(data.riskLevel)}`}>
            {data.riskLevel.toUpperCase()}
          </div>
        </div>

        {/* Top Risk Drivers */}
        {data.factors && data.factors.length > 0 && (
          <div className="column-card">
            <h3 className="card-title">Top Risk Drivers</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: pdfTheme.spacing.textGap }}>
              {data.factors.slice(0, 5).map((factor, idx) => {
                const severity = factor.severity?.toLowerCase() || 'medium'
                
                return (
                  <div 
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: pdfTheme.spacing.textGap,
                      padding: '8pt',
                      border: `${pdfTheme.borders.thin} solid ${pdfTheme.colors.borders}`,
                      borderRadius: pdfTheme.borders.radius,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontWeight: pdfTheme.typography.weights.semibold, 
                        fontSize: pdfTheme.typography.sizes.body, 
                        color: pdfTheme.colors.ink,
                        marginBottom: '2pt'
                      }}>
                        {factor.name || factor.code || 'Unknown'}
                      </div>
                      {factor.code && (
                        <div style={{ 
                          fontSize: pdfTheme.typography.sizes.caption, 
                          color: pdfTheme.colors.muted, 
                          fontFamily: 'monospace' 
                        }}>
                          {factor.code}
                        </div>
                      )}
                    </div>
                    <div className={`severity-chip ${getSeverityChipClass(severity)}`}>
                      {severity}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
