"use strict";
/**
 * Canonical webhook payload normalization for backend (self-contained).
 * Mirrors lib/webhooks/payloads.ts so the backend does not depend on repo-root lib at runtime
 * (Node cannot resolve @/ in compiled output). Keep in sync with lib/webhooks/payloads.ts for
 * report.generated, evidence.uploaded, and signature.added.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildWebhookEventObject = buildWebhookEventObject;
const REPORT_GENERATED_REQUIRED = ['report_run_id', 'job_id', 'status', 'data_hash'];
const EVIDENCE_TYPE_KINDS = ['photo', 'document', 'other'];
const EVIDENCE_UPLOADED_REQUIRED = ['id', 'job_id', 'name', 'file_path', 'uploaded_by', 'created_at'];
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
function deriveEvidenceType(raw, mimeType) {
    const rawType = raw.type?.toLowerCase().trim();
    if (rawType === 'photo')
        return 'photo';
    if (rawType === 'evidence')
        return 'document';
    const rawEvidenceType = raw.evidence_type?.toLowerCase().trim();
    if (rawEvidenceType && EVIDENCE_TYPE_KINDS.includes(rawEvidenceType))
        return rawEvidenceType;
    if (mimeType.toLowerCase().startsWith('image/'))
        return 'photo';
    if (mimeType.toLowerCase().startsWith('application/') ||
        mimeType.toLowerCase().startsWith('video/'))
        return 'document';
    return 'other';
}
function buildEvidenceUploadedObject(raw) {
    const id = raw.id ?? raw.document_id ?? '';
    const job_id = raw.job_id ?? '';
    const name = raw.name ?? raw.file_name ?? '';
    const file_path = raw.file_path ?? raw.storage_path ?? '';
    const uploaded_by = raw.uploaded_by ?? '';
    const created_at = raw.created_at ?? new Date().toISOString();
    const mime_type = (typeof raw.mime_type === 'string' && raw.mime_type.trim()) || 'application/octet-stream';
    const evidence_type = deriveEvidenceType(raw, mime_type);
    const required = {
        id,
        job_id,
        name,
        file_path,
        uploaded_by,
        created_at,
    };
    for (const key of EVIDENCE_UPLOADED_REQUIRED) {
        const value = required[key];
        if (value === undefined || value === null || String(value).trim() === '') {
            throw new Error(`evidence.uploaded missing required field: ${key}`);
        }
    }
    const out = {
        id,
        job_id,
        name,
        mime_type,
        evidence_type,
        file_path,
        uploaded_by,
        created_at,
        type: evidence_type,
    };
    if (raw.evidence_id != null)
        out.evidence_id = raw.evidence_id;
    if (raw.file_sha256 != null)
        out.file_sha256 = raw.file_sha256;
    if (raw.file_size != null)
        out.file_size = raw.file_size;
    if (raw.phase != null)
        out.phase = raw.phase;
    if (raw.sealed_at != null)
        out.sealed_at = raw.sealed_at;
    if (raw.document_id && raw.document_id !== id)
        out.document_id = raw.document_id;
    return out;
}
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