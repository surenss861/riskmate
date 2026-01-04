/**
 * Requirements vs Evidence Matrix Section Component
 * Shows what's required vs what's present for defensibility
 */

import { pdfTheme } from '@/lib/design-system/pdfTheme'

interface RequirementsEvidenceMatrixSectionProps {
  data: {
    requirements: Array<{
      category: string
      item: string
      required: boolean
      present: boolean
      evidenceId?: string | null
      completedBy?: string | null
      completedAt?: string | null
      impact?: string | null
      owner?: string | null
    }>
  }
  empty?: boolean
  emptyMessage?: string
}

export function RequirementsEvidenceMatrixSection({
  data,
  empty,
  emptyMessage,
}: RequirementsEvidenceMatrixSectionProps) {
  // Skip empty sections (no page rendered)
  if (empty || !data.requirements || data.requirements.length === 0) {
    return null
  }

  return (
    <div className="page">
      <h2 className="section-header">Requirements vs Evidence Matrix</h2>
      
      <p style={{ 
        fontSize: pdfTheme.typography.sizes.body,
        color: pdfTheme.colors.muted,
        marginBottom: pdfTheme.spacing.sectionGap,
        lineHeight: pdfTheme.typography.lineHeight.relaxed
      }}>
        This matrix shows required proof items versus provided evidence for defensibility verification.
      </p>
      
      <table className="pdf-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Requirement</th>
            <th>Required</th>
            <th>Present</th>
            <th>Evidence ID</th>
            <th>Completed By</th>
            <th>Completed At</th>
          </tr>
        </thead>
        <tbody>
          {data.requirements.map((req, idx) => (
            <tr key={idx}>
              <td style={{ textTransform: 'capitalize' }}>
                {req.category}
              </td>
              <td style={{ fontWeight: pdfTheme.typography.weights.semibold }}>
                {req.item}
              </td>
              <td style={{ textAlign: 'center' }}>
                {req.required ? (
                  <span style={{ color: pdfTheme.colors.accent, fontWeight: pdfTheme.typography.weights.bold }}>Yes</span>
                ) : (
                  <span style={{ color: pdfTheme.colors.muted }}>No</span>
                )}
              </td>
              <td style={{ textAlign: 'center' }}>
                {req.present ? (
                  <span style={{ color: '#16a34a', fontWeight: pdfTheme.typography.weights.bold }}>✓ Yes</span>
                ) : (
                  <span style={{ color: '#dc2626', fontWeight: pdfTheme.typography.weights.bold }}>✗ No</span>
                )}
              </td>
              <td style={{ 
                fontFamily: 'monospace', 
                fontSize: pdfTheme.typography.sizes.caption,
                color: req.evidenceId ? pdfTheme.colors.muted : pdfTheme.colors.muted
              }}>
                {req.evidenceId ? req.evidenceId.substring(0, 8).toUpperCase() : '—'}
              </td>
              <td>
                {req.completedBy || '—'}
              </td>
              <td>
                {req.completedAt || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {/* Summary */}
      <div style={{ 
        marginTop: pdfTheme.spacing.sectionGap,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: pdfTheme.spacing.gridGap
      }}>
        <div className="column-card" style={{ textAlign: 'center' }}>
          <div style={{ 
            fontSize: pdfTheme.typography.sizes.h2,
            fontWeight: pdfTheme.typography.weights.bold,
            color: pdfTheme.colors.ink,
            marginBottom: '4pt'
          }}>
            {data.requirements.filter(r => r.required).length}
          </div>
          <div style={{ 
            fontSize: pdfTheme.typography.sizes.caption,
            color: pdfTheme.colors.muted,
            textTransform: 'uppercase'
          }}>
            Required Items
          </div>
        </div>
        
        <div className="column-card" style={{ textAlign: 'center' }}>
          <div style={{ 
            fontSize: pdfTheme.typography.sizes.h2,
            fontWeight: pdfTheme.typography.weights.bold,
            color: '#16a34a',
            marginBottom: '4pt'
          }}>
            {data.requirements.filter(r => r.required && r.present).length}
          </div>
          <div style={{ 
            fontSize: pdfTheme.typography.sizes.caption,
            color: pdfTheme.colors.muted,
            textTransform: 'uppercase'
          }}>
            Present
          </div>
        </div>
        
        <div className="column-card" style={{ textAlign: 'center' }}>
          <div style={{ 
            fontSize: pdfTheme.typography.sizes.h2,
            fontWeight: pdfTheme.typography.weights.bold,
            color: '#dc2626',
            marginBottom: '4pt'
          }}>
            {data.requirements.filter(r => r.required && !r.present).length}
          </div>
          <div style={{ 
            fontSize: pdfTheme.typography.sizes.caption,
            color: pdfTheme.colors.muted,
            textTransform: 'uppercase'
          }}>
            Missing
          </div>
        </div>
      </div>
    </div>
  )
}
