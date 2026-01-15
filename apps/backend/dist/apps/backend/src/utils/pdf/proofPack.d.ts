interface ControlRow {
    control_id?: string;
    ledger_entry_id?: string;
    ledger_event_type?: string;
    work_record_id?: string;
    site_id?: string;
    org_id?: string;
    status_at_export?: string;
    severity?: string;
    title?: string;
    owner_user_id?: string;
    owner_email?: string;
    due_date?: string;
    verification_method?: string;
    created_at?: string;
    updated_at?: string;
    [key: string]: any;
}
interface AttestationRow {
    attestation_id?: string;
    ledger_entry_id?: string;
    ledger_event_type?: string;
    work_record_id?: string;
    site_id?: string;
    org_id?: string;
    status_at_export?: string;
    title?: string;
    description?: string;
    attested_by_user_id?: string;
    attested_by_email?: string;
    attested_at?: string;
    created_at?: string;
    [key: string]: any;
}
interface ProofPackMeta {
    packId: string;
    organizationName: string;
    generatedBy: string;
    generatedByRole: string;
    generatedAt: string;
    timeRange: string;
}
/**
 * Generate Controls PDF from controls data
 */
export declare function generateControlsPDF(controls: ControlRow[], meta: ProofPackMeta): Promise<Buffer>;
/**
 * Generate Attestations PDF from attestations data
 */
export declare function generateAttestationsPDF(attestations: AttestationRow[], meta: ProofPackMeta): Promise<Buffer>;
/**
 * Generate Evidence Index PDF from manifest data
 */
export declare function generateEvidenceIndexPDF(manifest: any, meta: ProofPackMeta): Promise<Buffer>;
export {};
//# sourceMappingURL=proofPack.d.ts.map