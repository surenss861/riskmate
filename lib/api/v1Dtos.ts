/**
 * Public API v1 response DTOs and mappers.
 * Explicit field sets so schema changes in jobs, job_risk_scores, report_runs
 * do not alter external payload shape.
 */

// ---------------------------------------------------------------------------
// Job (single: GET /api/v1/jobs/[id], PATCH response, POST response)
// ---------------------------------------------------------------------------

export type V1JobDto = {
  id: string
  title: string | null
  client_name: string
  client_type: string
  job_type: string
  location: string
  description: string | null
  start_date: string | null
  end_date: string | null
  status: string
  created_at: string
  updated_at: string
  completed_at: string | null
}

const JOB_PUBLIC_FIELDS =
  'id, title, client_name, client_type, job_type, location, description, start_date, end_date, status, created_at, updated_at, completed_at' as const

export function mapJobRowToDto(row: Record<string, unknown> | null): V1JobDto | null {
  if (!row || typeof row.id !== 'string') return null
  return {
    id: row.id,
    title: row.title != null ? String(row.title) : null,
    client_name: String(row.client_name ?? ''),
    client_type: String(row.client_type ?? ''),
    job_type: String(row.job_type ?? ''),
    location: String(row.location ?? ''),
    description: row.description != null ? String(row.description) : null,
    start_date: row.start_date != null ? String(row.start_date) : null,
    end_date: row.end_date != null ? String(row.end_date) : null,
    status: String(row.status ?? 'draft'),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    completed_at: row.completed_at != null ? String(row.completed_at) : null,
  }
}

export { JOB_PUBLIC_FIELDS }

// ---------------------------------------------------------------------------
// Job list item (GET /api/v1/jobs list response items)
// ---------------------------------------------------------------------------

export type V1JobListItemDto = {
  id: string
  title: string | null
  client_name: string
  job_type: string
  location: string
  status: string
  risk_score: number | null
  risk_level: string | null
  created_at: string
  updated_at: string
}

export function mapJobListItemRowToDto(row: Record<string, unknown>): V1JobListItemDto {
  return {
    id: String(row.id),
    title: row.title != null ? String(row.title) : null,
    client_name: String(row.client_name ?? ''),
    job_type: String(row.job_type ?? ''),
    location: String(row.location ?? ''),
    status: String(row.status ?? 'draft'),
    risk_score: typeof row.risk_score === 'number' ? row.risk_score : row.risk_score != null ? Number(row.risk_score) : null,
    risk_level: row.risk_level != null ? String(row.risk_level) : null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  }
}

// ---------------------------------------------------------------------------
// Job risk score detail (nested in GET /api/v1/jobs/[id])
// ---------------------------------------------------------------------------

export type V1JobRiskScoreDetailDto = {
  id: string
  job_id: string
  overall_score: number
  risk_level: string
  factors: unknown
  calculated_at: string
}

const JOB_RISK_SCORE_PUBLIC_FIELDS =
  'id, job_id, overall_score, risk_level, factors, calculated_at' as const

export function mapJobRiskScoreRowToDto(row: Record<string, unknown> | null): V1JobRiskScoreDetailDto | null {
  if (!row || typeof row.id !== 'string') return null
  return {
    id: row.id,
    job_id: String(row.job_id),
    overall_score: Number(row.overall_score ?? 0),
    risk_level: String(row.risk_level ?? 'low'),
    factors: row.factors ?? [],
    calculated_at: String(row.calculated_at ?? ''),
  }
}

export { JOB_RISK_SCORE_PUBLIC_FIELDS }

// ---------------------------------------------------------------------------
// Report run (GET /api/v1/reports/[id])
// ---------------------------------------------------------------------------

export type V1ReportRunDto = {
  id: string
  job_id: string
  status: string
  packet_type: string | null
  generated_at: string
  data_hash: string
  pdf_path: string | null
  pdf_signed_url: string | null
  pdf_generated_at: string | null
  created_at: string
  updated_at: string
}

const REPORT_RUN_PUBLIC_FIELDS =
  'id, job_id, status, packet_type, generated_at, data_hash, pdf_path, pdf_signed_url, pdf_generated_at, created_at, updated_at' as const

export function mapReportRunRowToDto(row: Record<string, unknown> | null): V1ReportRunDto | null {
  if (!row || typeof row.id !== 'string') return null
  return {
    id: row.id,
    job_id: String(row.job_id),
    status: String(row.status ?? 'draft'),
    packet_type: row.packet_type != null ? String(row.packet_type) : null,
    generated_at: String(row.generated_at ?? ''),
    data_hash: String(row.data_hash ?? ''),
    pdf_path: row.pdf_path != null ? String(row.pdf_path) : null,
    pdf_signed_url: row.pdf_signed_url != null ? String(row.pdf_signed_url) : null,
    pdf_generated_at: row.pdf_generated_at != null ? String(row.pdf_generated_at) : null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  }
}

export { REPORT_RUN_PUBLIC_FIELDS }
