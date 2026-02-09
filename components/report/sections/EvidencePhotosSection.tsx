/**
 * Evidence Photos Section Component
 * Renders photo grid with chain-of-custody information, grouped by before/during/after per spec.
 */

import { formatPdfTimestamp } from '@/lib/utils/pdfFormatUtils'
import { pdfTheme } from '@/lib/design-system/pdfTheme'
import { categorizePhotos } from '@/lib/utils/photoCategory'

type SectionPhoto = {
  id: string
  name: string
  url?: string | null
  createdAt?: string | null
  uploadedBy?: string | null
  uploadedByEmail?: string | null
  category?: 'before' | 'during' | 'after' | null
}

interface EvidencePhotosSectionProps {
  data: {
    photos: SectionPhoto[]
    count: number
    jobStartDate?: string | null
    jobEndDate?: string | null
  }
  empty?: boolean
  emptyMessage?: string
}

/** Map SectionPhoto to shape expected by shared categorizePhotos (created_at). */
function categorizeSectionPhotos(
  photos: SectionPhoto[],
  jobStartDate?: string | null,
  jobEndDate?: string | null
): { before: SectionPhoto[]; during: SectionPhoto[]; after: SectionPhoto[] } {
  const withCreatedAt = photos.map((p) => ({ ...p, created_at: p.createdAt ?? null }))
  return categorizePhotos(withCreatedAt, jobStartDate, jobEndDate)
}

function PhotoItem({ photo }: { photo: SectionPhoto }) {
  return (
    <div className="photo-item">
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
          <div style={{ fontSize: pdfTheme.typography.sizes.caption, fontFamily: 'monospace', color: pdfTheme.colors.muted }}>
            <strong>Evidence ID:</strong> {photo.id.substring(0, 12).toUpperCase()}...
          </div>
          {photo.createdAt && (
            <div><strong>Captured:</strong> {formatPdfTimestamp(photo.createdAt)} UTC</div>
          )}
          {photo.uploadedBy && (
            <div><strong>Captured by:</strong> {photo.uploadedBy}{photo.uploadedByEmail ? ` (${photo.uploadedByEmail})` : ''}</div>
          )}
        </div>
      </div>
    </div>
  )
}

export function EvidencePhotosSection({ data, empty, emptyMessage }: EvidencePhotosSectionProps) {
  // Skip empty sections (no page rendered)
  if (empty || data.count === 0) {
    return null
  }

  const { before, during, after } = categorizeSectionPhotos(
    data.photos,
    data.jobStartDate,
    data.jobEndDate
  )

  const sections = [
    { title: 'Before', badge: 'Before', photos: before },
    { title: 'During Job', badge: 'During', photos: during },
    { title: 'After', badge: 'After', photos: after },
  ] as const

  return (
    <div className="page">
      <h2 className="section-header">Evidence Photos</h2>
      {sections.map(({ title, badge, photos }) => {
        if (photos.length === 0) return null
        return (
          <div key={badge}>
            <h3 className="section-subheader" style={{ marginTop: photos.length ? pdfTheme.spacing.sectionGap : 0 }}>
              <span
                className="category-badge"
                style={{
                  display: 'inline-block',
                  padding: '4pt 8pt',
                  borderRadius: pdfTheme.borders.radius,
                  backgroundColor: badge === 'Before' ? '#E3F2FD' : badge === 'After' ? '#E8F5E9' : '#FFF3E0',
                  color: badge === 'Before' ? '#1976D2' : badge === 'After' ? '#388E3C' : '#F57C00',
                  fontWeight: 600,
                  fontSize: pdfTheme.typography.sizes.caption,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {badge}
              </span>
              {' — '}{title} ({photos.length})
            </h3>
            <div className="photos-grid">
              {photos.map((photo) => (
                <PhotoItem key={photo.id} photo={photo} />
              ))}
            </div>
          </div>
        )
      })}
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
