/**
 * Canonical webhook payload schemas per event type.
 * All emitters (app/api and backend) must use these builders so consumers
 * receive a stable data.object contract regardless of producer.
 */

export type WebhookEventObjectEventType =
  | 'report.generated'
  | 'evidence.uploaded'
  | 'signature.added'

/** Canonical report.generated data.object */
export interface ReportGeneratedObject {
  report_run_id: string
  job_id: string
  packet_type?: string
  status: string
  data_hash: string
  storage_path?: string | null
  generated_at: string
  generated_by?: string | null
  /** @deprecated Use report_run_id */
  id?: string
}

/** Canonical evidence.uploaded data.object */
export interface EvidenceUploadedObject {
  id: string
  job_id: string
  name: string
  type: string
  file_path: string
  uploaded_by: string
  created_at: string
  /** Optional: evidence_id from backend evidence table */
  evidence_id?: string | null
  file_sha256?: string | null
  file_size?: number | null
  mime_type?: string | null
  phase?: string | null
  evidence_type?: string | null
  sealed_at?: string | null
  /** @deprecated Use id */
  document_id?: string
}

/** Canonical signature.added data.object */
export interface SignatureAddedObject {
  signoff_id: string
  job_id: string
  signer_id: string
  signoff_type: string
  created_at: string
  signer_role?: string | null
  signed_at?: string | null
  /** @deprecated Use signoff_id */
  id?: string
}

export type WebhookEventObject =
  | ReportGeneratedObject
  | EvidenceUploadedObject
  | SignatureAddedObject

/**
 * Build canonical data.object for report.generated.
 * Accepts app shape (report_run_id, ...) or backend shape (id, storage_path, hash, ...).
 */
export function buildReportGeneratedObject(raw: Record<string, unknown>): ReportGeneratedObject {
  const report_run_id =
    (raw.report_run_id as string) ?? (raw.id as string) ?? ''
  const job_id = (raw.job_id as string) ?? ''
  const packet_type = raw.packet_type as string | undefined
  const status = (raw.status as string) ?? ''
  const data_hash = (raw.data_hash as string) ?? (raw.hash as string) ?? ''
  const storage_path = (raw.storage_path as string | null) ?? null
  const generated_at =
    (raw.generated_at as string) ?? new Date().toISOString()
  const generated_by = (raw.generated_by as string | null) ?? null
  const id = (raw.id as string) ?? report_run_id

  return {
    report_run_id,
    job_id,
    ...(packet_type != null && { packet_type }),
    status,
    data_hash,
    ...(storage_path != null && { storage_path }),
    generated_at,
    ...(generated_by != null && { generated_by }),
    id,
  }
}

/**
 * Build canonical data.object for evidence.uploaded.
 * Accepts app shape (document_id, ...) or backend shape (id, evidence_id, file_name, storage_path, ...).
 */
export function buildEvidenceUploadedObject(raw: Record<string, unknown>): EvidenceUploadedObject {
  const id = (raw.id as string) ?? (raw.document_id as string) ?? ''
  const job_id = (raw.job_id as string) ?? ''
  const name = (raw.name as string) ?? (raw.file_name as string) ?? ''
  const type = (raw.type as string) ?? ''
  const file_path = (raw.file_path as string) ?? (raw.storage_path as string) ?? ''
  const uploaded_by = (raw.uploaded_by as string) ?? ''
  const created_at = (raw.created_at as string) ?? new Date().toISOString()

  const out: EvidenceUploadedObject = {
    id,
    job_id,
    name,
    type,
    file_path,
    uploaded_by,
    created_at,
  }
  if (raw.evidence_id != null) out.evidence_id = raw.evidence_id as string
  if (raw.file_sha256 != null) out.file_sha256 = raw.file_sha256 as string
  if (raw.file_size != null) out.file_size = raw.file_size as number
  if (raw.mime_type != null) out.mime_type = raw.mime_type as string
  if (raw.phase != null) out.phase = raw.phase as string
  if (raw.evidence_type != null) out.evidence_type = raw.evidence_type as string
  if (raw.sealed_at != null) out.sealed_at = raw.sealed_at as string
  if ((raw.document_id as string) && (raw.document_id as string) !== id)
    out.document_id = raw.document_id as string
  return out
}

/**
 * Build canonical data.object for signature.added.
 * Accepts app shape (signoff_id, ...) or backend shape (id, signer_role, signed_at, ...).
 */
export function buildSignatureAddedObject(raw: Record<string, unknown>): SignatureAddedObject {
  const signoff_id = (raw.signoff_id as string) ?? (raw.id as string) ?? ''
  const job_id = (raw.job_id as string) ?? ''
  const signer_id = (raw.signer_id as string) ?? ''
  const signoff_type = (raw.signoff_type as string) ?? ''
  const created_at =
    (raw.created_at as string) ?? (raw.signed_at as string) ?? new Date().toISOString()
  const signer_role = (raw.signer_role as string | null) ?? null
  const signed_at = (raw.signed_at as string | null) ?? null
  const id = (raw.id as string) ?? signoff_id

  return {
    signoff_id,
    job_id,
    signer_id,
    signoff_type,
    created_at,
    ...(signer_role != null && { signer_role }),
    ...(signed_at != null && { signed_at }),
    id,
  }
}

/**
 * Return normalized data.object for the given event type.
 * For event types without a canonical schema, returns raw data unchanged.
 */
export function buildWebhookEventObject(
  eventType: string,
  raw: Record<string, unknown>
): Record<string, unknown> {
  switch (eventType) {
    case 'report.generated':
      return buildReportGeneratedObject(raw) as unknown as Record<string, unknown>
    case 'evidence.uploaded':
      return buildEvidenceUploadedObject(raw) as unknown as Record<string, unknown>
    case 'signature.added':
      return buildSignatureAddedObject(raw) as unknown as Record<string, unknown>
    default:
      return raw
  }
}
