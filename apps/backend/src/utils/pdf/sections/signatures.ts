import PDFDocument from 'pdfkit';
import {
  renderSignaturesAndCompliance as renderSignaturesCore,
  type PdfSignatureData,
} from '../../../../../../lib/utils/pdf/sections/signatures';
import { supabase } from '../../../lib/supabaseClient';

export type { PdfSignatureData };

/** Optional: inject a custom fetcher for signatures (e.g. for tests). When omitted, uses Supabase. */
export type FetchSignaturesForRun = (reportRunId: string) => Promise<PdfSignatureData[]>;

async function defaultFetchSignaturesForRun(reportRunId: string): Promise<PdfSignatureData[]> {
  const { data, error } = await supabase
    .from('report_signatures')
    .select('signer_name, signer_title, signature_role, signature_svg, signed_at, signature_hash')
    .eq('report_run_id', reportRunId)
    .is('revoked_at', null)
    .order('signed_at', { ascending: true });

  if (error) {
    console.warn('Failed to fetch signatures for PDF:', error);
    return [];
  }
  if (!data?.length) return [];
  return data.map((row: Record<string, unknown>) => ({
    signer_name: row.signer_name as string,
    signer_title: row.signer_title as string,
    signature_role: row.signature_role as PdfSignatureData['signature_role'],
    signature_svg: row.signature_svg as string,
    signed_at: row.signed_at as string,
    signature_hash: row.signature_hash as string | null | undefined,
  }));
}

/**
 * Renders Signatures & Compliance section using the shared lib implementation.
 * When reportRunId is provided, fetches signatures from report_signatures then calls the shared renderer.
 */
export async function renderSignaturesAndCompliance(
  doc: PDFKit.PDFDocument,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  safeAddPage: (estimatedPages?: number) => void,
  estimatedTotalPages: number,
  options?: {
    reportRunId?: string;
    documentId?: string;
    fetchSignaturesForRun?: FetchSignaturesForRun;
  }
): Promise<void> {
  let signatures: PdfSignatureData[] = [];
  if (options?.reportRunId) {
    const fetchFn = options.fetchSignaturesForRun ?? defaultFetchSignaturesForRun;
    signatures = await fetchFn(options.reportRunId);
  }

  renderSignaturesCore(doc, pageWidth, pageHeight, margin, safeAddPage, signatures, {
    estimatedTotalPages,
    documentId: options?.documentId,
  });
}
