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
  // Skip empty sections (no page rendered)
  if (empty || data.count === 0) {
    return null
  }

  return (
    <div className="page">
      <h2 className="section-header">Evidence Photos</h2>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(2, 1fr)', 
        gap: '16pt',
        marginBottom: '24pt'
      }}>
        {data.photos.map((photo) => (
          <div 
            key={photo.id} 
            className="column-card"
            style={{ 
              padding: '12pt',
              breakInside: 'avoid'
            }}
          >
            {photo.url ? (
              <img 
                src={photo.url} 
                alt={photo.name || 'Evidence photo'} 
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '200pt',
                  objectFit: 'contain',
                  borderRadius: '4pt',
                  marginBottom: '8pt',
                  border: '1pt solid #e0e0e0'
                }}
              />
            ) : (
              <div style={{
                width: '100%',
                height: '150pt',
                backgroundColor: '#f5f5f5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4pt',
                marginBottom: '8pt',
                color: '#999',
                fontSize: '10pt'
              }}>
                Image unavailable
              </div>
            )}
            <div style={{ fontSize: '10pt' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4pt', color: '#111' }}>
                {photo.name || 'Untitled'}
              </div>
              {photo.createdAt && (
                <div style={{ fontSize: '9pt', color: '#666' }}>
                  {formatDate(photo.createdAt)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div style={{ 
        fontSize: '9pt', 
        color: '#666', 
        fontStyle: 'italic',
        textAlign: 'center',
        padding: '12pt',
        backgroundColor: '#f9f9f9',
        borderRadius: '4pt'
      }}>
        Total: {data.count} evidence photo{data.count !== 1 ? 's' : ''} • All photos timestamped and linked to job events
      </div>
    </div>
  )
}
