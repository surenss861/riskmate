/**
 * Compliance Status Section Component
 * Renders compliance status summary
 */

interface ComplianceStatusSectionProps {
  data: {
    status: string
    riskLevel: string
    controlsComplete: boolean
    hasAttestations: boolean
  }
}

export function ComplianceStatusSection({ data }: ComplianceStatusSectionProps) {
  return (
    <div className="page">
      <h2 className="section-header">Compliance Status</h2>
      <div className="compliance-summary">
        <div className="compliance-item">
          <strong>Job Status:</strong> {data.status}
        </div>
        <div className="compliance-item">
          <strong>Risk Level:</strong> {data.riskLevel.toUpperCase()}
        </div>
        <div className="compliance-item">
          <strong>Controls Complete:</strong> {data.controlsComplete ? 'Yes' : 'No'}
        </div>
        <div className="compliance-item">
          <strong>Attestations:</strong> {data.hasAttestations ? 'Yes' : 'No'}
        </div>
      </div>
    </div>
  )
}

