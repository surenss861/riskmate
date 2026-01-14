/**
 * Shared data contracts for proof pack generation
 * Ensures all PDFs use the same source of truth
 */

export interface PackFilters {
  time_range?: string
  start_date?: string | null
  end_date?: string | null
  job_id?: string | null
  site_id?: string | null
  category?: string | null
  actor_id?: string | null
  severity?: string | null
  outcome?: string | null
  view?: string | null
}

export interface PackStats {
  ledger_events: number
  controls: number
  controls_completed: number
  controls_pending: number
  controls_overdue: number
  controls_high_severity: number
  attestations: number
  attestations_completed: number
  attestations_pending: number
}

export interface PayloadFile {
  name: string
  sha256: string
  bytes: number
}

export interface PackContext {
  packId: string
  organizationId: string
  organizationName: string
  generatedAt: string
  generatedBy: {
    userId: string
    name: string
    email: string
    role: string
  }
  timeRange: string
  filters: PackFilters
  requestId: string
  stats: PackStats
  payloadFiles: PayloadFile[]
}

export interface LedgerEvent {
  id: string
  event_name: string
  created_at: string
  category?: string
  outcome?: string
  severity?: string
  actor_name?: string
  actor_role?: string
  job_id?: string
  job_title?: string
  target_type?: string
  summary?: string
}

export interface ControlRow {
  control_id: string
  ledger_entry_id?: string
  ledger_event_type?: string
  work_record_id?: string
  site_id?: string
  org_id?: string
  status_at_export: string
  severity: string
  title: string
  owner_user_id?: string
  owner_email?: string
  due_date?: string
  verification_method?: string
  created_at?: string
  updated_at?: string
}

export interface AttestationRow {
  attestation_id: string
  ledger_entry_id?: string
  ledger_event_type?: string
  work_record_id?: string
  site_id?: string
  org_id?: string
  status_at_export: string
  title: string
  description?: string
  attested_by_user_id?: string
  attested_by_email?: string
  attested_at?: string
  created_at?: string
}

export interface PackData {
  context: PackContext
  ledgerEvents: LedgerEvent[]
  controls: ControlRow[]
  attestations: AttestationRow[]
}
