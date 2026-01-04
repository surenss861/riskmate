/**
 * Role Assignment Record Section Component
 * Renders history of role assignments and changes
 */

import { EmptySection } from './EmptySection'
import { pdfTheme } from '@/lib/design-system/pdfTheme'
import { formatDate } from '@/lib/utils/reportUtils'

interface RoleAssignmentRecordSectionProps {
  data: {
    assignments?: Array<{
      id: string
      timestamp: string
      user: string
      role: string
      assignedBy: string
      reason?: string
    }>
    count?: number
  }
  empty?: boolean
  emptyMessage?: string
}

export function RoleAssignmentRecordSection({ data, empty, emptyMessage }: RoleAssignmentRecordSectionProps) {
  const assignments = data.assignments || []
  const count = data.count ?? assignments.length

  if (empty || count === 0) {
    return (
      <div className="page">
        <EmptySection
          title="Role Assignment Record"
          description={emptyMessage || "No role assignment history recorded for this job."}
          whatThisProves="Documents who had access to this job and when, establishing accountability and access governance."
          howToSatisfy="Role assignments are managed at the organization level. Review organization settings to assign roles."
        />
      </div>
    )
  }

  return (
    <div className="page">
      <h2 className="section-header">Role Assignment Record</h2>
      <div style={{ marginBottom: '16pt', fontSize: '10pt', color: pdfTheme.colors.muted }}>
        Complete history of role assignments and access changes related to this job.
        All assignments are timestamped and immutable.
      </div>
      <table className="audit-table">
        <thead>
          <tr>
            <th style={{ width: '20%' }}>Timestamp</th>
            <th style={{ width: '25%' }}>User</th>
            <th style={{ width: '20%' }}>Role</th>
            <th style={{ width: '20%' }}>Assigned By</th>
            <th style={{ width: '15%' }}>Reason</th>
          </tr>
        </thead>
        <tbody>
          {assignments.map((assignment, idx) => (
            <tr key={assignment.id} className={idx % 2 === 0 ? 'even-row' : ''}>
              <td style={{ fontFamily: 'monospace', fontSize: '9pt' }}>
                {formatDate(assignment.timestamp)}
              </td>
              <td>{assignment.user || 'Unknown'}</td>
              <td>{assignment.role || 'Unknown'}</td>
              <td>{assignment.assignedBy || 'System'}</td>
              <td style={{ fontSize: '9pt', color: pdfTheme.colors.muted }}>
                {assignment.reason || '—'}
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
        <strong>Total:</strong> {count} assignment{count !== 1 ? 's' : ''} recorded • 
        Provides complete access governance trail
      </div>
    </div>
  )
}

