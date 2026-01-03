/**
 * Audit Timeline Section Component
 * Renders chronological audit events
 */

import { formatDate } from '@/lib/utils/reportUtils'

interface AuditTimelineSectionProps {
  data: {
    events: Array<{
      id: string
      eventType: string
      userName?: string | null
      createdAt: string
      metadata?: any
    }>
    count: number
  }
  empty?: boolean
  emptyMessage?: string
}

function formatEventName(eventType: string): string {
  // Convert event_name to readable format
  return eventType
    .replace(/\./g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
}

export function AuditTimelineSection({ data, empty, emptyMessage }: AuditTimelineSectionProps) {
  // Skip empty sections (no page rendered)
  if (empty || data.count === 0) {
    return null
  }

  return (
    <div className="page">
      <h2 className="section-header">Audit Timeline</h2>
      <div style={{ marginBottom: '16pt', fontSize: '10pt', color: '#666' }}>
        Chronological record of all events and actions related to this job. 
        All events are timestamped and immutable.
      </div>
      <table className="audit-table">
        <thead>
          <tr>
            <th style={{ width: '20%' }}>Timestamp</th>
            <th style={{ width: '30%' }}>Event</th>
            <th style={{ width: '25%' }}>Actor</th>
            <th style={{ width: '25%' }}>Details</th>
          </tr>
        </thead>
        <tbody>
          {data.events.map((event, idx) => (
            <tr key={event.id} className={idx % 2 === 0 ? 'even-row' : ''}>
              <td style={{ fontFamily: 'monospace', fontSize: '9pt' }}>
                {formatDate(event.createdAt)}
              </td>
              <td>{formatEventName(event.eventType)}</td>
              <td>{event.userName || 'System'}</td>
              <td style={{ fontSize: '9pt', color: '#666' }}>
                {event.metadata?.name || event.metadata?.description || '—'}
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
        color: '#666'
      }}>
        <strong>Total:</strong> {data.count} event{data.count !== 1 ? 's' : ''} recorded • 
        Timeline provides complete chain of custody for this job
      </div>
    </div>
  )
}

