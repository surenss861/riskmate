/**
 * Canonical webhook payload schemas per event type.
 * Must stay in sync with app lib/webhooks/payloads.ts so consumers
 * receive a stable data.object contract regardless of producer (web vs backend).
 */

const REPORT_GENERATED_REQUIRED = ['report_run_id', 'job_id', 'status', 'data_hash'] as const

/**
 * Build canonical data.object for report.generated.
 * Throws if required fields are missing (no silent empty strings); enqueue only after validation.
 */
function buildReportGeneratedObject(raw: Record<string, unknown>): Record<string, unknown> {
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
    id,
  }
}

/**
 * Build canonical data.object for evidence.uploaded.
 */
function buildEvidenceUploadedObject(raw: Record<string, unknown>): Record<string, unknown> {
  const id = (raw.id as string) ?? (raw.document_id as string) ?? ''
  const job_id = (raw.job_id as string) ?? ''
  const name = (raw.name as string) ?? (raw.file_name as string) ?? ''
  const type = (raw.type as string) ?? ''
  const file_path = (raw.file_path as string) ?? (raw.storage_path as string) ?? ''
  const uploaded_by = (raw.uploaded_by as string) ?? ''
  const created_at = (raw.created_at as string) ?? new Date().toISOString()

  const out: Record<string, unknown> = {
    id,
    job_id,
    name,
    type,
    file_path,
    uploaded_by,
    created_at,
  }
  if (raw.evidence_id != null) out.evidence_id = raw.evidence_id
  if (raw.file_sha256 != null) out.file_sha256 = raw.file_sha256
  if (raw.file_size != null) out.file_size = raw.file_size
  if (raw.mime_type != null) out.mime_type = raw.mime_type
  if (raw.phase != null) out.phase = raw.phase
  if (raw.evidence_type != null) out.evidence_type = raw.evidence_type
  if (raw.sealed_at != null) out.sealed_at = raw.sealed_at
  if ((raw.document_id as string) && (raw.document_id as string) !== id)
    out.document_id = raw.document_id
  return out
}

/**
 * Build canonical data.object for signature.added.
 */
function buildSignatureAddedObject(raw: Record<string, unknown>): Record<string, unknown> {
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
      return buildReportGeneratedObject(raw)
    case 'evidence.uploaded':
      return buildEvidenceUploadedObject(raw)
    case 'signature.added':
      return buildSignatureAddedObject(raw)
    default:
      return raw
  }
}
