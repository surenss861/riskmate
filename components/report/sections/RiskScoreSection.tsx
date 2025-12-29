/**
 * Risk Score Section Component
 * Renders risk assessment with score, level, and top drivers
 */

import { getRiskColor } from '@/lib/utils/reportUtils'

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
  if (empty) {
    return (
      <div className="column-card risk-card">
        <h3 className="card-title">Risk Assessment</h3>
        <p className="empty-state">{emptyMessage || 'No risk assessment data available'}</p>
      </div>
    )
  }

  const riskColor = getRiskColor(data.riskLevel)

  return (
    <div className="column-card risk-card" style={{ borderLeftColor: riskColor }}>
      <h3 className="card-title">Risk Assessment</h3>
      <div className="risk-score-display">
        <div className="risk-score-value" style={{ color: riskColor }}>
          {data.overallScore}
        </div>
        <div
          className="risk-badge"
          style={{
            backgroundColor: riskColor + '20',
            borderColor: riskColor,
            color: riskColor,
          }}
        >
          {data.riskLevel.toUpperCase()}
        </div>
      </div>
      {data.factors && data.factors.length > 0 && (
        <div className="risk-drivers">
          <div className="risk-drivers-label">Top Drivers:</div>
          {data.factors.slice(0, 3).map((factor, idx) => (
            <div key={idx} className="risk-driver-item">
              • {factor.name || factor.code || 'Unknown'}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

