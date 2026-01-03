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
      
      <div style={{ 
        marginTop: '32pt',
        padding: '16pt',
        backgroundColor: '#f9f9f9',
        borderRadius: '6pt',
        fontSize: '9pt',
        color: '#666',
        lineHeight: '1.6'
      }}>
        <strong>Note:</strong> Page numbers are approximate. Use the section headers to navigate.
      </div>
    </div>
  )
}

