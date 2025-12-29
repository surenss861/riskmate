/**
 * Hazard Checklist Section Component
 * Renders hazard checklist table with severity indicators
 */

import { getSeverityColor } from '@/lib/utils/reportUtils'

interface HazardChecklistSectionProps {
  data: {
    factors: Array<{
      name?: string
      code?: string
      severity?: string
      present?: boolean
      notes?: string | null
    }>
  }
  empty?: boolean
  emptyMessage?: string
}

export function HazardChecklistSection({ data, empty, emptyMessage }: HazardChecklistSectionProps) {
  if (empty || !data.factors || data.factors.length === 0) {
    return (
      <div className="page">
        <h2 className="section-header">Hazard Checklist</h2>
        <p className="empty-state">{emptyMessage || 'No hazards identified'}</p>
      </div>
    )
  }

  return (
    <div className="page">
      <h2 className="section-header">Hazard Checklist</h2>
      <table className="audit-table">
        <thead>
          <tr>
            <th>Hazard</th>
            <th>Severity</th>
            <th>Present</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {data.factors.map((factor, idx) => {
            const severity = factor.severity || 'low'
            const severityColor = getSeverityColor(severity)
            return (
              <tr key={idx} className={idx % 2 === 0 ? 'even-row' : ''}>
                <td>{factor.name || factor.code || 'Unknown'}</td>
                <td>
                  <span
                    className="severity-badge"
                    style={{
                      backgroundColor: severityColor + '20',
                      color: severityColor,
                      borderColor: severityColor,
                    }}
                  >
                    {severity.toUpperCase()}
                  </span>
                </td>
                <td>{factor.present !== undefined ? (factor.present ? 'Yes' : 'No') : 'N/A'}</td>
                <td>{factor.notes || 'None'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

