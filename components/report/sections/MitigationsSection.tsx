/**
 * Mitigations/Controls Section Component
 * Renders controls applied table
 */

import { formatDate } from '@/lib/utils/reportUtils'

interface MitigationsSectionProps {
  data: {
    items: Array<{
      id: string
      title: string
      description?: string | null
      completed: boolean
      completedAt?: string | null
    }>
    total: number
    completed: number
  }
  empty?: boolean
  emptyMessage?: string
}

export function MitigationsSection({ data, empty, emptyMessage }: MitigationsSectionProps) {
  if (empty) {
    return (
      <div className="page">
        <h2 className="section-header">Controls Applied</h2>
        <p className="empty-state">{emptyMessage || 'No controls applied'}</p>
      </div>
    )
  }

  return (
    <div className="page">
      <h2 className="section-header">Controls Applied</h2>
      <table className="audit-table">
        <thead>
          <tr>
            <th>Control</th>
            <th>Applied?</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, idx) => (
            <tr key={item.id} className={idx % 2 === 0 ? 'even-row' : ''}>
              <td>{item.title || 'Untitled Control'}</td>
              <td>{item.completed ? 'Yes' : 'No'}</td>
              <td>{item.description || 'None'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

