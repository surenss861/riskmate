/**
 * Table of Contents Section Component
 * Renders TOC after cover page
 */

interface TableOfContentsSectionProps {
  data: {
    sections: Array<{
      title: string
      page?: number
    }>
  }
}

export function TableOfContentsSection({ data }: TableOfContentsSectionProps) {
  return (
    <div className="page">
      <h2 className="section-header">Table of Contents</h2>
      
      <div style={{ marginTop: '32pt' }}>
        {data.sections.map((section, idx) => (
          <div 
            key={idx}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8pt 0',
              borderBottom: '0.5pt solid #e0e0e0',
              fontSize: '11pt',
            }}
          >
            <span style={{ color: '#333' }}>{section.title}</span>
            <span style={{ color: '#666', fontFamily: 'monospace' }}>
              {section.page !== undefined ? section.page : '...'}
            </span>
          </div>
        ))}
      </div>
      
    </div>
  )
}

