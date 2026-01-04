/**
 * Capability Violations Section Component
 * Renders record of unauthorized action attempts
 */

import { EmptySection } from './EmptySection'
import { pdfTheme } from '@/lib/design-system/pdfTheme'
import { formatDate } from '@/lib/utils/reportUtils'

interface CapabilityViolationsSectionProps {
  data: {
    violations?: Array<{
      id: string
      timestamp: string
      actor: string
      action: string
      role: string
      reason: string
    }>
    count?: number
  }
  empty?: boolean
  emptyMessage?: string
}

export function CapabilityViolationsSection({ data, empty, emptyMessage }: CapabilityViolationsSectionProps) {
  const violations = data.violations || []
  const count = data.count ?? violations.length

  if (empty || count === 0) {
    return (
      <div className="page">
        <EmptySection
          title="Capability Violations"
          description={emptyMessage || "No unauthorized action attempts recorded for this job."}
          whatThisProves="Demonstrates that role-based access control is actively enforced and unauthorized actions are blocked."
          howToSatisfy="Capability violations occur automatically when users attempt actions outside their role permissions. No action required unless violations indicate policy gaps."
        />
      </div>
    )
  }

  return (
    <div className="page">
      <h2 className="section-header">Capability Violations</h2>
      <div style={{ marginBottom: '16pt', fontSize: '10pt', color: pdfTheme.colors.muted }}>
        Record of all unauthorized action attempts blocked by role-based access control.
        All violations are timestamped and immutable.
      </div>
      <table className="audit-table">
        <thead>
          <tr>
            <th style={{ width: '20%' }}>Timestamp</th>
            <th style={{ width: '20%' }}>Actor</th>
            <th style={{ width: '20%' }}>Role</th>
            <th style={{ width: '25%' }}>Action Blocked</th>
            <th style={{ width: '15%' }}>Reason</th>
          </tr>
        </thead>
        <tbody>
          {violations.map((violation, idx) => (
            <tr key={violation.id} className={idx % 2 === 0 ? 'even-row' : ''}>
              <td style={{ fontFamily: 'monospace', fontSize: '9pt' }}>
                {formatDate(violation.timestamp)}
              </td>
              <td>{violation.actor || 'System'}</td>
              <td>{violation.role || 'Unknown'}</td>
              <td>{violation.action || 'Unknown Action'}</td>
              <td style={{ fontSize: '9pt', color: pdfTheme.colors.muted }}>
                {violation.reason || 'Insufficient permissions'}
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
        <strong>Total:</strong> {count} violation{count !== 1 ? 's' : ''} recorded • 
        Demonstrates active enforcement of role-based access control
      </div>
    </div>
  )
}

