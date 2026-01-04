/**
 * Evidence Index Section Component
 * Renders comprehensive list of all attachments/documents with chain-of-custody information
 */

import { formatPdfTimestamp } from '@/lib/utils/pdfFormatUtils'
import { pdfTheme } from '@/lib/design-system/pdfTheme'

interface AttachmentsIndexSectionProps {
  data: {
    documents: Array<{
      id: string
      name: string
      type: string
      createdAt?: string | null
      uploadedBy?: string | null
      uploadedByEmail?: string | null
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
  // Skip empty sections (no page rendered)
  if (empty || data.count === 0) {
    return null
  }

  return (
    <div className="page">
      <h2 className="section-header">Evidence Index</h2>
      
      <table className="pdf-table">
        <thead>
          <tr>
            <th>Evidence ID</th>
            <th>Document Name</th>
            <th>Type</th>
            <th>Captured At (UTC)</th>
            <th>Captured By</th>
          </tr>
        </thead>
        <tbody>
          {data.documents.map((doc, idx) => (
            <tr key={doc.id}>
              <td style={{ 
                fontFamily: 'monospace', 
                fontSize: pdfTheme.typography.sizes.caption,
                color: pdfTheme.colors.muted
              }}>
                {doc.id.substring(0, 12).toUpperCase()}...
              </td>
              <td style={{ fontWeight: pdfTheme.typography.weights.semibold }}>
                {doc.name || 'Untitled'}
              </td>
              <td style={{ textTransform: 'capitalize' }}>
                {doc.type || 'N/A'}
              </td>
              <td>
                {doc.createdAt ? formatPdfTimestamp(doc.createdAt) : 'N/A'}
              </td>
              <td>
                {doc.uploadedBy || 'Unknown'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <div style={{ 
        marginTop: pdfTheme.spacing.sectionGap,
        padding: pdfTheme.spacing.textGap,
        backgroundColor: '#FAFAFA',
        borderRadius: pdfTheme.borders.radius,
        fontSize: pdfTheme.typography.sizes.caption,
        color: pdfTheme.colors.muted,
        fontStyle: 'italic',
        textAlign: 'center'
      }}>
        Total: {data.count} evidence item{data.count !== 1 ? 's' : ''} • All items timestamped and linked to job events
      </div>
    </div>
  )
}
