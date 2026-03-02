/**
 * Canonical webhook payload schemas per event type.
 * All emitters (app/api and backend) must use these builders so consumers
 * receive a stable data.object contract regardless of producer.
 * Required-field validation ensures no malformed payloads are emitted.
 */

const REPORT_GENERATED_REQUIRED = ['report_run_id', 'job_id', 'status', 'data_hash'] as const

export type WebhookEventObjectEventType =
  | 'report.generated'
  | 'evidence.uploaded'
  | 'signature.added'

/**
 * Canonical report.generated data.object.
 * packet_type, storage_path, generated_by, snapshot_id: optional; presence depends on flow (packet-based vs legacy risk_snapshot_reports).
 */
export interface ReportGeneratedObject {
  report_run_id: string
  job_id: string
  packet_type?: string
  status: string
  data_hash: string
  storage_path?: string | null
  generated_at: string
  /** Set by both flows when available. Packet-based flow sets from user.id; legacy Express flow sets from userId. */
  generated_by?: string | null
  /** Legacy Express flow only (risk_snapshot_reports). Packet-based flow omits or sets null. */
  snapshot_id?: string | null
  /** @deprecated Use report_run_id */
  id?: string
}

/** Semantic evidence kind for evidence.uploaded; stable across web, backend, and test. */
export type EvidenceTypeKind = 'photo' | 'document' | 'other'

/** Canonical evidence.uploaded data.object. All emitters produce this shape. */
export interface EvidenceUploadedObject {
  id: string
  job_id: string
  name: string
  /** MIME type (e.g. image/jpeg, application/pdf). Always present. */
  mime_type: string
  /** Semantic kind: photo | document | other. Always present. */
  evidence_type: EvidenceTypeKind
  file_path: string
  uploaded_by: string
  created_at: string
  /** @deprecated Use evidence_type. Emitted for backward compatibility. */
  type: EvidenceTypeKind
  /** Optional: evidence_id from backend evidence table */
  evidence_id?: string | null
  file_sha256?: string | null
  file_size?: number | null
  phase?: string | null
  sealed_at?: string | null
  /** @deprecated Use id */
  document_id?: string
}

/**
 * Canonical signature.added data.object.
 * signoff_type: Canonical role/classification of the signer for this signature (e.g. 'general', 'owner', 'approved_by', 'prepared_by'). Same semantic across job signoffs and report signatures flows.
 */
export interface SignatureAddedObject {
  signoff_id: string
  job_id: string
  signer_id: string
  /** Role or classification of the signer (e.g. general, owner, approved_by, prepared_by). Consistent across all emitters. */
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
 * Throws if required fields are missing (no silent empty strings).
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
  const snapshot_id = (raw.snapshot_id as string | null) ?? null
  const id = (raw.id as string) ?? report_run_id

  for (const key of REPORT_GENERATED_REQUIRED) {
    const value = key === 'report_run_id' ? report_run_id : key === 'job_id' ? job_id : key === 'status' ? status : data_hash
    if (value === undefined || value === null || String(value).trim() === '') {
      throw new Error(`report.generated missing required field: ${key}`)
    }
  }

  return {
    report_run_id,
    job_id,
    ...(packet_type != null && { packet_type }),
    status,
    data_hash,
    ...(storage_path != null && { storage_path }),
    generated_at,
    ...(generated_by != null && { generated_by }),
    ...(snapshot_id != null && { snapshot_id }),
    id,
  }
}

const EVIDENCE_TYPE_KINDS: EvidenceTypeKind[] = ['photo', 'document', 'other']
const EVIDENCE_UPLOADED_REQUIRED = ['id', 'job_id', 'name', 'file_path', 'uploaded_by', 'created_at'] as const

function deriveEvidenceType(raw: Record<string, unknown>, mimeType: string): EvidenceTypeKind {
  const rawType = (raw.type as string)?.toLowerCase().trim()
  if (rawType === 'photo') return 'photo'
  if (rawType === 'evidence') return 'document'
  const rawEvidenceType = (raw.evidence_type as string)?.toLowerCase().trim()
  if (rawEvidenceType && EVIDENCE_TYPE_KINDS.includes(rawEvidenceType as EvidenceTypeKind))
    return rawEvidenceType as EvidenceTypeKind
  if (mimeType.toLowerCase().startsWith('image/')) return 'photo'
  if (
    mimeType.toLowerCase().startsWith('application/') ||
    mimeType.toLowerCase().startsWith('video/')
  )
    return 'document'
  return 'other'
}

/**
 * Build canonical data.object for evidence.uploaded.
 * Accepts app shape (document_id, type: photo|evidence) or backend shape (id, evidence_id, file_name, storage_path, mime_type).
 * Ensures mime_type and evidence_type are always set; missing mime_type defaults to application/octet-stream; evidence_type is derived from type or mime_type.
 * Throws if required fields are missing (no silent empty strings).
 */
export function buildEvidenceUploadedObject(raw: Record<string, unknown>): EvidenceUploadedObject {
  const id = (raw.id as string) ?? (raw.document_id as string) ?? ''
  const job_id = (raw.job_id as string) ?? ''
  const name = (raw.name as string) ?? (raw.file_name as string) ?? ''
  const file_path = (raw.file_path as string) ?? (raw.storage_path as string) ?? ''
  const uploaded_by = (raw.uploaded_by as string) ?? ''
  const created_at = (raw.created_at as string) ?? new Date().toISOString()

  const mime_type =
    (typeof raw.mime_type === 'string' && raw.mime_type.trim()) || 'application/octet-stream'
  const evidence_type = deriveEvidenceType(raw, mime_type)

  const required: Record<string, string> = {
    id,
    job_id,
    name,
    file_path,
    uploaded_by,
    created_at,
  }
  for (const key of EVIDENCE_UPLOADED_REQUIRED) {
    const value = required[key]
    if (value === undefined || value === null || String(value).trim() === '') {
      throw new Error(`evidence.uploaded missing required field: ${key}`)
    }
  }

  const out: EvidenceUploadedObject = {
    id,
    job_id,
    name,
    mime_type,
    evidence_type,
    file_path,
    uploaded_by,
    created_at,
    type: evidence_type,
  }
  if (raw.evidence_id != null) out.evidence_id = raw.evidence_id as string
  if (raw.file_sha256 != null) out.file_sha256 = raw.file_sha256 as string
  if (raw.file_size != null) out.file_size = raw.file_size as number
  if (raw.phase != null) out.phase = raw.phase as string
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
