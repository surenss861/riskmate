/**
 * Access Governance Trail Section Component
 * Renders comprehensive access and permission change history
 */

import { EmptySection } from './EmptySection'
import { pdfTheme } from '@/lib/design-system/pdfTheme'
import { formatDate } from '@/lib/utils/reportUtils'

interface AccessGovernanceTrailSectionProps {
  data: {
    events?: Array<{
      id: string
      timestamp: string
      actor: string
      action: string
      target: string
      before?: string
      after?: string
      reason?: string
    }>
    count?: number
  }
  empty?: boolean
  emptyMessage?: string
}

export function AccessGovernanceTrailSection({ data, empty, emptyMessage }: AccessGovernanceTrailSectionProps) {
  const events = data.events || []
  const count = data.count ?? events.length

  if (empty || count === 0) {
    return (
      <div className="page">
        <EmptySection
          title="Access Governance Trail"
          description={emptyMessage || "No access governance events recorded for this job."}
          whatThisProves="Documents all access control changes, permission grants/revocations, and governance decisions related to this job."
          howToSatisfy="Access governance events are automatically recorded when permissions change. Review organization settings for access management."
        />
      </div>
    )
  }

  return (
    <div className="page">
      <h2 className="section-header">Access Governance Trail</h2>
      <div style={{ marginBottom: '16pt', fontSize: '10pt', color: pdfTheme.colors.muted }}>
        Complete record of access control changes, permission grants/revocations, and governance decisions.
        All events are timestamped and immutable.
      </div>
      <table className="audit-table">
        <thead>
          <tr>
            <th style={{ width: '18%' }}>Timestamp</th>
            <th style={{ width: '18%' }}>Actor</th>
            <th style={{ width: '20%' }}>Action</th>
            <th style={{ width: '18%' }}>Target</th>
            <th style={{ width: '26%' }}>Change</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event, idx) => (
            <tr key={event.id} className={idx % 2 === 0 ? 'even-row' : ''}>
              <td style={{ fontFamily: 'monospace', fontSize: '9pt' }}>
                {formatDate(event.timestamp)}
              </td>
              <td>{event.actor || 'System'}</td>
              <td>{event.action || 'Unknown'}</td>
              <td>{event.target || 'Unknown'}</td>
              <td style={{ fontSize: '9pt', color: pdfTheme.colors.muted }}>
                {event.before && event.after ? `${event.before} → ${event.after}` : event.reason || '—'}
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
        <strong>Total:</strong> {count} event{count !== 1 ? 's' : ''} recorded • 
        Provides complete access governance accountability
      </div>
    </div>
  )
}

