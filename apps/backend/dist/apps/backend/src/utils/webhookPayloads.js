"use strict";
/**
 * Canonical webhook payload schemas per event type.
 * Must stay in sync with app lib/webhooks/payloads.ts so consumers
 * receive a stable data.object contract regardless of producer (web vs backend).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildWebhookEventObject = buildWebhookEventObject;
const REPORT_GENERATED_REQUIRED = ['report_run_id', 'job_id', 'status', 'data_hash'];
/**
 * Build canonical data.object for report.generated.
 * Throws if required fields are missing (no silent empty strings); enqueue only after validation.
 */
function buildReportGeneratedObject(raw) {
    const report_run_id = raw.report_run_id ?? raw.id ?? '';
    const job_id = raw.job_id ?? '';
    const packet_type = raw.packet_type;
    const status = raw.status ?? '';
    const data_hash = raw.data_hash ?? raw.hash ?? '';
    const storage_path = raw.storage_path ?? null;
    const generated_at = raw.generated_at ?? new Date().toISOString();
    const generated_by = raw.generated_by ?? null;
    const id = raw.id ?? report_run_id;
    for (const key of REPORT_GENERATED_REQUIRED) {
        const value = key === 'report_run_id' ? report_run_id : key === 'job_id' ? job_id : key === 'status' ? status : data_hash;
        if (value === undefined || value === null || String(value).trim() === '') {
            throw new Error(`report.generated missing required field: ${key}`);
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
    };
}
/**
 * Build canonical data.object for evidence.uploaded.
 */
function buildEvidenceUploadedObject(raw) {
    const id = raw.id ?? raw.document_id ?? '';
    const job_id = raw.job_id ?? '';
    const name = raw.name ?? raw.file_name ?? '';
    const type = raw.type ?? '';
    const file_path = raw.file_path ?? raw.storage_path ?? '';
    const uploaded_by = raw.uploaded_by ?? '';
    const created_at = raw.created_at ?? new Date().toISOString();
    const out = {
        id,
        job_id,
        name,
        type,
        file_path,
        uploaded_by,
        created_at,
    };
    if (raw.evidence_id != null)
        out.evidence_id = raw.evidence_id;
    if (raw.file_sha256 != null)
        out.file_sha256 = raw.file_sha256;
    if (raw.file_size != null)
        out.file_size = raw.file_size;
    if (raw.mime_type != null)
        out.mime_type = raw.mime_type;
    if (raw.phase != null)
        out.phase = raw.phase;
    if (raw.evidence_type != null)
        out.evidence_type = raw.evidence_type;
    if (raw.sealed_at != null)
        out.sealed_at = raw.sealed_at;
    if (raw.document_id && raw.document_id !== id)
        out.document_id = raw.document_id;
    return out;
}
/**
 * Build canonical data.object for signature.added.
 */
function buildSignatureAddedObject(raw) {
    const signoff_id = raw.signoff_id ?? raw.id ?? '';
    const job_id = raw.job_id ?? '';
    const signer_id = raw.signer_id ?? '';
    const signoff_type = raw.signoff_type ?? '';
    const created_at = raw.created_at ?? raw.signed_at ?? new Date().toISOString();
    const signer_role = raw.signer_role ?? null;
    const signed_at = raw.signed_at ?? null;
    const id = raw.id ?? signoff_id;
    return {
        signoff_id,
        job_id,
        signer_id,
        signoff_type,
        created_at,
        ...(signer_role != null && { signer_role }),
        ...(signed_at != null && { signed_at }),
        id,
    };
}
/**
 * Return normalized data.object for the given event type.
 * For event types without a canonical schema, returns raw data unchanged.
 */
function buildWebhookEventObject(eventType, raw) {
    switch (eventType) {
        case 'report.generated':
            return buildReportGeneratedObject(raw);
        case 'evidence.uploaded':
            return buildEvidenceUploadedObject(raw);
        case 'signature.added':
            return buildSignatureAddedObject(raw);
        default:
            return raw;
    }
}
//# sourceMappingURL=webhookPayloads.js.map