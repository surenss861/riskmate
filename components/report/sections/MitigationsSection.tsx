/**
 * Mitigations/Controls Section Component
 * Renders controls applied table with completion status
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
  // Skip empty sections (no page rendered)
  if (empty) {
    return null
  }

  const completionPercent = data.total > 0 
    ? Math.round((data.completed / data.total) * 100) 
    : 0

  return (
    <div className="page">
      <h2 className="section-header">Controls Applied</h2>
      
      {/* Summary Card */}
      <div className="column-card" style={{ marginBottom: '24pt' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12pt' }}>
          <h3 className="card-title" style={{ margin: 0 }}>Completion Status</h3>
          <div style={{ fontSize: '18pt', fontWeight: 'bold', color: completionPercent === 100 ? '#16a34a' : '#ca8a04' }}>
            {completionPercent}%
          </div>
        </div>
        <div style={{ 
          width: '100%', 
          height: '8pt', 
          backgroundColor: '#e0e0e0', 
          borderRadius: '4pt',
          overflow: 'hidden'
        }}>
          <div style={{ 
            width: `${completionPercent}%`, 
            height: '100%', 
            backgroundColor: completionPercent === 100 ? '#16a34a' : '#ca8a04',
            transition: 'width 0.3s'
          }} />
        </div>
        <div style={{ marginTop: '8pt', fontSize: '10pt', color: '#666' }}>
          {data.completed} of {data.total} controls completed
        </div>
      </div>

      {/* Controls Table */}
      <table className="audit-table">
        <thead>
          <tr>
            <th style={{ width: '5%' }}>Status</th>
            <th style={{ width: '45%' }}>Control</th>
            <th style={{ width: '25%' }}>Completed</th>
            <th style={{ width: '25%' }}>Notes</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, idx) => (
            <tr key={item.id} className={idx % 2 === 0 ? 'even-row' : ''}>
              <td style={{ textAlign: 'center' }}>
                {item.completed ? (
                  <span style={{ color: '#16a34a', fontSize: '14pt' }}>✓</span>
                ) : (
                  <span style={{ color: '#ca8a04', fontSize: '14pt' }}>○</span>
                )}
              </td>
              <td style={{ fontWeight: '600' }}>{item.title || 'Untitled Control'}</td>
              <td>
                {item.completedAt ? formatDate(item.completedAt) : 'Pending'}
              </td>
              <td style={{ fontSize: '10pt', color: '#666' }}>
                {item.description || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
