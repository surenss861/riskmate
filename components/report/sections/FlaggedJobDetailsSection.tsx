/**
 * Flagged Job Details Section Component
 * Renders details of jobs flagged for review
 */

import { EmptySection } from './EmptySection'
import { pdfTheme } from '@/lib/design-system/pdfTheme'
import { formatDate } from '@/lib/utils/reportUtils'

interface FlaggedJobDetailsSectionProps {
  data: {
    flags?: Array<{
      id: string
      timestamp: string
      flaggedBy: string
      reason: string
      status: string
      resolvedAt?: string
    }>
    count?: number
  }
  empty?: boolean
  emptyMessage?: string
}

export function FlaggedJobDetailsSection({ data, empty, emptyMessage }: FlaggedJobDetailsSectionProps) {
  const flags = data.flags || []
  const count = data.count ?? flags.length

  if (empty || count === 0) {
    return (
      <div className="page">
        <EmptySection
          title="Flagged Job Details"
          description={emptyMessage || "This job has not been flagged for review."}
          whatThisProves="Documents when and why this job was flagged for safety lead review, establishing escalation protocol and oversight."
          howToSatisfy="Jobs are flagged when they require safety lead review. Flags are set by Safety Leads, Admins, or Owners when risk levels warrant oversight."
        />
      </div>
    )
  }

  return (
    <div className="page">
      <h2 className="section-header">Flagged Job Details</h2>
      <div style={{ marginBottom: '16pt', fontSize: '10pt', color: pdfTheme.colors.muted }}>
        Complete record of flags and review requests for this job.
        All flags are timestamped and immutable.
      </div>
      <table className="audit-table">
        <thead>
          <tr>
            <th style={{ width: '18%' }}>Flagged At</th>
            <th style={{ width: '20%' }}>Flagged By</th>
            <th style={{ width: '30%' }}>Reason</th>
            <th style={{ width: '15%' }}>Status</th>
            <th style={{ width: '17%' }}>Resolved At</th>
          </tr>
        </thead>
        <tbody>
          {flags.map((flag, idx) => (
            <tr key={flag.id} className={idx % 2 === 0 ? 'even-row' : ''}>
              <td style={{ fontFamily: 'monospace', fontSize: '9pt' }}>
                {formatDate(flag.timestamp)}
              </td>
              <td>{flag.flaggedBy || 'System'}</td>
              <td>{flag.reason || 'No reason provided'}</td>
              <td>{flag.status || 'Unknown'}</td>
              <td style={{ fontFamily: 'monospace', fontSize: '9pt', color: pdfTheme.colors.muted }}>
                {flag.resolvedAt ? formatDate(flag.resolvedAt) : '—'}
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
        <strong>Total:</strong> {count} flag{count !== 1 ? 's' : ''} recorded • 
        Demonstrates proactive risk escalation and oversight
      </div>
    </div>
  )
}

