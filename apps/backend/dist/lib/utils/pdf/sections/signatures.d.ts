/** Signature data for PDF rendering (run's report_signatures) */
export interface PdfSignatureData {
    signer_name: string;
    signer_title: string;
    signature_role: 'prepared_by' | 'reviewed_by' | 'approved_by' | 'other';
    signature_svg: string;
    signed_at: string;
    signature_hash?: string | null;
}
/** Options for the shared Signatures & Compliance section */
export interface RenderSignaturesOptions {
    /** When set, renders "Prepared by Riskmate" and "Document ID: ..." above Crew Signatures */
    documentId?: string;
    /** When set, passed to safeAddPage(estimatedTotalPages) for footer page numbering */
    estimatedTotalPages?: number;
}
/**
 * Signatures & Compliance - shared implementation for web and backend PDF generators.
 * Renders layout, validation, SVG via drawSignatureSvgPath. Callers supply signatures
 * (e.g. from report_signatures for a run). Optional documentId shows "Prepared by Riskmate" / Document ID.
 */
export declare function renderSignaturesAndCompliance(doc: PDFKit.PDFDocument, pageWidth: number, pageHeight: number, margin: number, safeAddPage: (estimatedPages?: number) => void, signatures: PdfSignatureData[], options?: RenderSignaturesOptions): void;
//# sourceMappingURL=signatures.d.ts.map