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
  // Skip empty sections (no page rendered)
  if (empty) {
    return null
  }

  const riskColor = getRiskColor(data.riskLevel)

  return (
    <div className="page">
      <h2 className="section-header">Risk Assessment</h2>
      
      {/* Risk Score Display */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 2fr', 
        gap: '24pt',
        marginBottom: '24pt'
      }}>
        <div className="column-card risk-card" style={{ borderLeftColor: riskColor, borderLeftWidth: '4pt' }}>
          <h3 className="card-title">Overall Risk Score</h3>
          <div style={{ 
            fontSize: '48pt', 
            fontWeight: 'bold', 
            color: riskColor,
            marginBottom: '8pt',
            lineHeight: 1
          }}>
            {data.overallScore}
          </div>
          <div
            style={{
              display: 'inline-block',
              padding: '4pt 12pt',
              backgroundColor: riskColor + '20',
              border: `1pt solid ${riskColor}`,
              borderRadius: '4pt',
              color: riskColor,
              fontSize: '11pt',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            {data.riskLevel}
          </div>
        </div>

        {/* Top Risk Drivers */}
        {data.factors && data.factors.length > 0 && (
          <div className="column-card">
            <h3 className="card-title">Top Risk Drivers</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12pt' }}>
              {data.factors.slice(0, 5).map((factor, idx) => {
                const severity = factor.severity?.toLowerCase() || 'medium'
                const severityColor = 
                  severity === 'critical' ? '#dc2626' :
                  severity === 'high' ? '#ea580c' :
                  severity === 'medium' ? '#ca8a04' : '#16a34a'
                
                return (
                  <div 
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12pt',
                      padding: '8pt',
                      backgroundColor: '#f9f9f9',
                      borderRadius: '4pt'
                    }}
                  >
                    <div style={{
                      width: '8pt',
                      height: '8pt',
                      borderRadius: '50%',
                      backgroundColor: severityColor,
                      flexShrink: 0
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', fontSize: '11pt', color: '#111' }}>
                        {factor.name || factor.code || 'Unknown'}
                      </div>
                      {factor.code && (
                        <div style={{ fontSize: '9pt', color: '#666', fontFamily: 'monospace' }}>
                          {factor.code}
                        </div>
                      )}
                    </div>
                    <div style={{
                      padding: '2pt 8pt',
                      backgroundColor: severityColor + '20',
                      color: severityColor,
                      borderRadius: '4pt',
                      fontSize: '9pt',
                      fontWeight: '600',
                      textTransform: 'uppercase'
                    }}>
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
