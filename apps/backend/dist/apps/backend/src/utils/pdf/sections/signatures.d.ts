/** Signature data for PDF rendering (run's report_signatures) */
export interface PdfSignatureData {
    signer_name: string;
    signer_title: string;
    signature_role: 'prepared_by' | 'reviewed_by' | 'approved_by' | 'other';
    signature_svg: string;
    signed_at: string;
    signature_hash?: string | null;
}
/**
 * Renders Signatures & Compliance section.
 * When signatures array is provided, maps by role and renders each signature's SVG path(s),
 * signer name/title, signed_at, and signature_hash. Placeholders only for missing roles.
 */
export declare function renderSignaturesAndCompliance(doc: PDFKit.PDFDocument, pageWidth: number, pageHeight: number, margin: number, safeAddPage: (estimatedPages?: number) => void, estimatedTotalPages: number, signatures?: PdfSignatureData[]): void;
//# sourceMappingURL=signatures.d.ts.map