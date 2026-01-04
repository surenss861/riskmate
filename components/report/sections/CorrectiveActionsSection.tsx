/**
 * Corrective Actions Section Component
 * Renders record of corrective actions taken
 */

import { EmptySection } from './EmptySection'
import { pdfTheme } from '@/lib/design-system/pdfTheme'
import { formatDate } from '@/lib/utils/reportUtils'

interface CorrectiveActionsSectionProps {
  data: {
    actions?: Array<{
      id: string
      timestamp: string
      action: string
      takenBy: string
      reason: string
      status: string
    }>
    count?: number
  }
  empty?: boolean
  emptyMessage?: string
}

export function CorrectiveActionsSection({ data, empty, emptyMessage }: CorrectiveActionsSectionProps) {
  const actions = data.actions || []
  const count = data.count ?? actions.length

  if (empty || count === 0) {
    return (
      <div className="page">
        <EmptySection
          title="Corrective Actions"
          description={emptyMessage || "No corrective actions recorded for this job."}
          whatThisProves="Documents all corrective actions taken to address risks, hazards, or compliance gaps identified during job execution."
          howToSatisfy="Corrective actions are recorded when risks are mitigated or compliance issues are addressed. Document actions as they occur."
        />
      </div>
    )
  }

  return (
    <div className="page">
      <h2 className="section-header">Corrective Actions</h2>
      <div style={{ marginBottom: '16pt', fontSize: '10pt', color: pdfTheme.colors.muted }}>
        Record of all corrective actions taken to address risks, hazards, or compliance gaps.
        All actions are timestamped and immutable.
      </div>
      <table className="audit-table">
        <thead>
          <tr>
            <th style={{ width: '20%' }}>Timestamp</th>
            <th style={{ width: '30%' }}>Action</th>
            <th style={{ width: '20%' }}>Taken By</th>
            <th style={{ width: '15%' }}>Status</th>
            <th style={{ width: '15%' }}>Reason</th>
          </tr>
        </thead>
        <tbody>
          {actions.map((action, idx) => (
            <tr key={action.id} className={idx % 2 === 0 ? 'even-row' : ''}>
              <td style={{ fontFamily: 'monospace', fontSize: '9pt' }}>
                {formatDate(action.timestamp)}
              </td>
              <td>{action.action || 'Unknown'}</td>
              <td>{action.takenBy || 'System'}</td>
              <td>{action.status || 'Unknown'}</td>
              <td style={{ fontSize: '9pt', color: pdfTheme.colors.muted }}>
                {action.reason || '—'}
              </td>
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
        <strong>Total:</strong> {count} action{count !== 1 ? 's' : ''} recorded • 
        Demonstrates proactive risk management and compliance response
      </div>
    </div>
  )
}

