import { type PdfSignatureData } from '../../../../../../lib/utils/pdf/sections/signatures';
export type { PdfSignatureData };
/** Optional: inject a custom fetcher for signatures (e.g. for tests). When omitted, uses Supabase. */
export type FetchSignaturesForRun = (reportRunId: string) => Promise<PdfSignatureData[]>;
/**
 * Renders Signatures & Compliance section using the shared lib implementation.
 * When reportRunId is provided, fetches signatures from report_signatures then calls the shared renderer.
 */
export declare function renderSignaturesAndCompliance(doc: PDFKit.PDFDocument, pageWidth: number, pageHeight: number, margin: number, safeAddPage: (estimatedPages?: number) => void, estimatedTotalPages: number, options?: {
    reportRunId?: string;
    documentId?: string;
    fetchSignaturesForRun?: FetchSignaturesForRun;
}): Promise<void>;
//# sourceMappingURL=signatures.d.ts.map