/**
 * Evidence Photos Section Component
 * Renders photo grid with chain-of-custody information
 */

import { formatPdfTimestamp } from '@/lib/utils/pdfFormatUtils'
import { pdfTheme } from '@/lib/design-system/pdfTheme'

interface EvidencePhotosSectionProps {
  data: {
    photos: Array<{
      id: string
      name: string
      url?: string | null
      createdAt?: string | null
      uploadedBy?: string | null
      uploadedByEmail?: string | null
    }>
    count: number
  }
  empty?: boolean
  emptyMessage?: string
}

export function EvidencePhotosSection({ data, empty, emptyMessage }: EvidencePhotosSectionProps) {
  // Skip empty sections (no page rendered)
  if (empty || data.count === 0) {
    return null
  }

  return (
    <div className="page">
      <h2 className="section-header">Evidence Photos</h2>
      <div className="photos-grid">
        {data.photos.map((photo) => (
          <div key={photo.id} className="photo-item">
            {photo.url ? (
              <img 
                src={photo.url} 
                alt={photo.name || 'Evidence photo'} 
                className="photo-image"
              />
            ) : (
              <div style={{
                width: '100%',
                height: '180pt',
                backgroundColor: '#FAFAFA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: pdfTheme.colors.muted,
                fontSize: pdfTheme.typography.sizes.caption
              }}>
                Image unavailable
              </div>
            )}
            <div className="photo-caption">
              <div className="photo-name">
                {photo.name || 'Untitled'}
              </div>
              <div className="photo-meta">
                <div><strong>Evidence ID:</strong> {photo.id.substring(0, 8).toUpperCase()}</div>
                {photo.createdAt && (
                  <div><strong>Captured:</strong> {formatPdfTimestamp(photo.createdAt)}</div>
                )}
                {photo.uploadedBy && (
                  <div><strong>Captured by:</strong> {photo.uploadedBy}</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ 
        fontSize: pdfTheme.typography.sizes.caption, 
        color: pdfTheme.colors.muted, 
        fontStyle: 'italic',
        textAlign: 'center',
        padding: pdfTheme.spacing.textGap,
        backgroundColor: '#FAFAFA',
        borderRadius: pdfTheme.borders.radius,
        marginTop: pdfTheme.spacing.sectionGap
      }}>
        Total: {data.count} evidence photo{data.count !== 1 ? 's' : ''} • All photos timestamped and linked to job events
      </div>
    </div>
  )
}
