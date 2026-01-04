/**
 * Checklist Completion Section Component
 * Renders checklist item completion status
 */

import { EmptySection } from './EmptySection'
import { pdfTheme } from '@/lib/design-system/pdfTheme'
import { formatDate } from '@/lib/utils/reportUtils'

interface ChecklistCompletionSectionProps {
  data: {
    items?: Array<{
      id: string
      title: string
      completed: boolean
      completedAt?: string
      completedBy?: string
    }>
    total?: number
    completed?: number
  }
  empty?: boolean
  emptyMessage?: string
}

export function ChecklistCompletionSection({ data, empty, emptyMessage }: ChecklistCompletionSectionProps) {
  const items = data.items || []
  const total = data.total ?? items.length
  const completed = data.completed ?? items.filter(i => i.completed).length
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0

  if (empty || total === 0) {
    return (
      <div className="page">
        <EmptySection
          title="Checklist Completion"
          description={emptyMessage || "No checklist items defined for this job."}
          whatThisProves="Documents completion of required checklist items, demonstrating compliance with procedures and quality standards."
          howToSatisfy="Checklist items are defined at the job type or organization level. Complete all required checklist items to satisfy this requirement."
        />
      </div>
    )
  }

  return (
    <div className="page">
      <h2 className="section-header">Checklist Completion</h2>
      <div style={{ marginBottom: '16pt', fontSize: '10pt', color: pdfTheme.colors.muted }}>
        Status of all checklist items required for job completion.
        All completions are timestamped and immutable.
      </div>
      
      {/* Summary */}
      <div style={{ 
        marginBottom: '20pt',
        padding: '14pt',
        backgroundColor: '#f9f9f9',
        borderRadius: '4pt',
        borderLeft: `4pt solid ${percent === 100 ? '#16a34a' : pdfTheme.colors.accent}`
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8pt' }}>
          <div style={{ fontSize: pdfTheme.typography.sizes.h3, fontWeight: pdfTheme.typography.weights.bold }}>
            {completed} of {total} Complete
          </div>
          <div style={{ 
            fontSize: pdfTheme.typography.sizes.h2, 
            fontWeight: pdfTheme.typography.weights.bold,
            color: percent === 100 ? '#16a34a' : pdfTheme.colors.accent
          }}>
            {percent}%
          </div>
        </div>
        <div style={{
          width: '100%',
          height: '8pt',
          backgroundColor: pdfTheme.colors.borders,
          borderRadius: '4pt',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${percent}%`,
            height: '100%',
            backgroundColor: percent === 100 ? '#16a34a' : pdfTheme.colors.accent,
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>

      {/* Checklist Items Table */}
      <table className="audit-table">
        <thead>
          <tr>
            <th style={{ width: '5%' }}>Status</th>
            <th style={{ width: '50%' }}>Item</th>
            <th style={{ width: '20%' }}>Completed By</th>
            <th style={{ width: '25%' }}>Completed At</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.id} className={idx % 2 === 0 ? 'even-row' : ''}>
              <td style={{ textAlign: 'center' }}>
                {item.completed ? (
                  <span style={{ color: '#16a34a', fontWeight: 'bold' }}>✓</span>
                ) : (
                  <span style={{ color: pdfTheme.colors.muted }}>—</span>
                )}
              </td>
              <td>{item.title || 'Unknown Item'}</td>
              <td>{item.completedBy || (item.completed ? 'System' : '—')}</td>
              <td style={{ fontFamily: 'monospace', fontSize: '9pt', color: pdfTheme.colors.muted }}>
                {item.completedAt ? formatDate(item.completedAt) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

