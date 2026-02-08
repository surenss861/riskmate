export interface JobReportData {
  job: {
    id: string
    client_name: string
    client_type: string
    job_type: string
    location: string
    description?: string | null
    start_date?: string | null
    end_date?: string | null
    status: string
    risk_score: number | null
    risk_level: string | null
    created_at: string
  }
  risk_score: {
    overall_score: number
    risk_level: string
    factors: Array<{
      code: string
      name: string
      severity: string
      weight: number
    }>
  } | null
  mitigations: Array<{
    id: string
    title: string
    description: string
    done: boolean
    is_completed?: boolean
    completed_at?: string | null
    created_at?: string | null
  }>
  documents: Array<{
    id: string
    name: string
    type: string
    file_path: string
    mime_type?: string | null
    description?: string | null
    created_at: string
    uploaded_by?: string | null
    url?: string | null
    category?: 'before' | 'during' | 'after'
  }>
  audit: Array<{
    id: string
    event_name: string
    target_type: string
    target_id: string
    actor_id: string | null
    actor_name?: string | null
    actor_email?: string | null
    metadata?: Record<string, any>
    created_at: string
  }>
  organization: {
    id: string
    name: string
    logo_url?: string | null
    accent_color?: string | null
    subscription_tier?: string | null
  } | null
}

