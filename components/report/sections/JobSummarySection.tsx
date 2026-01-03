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
    <div className="page">
      <h2 className="section-header">Job Summary</h2>
      
      {/* 2-column grid layout using PDF theme */}
      <div className="pdf-grid-2">
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
              <strong>Status:</strong> <span style={{ textTransform: 'capitalize' }}>{data.status}</span>
            </div>
          </div>
        </div>

        <div className="column-card">
          <h3 className="card-title">Timeline</h3>
          <div className="detail-list">
            <div className="detail-item">
              <strong>Start Date:</strong>{' '}
              {data.startDate ? formatDate(data.startDate) : 'Not set'}
            </div>
            <div className="detail-item">
              <strong>End Date:</strong>{' '}
              {data.endDate ? formatDate(data.endDate) : 'Not set'}
            </div>
            {data.startDate && data.endDate && (
              <div className="detail-item" style={{ fontSize: '10pt', color: '#666', fontStyle: 'italic' }}>
                Duration: {Math.ceil((new Date(data.endDate).getTime() - new Date(data.startDate).getTime()) / (1000 * 60 * 60 * 24))} days
              </div>
            )}
          </div>
        </div>
      </div>

      {data.description && (
        <div className="column-card">
          <h3 className="card-title">Description</h3>
          <p style={{ fontSize: '11pt', lineHeight: '1.6', color: '#333', margin: 0 }}>
            {data.description}
          </p>
        </div>
      )}
    </div>
  )
}

