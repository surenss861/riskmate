/**
 * Attachments Index Section Component
 * Renders list of all attachments/documents
 */

import { formatDate } from '@/lib/utils/reportUtils'

interface AttachmentsIndexSectionProps {
  data: {
    documents: Array<{
      id: string
      name: string
      type: string
      createdAt?: string | null
    }>
    count: number
  }
  empty?: boolean
  emptyMessage?: string
}

export function AttachmentsIndexSection({
  data,
  empty,
  emptyMessage,
}: AttachmentsIndexSectionProps) {
  if (empty || data.count === 0) {
    return (
      <div className="page">
        <h2 className="section-header">Attachments</h2>
        <p className="empty-state">{emptyMessage || 'No attachments'}</p>
      </div>
    )
  }

  return (
    <div className="page">
      <h2 className="section-header">Attachments</h2>
      <table className="audit-table">
        <thead>
          <tr>
            <th>Document Name</th>
            <th>Type</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {data.documents.map((doc, idx) => (
            <tr key={doc.id} className={idx % 2 === 0 ? 'even-row' : ''}>
              <td>{doc.name || 'Untitled'}</td>
              <td>{doc.type || 'N/A'}</td>
              <td>{doc.createdAt ? formatDate(doc.createdAt) : 'N/A'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

