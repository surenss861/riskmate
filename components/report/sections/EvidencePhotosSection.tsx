/**
 * Evidence Photos Section Component
 * Renders photo grid with captions
 */

import { formatDate } from '@/lib/utils/reportUtils'

interface EvidencePhotosSectionProps {
  data: {
    photos: Array<{
      id: string
      name: string
      url?: string | null
      createdAt?: string | null
    }>
    count: number
  }
  empty?: boolean
  emptyMessage?: string
}

export function EvidencePhotosSection({ data, empty, emptyMessage }: EvidencePhotosSectionProps) {
  if (empty || data.count === 0) {
    return (
      <div className="page">
        <h2 className="section-header">Evidence Photos</h2>
        <p className="empty-state">{emptyMessage || 'No photos attached'}</p>
      </div>
    )
  }

  return (
    <div className="page">
      <h2 className="section-header">Evidence Photos</h2>
      <div className="photos-grid">
        {data.photos.map((photo) => (
          <div key={photo.id} className="photo-item">
            {photo.url && (
              <img src={photo.url} alt={photo.name || 'Evidence photo'} className="photo-image" />
            )}
            <div className="photo-caption">
              <div className="photo-name">{photo.name || 'Untitled'}</div>
              {photo.createdAt && (
                <div className="photo-date">{formatDate(photo.createdAt)}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

