/**
 * Empty Section Component
 * Renders a consistent empty state for sections with no data
 */

interface EmptySectionProps {
  title: string
  description: string
  whatThisProves?: string
  howToSatisfy?: string
}

export function EmptySection({ title, description, whatThisProves, howToSatisfy }: EmptySectionProps) {
  return (
    <div className="section-empty">
      <h2 className="section-title">{title}</h2>
      <div className="section-empty-content">
        <p className="section-empty-message">{description}</p>
        {whatThisProves && (
          <div className="section-empty-note">
            <strong>What this proves:</strong> {whatThisProves}
          </div>
        )}
        {howToSatisfy && (
          <div className="section-empty-note">
            <strong>How to satisfy:</strong> {howToSatisfy}
          </div>
        )}
      </div>
    </div>
  )
}

