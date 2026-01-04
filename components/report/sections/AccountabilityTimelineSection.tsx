/**
 * Accountability Timeline Section Component
 * Renders accountability and responsibility assignment history
 */

import { EmptySection } from './EmptySection'
import { pdfTheme } from '@/lib/design-system/pdfTheme'
import { formatDate } from '@/lib/utils/reportUtils'

interface AccountabilityTimelineSectionProps {
  data: {
    events?: Array<{
      id: string
      timestamp: string
      actor: string
      action: string
      responsibility: string
      outcome?: string
    }>
    count?: number
  }
  empty?: boolean
  emptyMessage?: string
}

export function AccountabilityTimelineSection({ data, empty, emptyMessage }: AccountabilityTimelineSectionProps) {
  const events = data.events || []
  const count = data.count ?? events.length

  if (empty || count === 0) {
    return (
      <div className="page">
        <EmptySection
          title="Accountability Timeline"
          description={emptyMessage || "No accountability events recorded for this job."}
          whatThisProves="Documents responsibility assignments, accountability decisions, and outcome tracking, establishing clear ownership and decision authority."
          howToSatisfy="Accountability events are recorded when responsibilities are assigned or outcomes are tracked. Review job assignments and completion records."
        />
      </div>
    )
  }

  return (
    <div className="page">
      <h2 className="section-header">Accountability Timeline</h2>
      <div style={{ marginBottom: '16pt', fontSize: '10pt', color: pdfTheme.colors.muted }}>
        Complete record of responsibility assignments and accountability decisions.
        All events are timestamped and immutable.
      </div>
      <table className="audit-table">
        <thead>
          <tr>
            <th style={{ width: '20%' }}>Timestamp</th>
            <th style={{ width: '20%' }}>Actor</th>
            <th style={{ width: '25%' }}>Action</th>
            <th style={{ width: '20%' }}>Responsibility</th>
            <th style={{ width: '15%' }}>Outcome</th>
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
              <td>{event.responsibility || '—'}</td>
              <td style={{ fontSize: '9pt', color: pdfTheme.colors.muted }}>
                {event.outcome || '—'}
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
        Establishes clear ownership and decision authority
      </div>
    </div>
  )
}

