"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderSignaturesAndCompliance = renderSignaturesAndCompliance;
const signatures_1 = require("../../../../../../lib/utils/pdf/sections/signatures");
const supabaseClient_1 = require("../../../lib/supabaseClient");
async function defaultFetchSignaturesForRun(reportRunId) {
    const { data, error } = await supabaseClient_1.supabase
        .from('report_signatures')
        .select('signer_name, signer_title, signature_role, signature_svg, signed_at, signature_hash')
        .eq('report_run_id', reportRunId)
        .is('revoked_at', null)
        .order('signed_at', { ascending: true });
    if (error) {
        console.warn('Failed to fetch signatures for PDF:', error);
        return [];
    }
    if (!data?.length)
        return [];
    return data.map((row) => ({
        signer_name: row.signer_name,
        signer_title: row.signer_title,
        signature_role: row.signature_role,
        signature_svg: row.signature_svg,
        signed_at: row.signed_at,
        signature_hash: row.signature_hash,
    }));
}
/**
 * Renders Signatures & Compliance section using the shared lib implementation.
 * When reportRunId is provided, fetches signatures from report_signatures then calls the shared renderer.
 */
async function renderSignaturesAndCompliance(doc, pageWidth, pageHeight, margin, safeAddPage, estimatedTotalPages, options) {
    let signatures = [];
    if (options?.reportRunId) {
        const fetchFn = options.fetchSignaturesForRun ?? defaultFetchSignaturesForRun;
        signatures = await fetchFn(options.reportRunId);
    }
    (0, signatures_1.renderSignaturesAndCompliance)(doc, pageWidth, pageHeight, margin, safeAddPage, signatures, {
        estimatedTotalPages,
        documentId: options?.documentId,
    });
}
//# sourceMappingURL=signatures.js.map