/**
 * Escalation Trail Section Component
 * Renders escalation history and notification chain
 */

import { EmptySection } from './EmptySection'
import { pdfTheme } from '@/lib/design-system/pdfTheme'
import { formatDate } from '@/lib/utils/reportUtils'

interface EscalationTrailSectionProps {
  data: {
    escalations?: Array<{
      id: string
      timestamp: string
      from: string
      to: string
      reason: string
      status: string
    }>
    count?: number
  }
  empty?: boolean
  emptyMessage?: string
}

export function EscalationTrailSection({ data, empty, emptyMessage }: EscalationTrailSectionProps) {
  const escalations = data.escalations || []
  const count = data.count ?? escalations.length

  if (empty || count === 0) {
    return (
      <div className="page">
        <EmptySection
          title="Escalation Trail"
          description={emptyMessage || "No escalations recorded for this job."}
          whatThisProves="Documents the complete escalation chain, showing who was notified when and why, establishing accountability and communication protocol."
          howToSatisfy="Escalations are automatically recorded when risks are escalated to safety leads or executives. Escalations occur when jobs are flagged or risk levels change."
        />
      </div>
    )
  }

  return (
    <div className="page">
      <h2 className="section-header">Escalation Trail</h2>
      <div style={{ marginBottom: '16pt', fontSize: '10pt', color: pdfTheme.colors.muted }}>
        Complete record of escalations and notifications related to this job.
        All escalations are timestamped and immutable.
      </div>
      <table className="audit-table">
        <thead>
          <tr>
            <th style={{ width: '18%' }}>Timestamp</th>
            <th style={{ width: '20%' }}>From</th>
            <th style={{ width: '20%' }}>To</th>
            <th style={{ width: '27%' }}>Reason</th>
            <th style={{ width: '15%' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {escalations.map((escalation, idx) => (
            <tr key={escalation.id} className={idx % 2 === 0 ? 'even-row' : ''}>
              <td style={{ fontFamily: 'monospace', fontSize: '9pt' }}>
                {formatDate(escalation.timestamp)}
              </td>
              <td>{escalation.from || 'System'}</td>
              <td>{escalation.to || 'Unknown'}</td>
              <td>{escalation.reason || 'No reason provided'}</td>
              <td>{escalation.status || 'Unknown'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ 
        marginTop: '16pt',
        padding: '12pt',
        backgroundColor: '#f9f9f9',
        borderRadius: '4pt',
        fontSize: '9pt',
        color: pdfTheme.colors.muted
      }}>
        <strong>Total:</strong> {count} escalation{count !== 1 ? 's' : ''} recorded • 
        Provides complete accountability and communication trail
      </div>
    </div>
  )
}

