/**
 * Job Summary Section Component
 * Renders job details in a clean card format
 */

import { formatDate } from '@/lib/utils/reportUtils'

interface JobSummarySectionProps {
  data: {
    client: string
    location: string
    jobType: string
    status: string
    startDate?: string | null
    endDate?: string | null
    description?: string | null
  }
}

export function JobSummarySection({ data }: JobSummarySectionProps) {
  return (
    <div className="column-card">
      <h3 className="card-title">Job Details</h3>
      <div className="detail-list">
        <div className="detail-item">
          <strong>Client:</strong> {data.client}
        </div>
        <div className="detail-item">
          <strong>Location:</strong> {data.location}
        </div>
        <div className="detail-item">
          <strong>Job Type:</strong> {data.jobType}
        </div>
        <div className="detail-item">
          <strong>Duration:</strong>{' '}
          {data.startDate && data.endDate
            ? `${formatDate(data.startDate)} - ${formatDate(data.endDate)}`
            : data.startDate
            ? `Started: ${formatDate(data.startDate)}`
            : 'N/A'}
        </div>
        <div className="detail-item">
          <strong>Status:</strong> {data.status}
        </div>
        {data.description && (
          <div className="detail-item">
            <strong>Description:</strong> {data.description}
          </div>
        )}
      </div>
    </div>
  )
}

