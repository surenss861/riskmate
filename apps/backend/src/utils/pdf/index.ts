import PDFDocument from 'pdfkit';
import type {
  JobData,
  RiskScoreData,
  MitigationItem,
  OrganizationData,
  JobDocumentAsset,
  AuditLogEntry,
} from './types';
import { STYLES } from './styles';
import { fetchLogoBuffer, categorizePhotos } from './utils';
import { addWatermark, addFooterInline, groupTimelineEvents } from './helpers';
import { renderCoverPage } from './sections/cover';
import { renderExecutiveSummary } from './sections/executiveSummary';
import { renderHazardChecklist } from './sections/hazardChecklist';
import { renderControlsApplied } from './sections/controlsApplied';
import { renderTimeline } from './sections/timeline';
import { renderPhotosSection } from './sections/photos';
import {
  renderSignaturesAndCompliance,
  type PdfSignatureData,
} from './sections/signatures';
import { supabase } from '../../lib/supabaseClient';

// ============================================
// MAIN GENERATOR
// ============================================
export async function generateRiskSnapshotPDF(
  job: JobData,
  riskScore: RiskScoreData | null,
  mitigationItems: MitigationItem[],
  organization: OrganizationData,
  photos: JobDocumentAsset[] = [],
  auditLogs: AuditLogEntry[] = [],
  /** When provided (e.g. from report_signatures for a report run), actual signatures are rendered in the PDF */
  signatures?: PdfSignatureData[],
  /** Report run ID to fetch signatures from report_signatures table */
  reportRunId?: string
): Promise<Buffer> {
  const accent = organization.accent_color || '#F97316';
  const logoBuffer = await fetchLogoBuffer(organization.logo_url);
  const reportGeneratedAt = new Date();
  const jobStartDate = job.start_date ? new Date(job.start_date) : null;
  const jobEndDate = job.end_date ? new Date(job.end_date) : null;

  // Fetch signatures from report_signatures table if reportRunId is provided
  let fetchedSignatures: PdfSignatureData[] = [];
  if (reportRunId) {
    try {
      const { data: signatureData, error: signatureError } = await supabase
        .from('report_signatures')
        .select('signer_name, signer_title, signature_role, signature_svg, signed_at, signature_hash')
        .eq('report_run_id', reportRunId)
        .is('revoked_at', null)
        .order('signed_at', { ascending: true });

      if (signatureError) {
        console.warn('Failed to fetch signatures for PDF:', signatureError);
      } else if (signatureData && signatureData.length > 0) {
        fetchedSignatures = signatureData.map((sig: any) => ({
          signer_name: sig.signer_name,
          signer_title: sig.signer_title,
          signature_role: sig.signature_role,
          signature_svg: sig.signature_svg,
          signed_at: sig.signed_at,
          signature_hash: sig.signature_hash,
        }));
      }
    } catch (err) {
      console.warn('Error fetching signatures for PDF:', err);
    }
  }

  // Use fetched signatures if available, otherwise use passed-in signatures, or empty array
  const finalSignatures = fetchedSignatures.length > 0 ? fetchedSignatures : (signatures || []);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: {
        top: STYLES.spacing.pageMargin,
        bottom: 60,
        left: STYLES.spacing.pageMargin,
        right: STYLES.spacing.pageMargin,
      },
    });

    const chunks: Buffer[] = [];
    let pageCount = 1;
    let currentPage = 1;

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = STYLES.spacing.pageMargin;

    const groupedTimeline = groupTimelineEvents(auditLogs);
    const { before, during, after } = categorizePhotos(photos, job.start_date, job.end_date);

    // Rough estimate for footer page numbers
    const estimatedTotalPages =
      1 + // cover
      1 + // executive
      (riskScore?.factors?.length ? 1 : 0) +
      (mitigationItems.length ? 1 : 0) +
      (groupedTimeline.length ? 1 : 0) +
      (photos.length ? Math.ceil(photos.length / 9) : 0) +
      1; // signatures

    const safeAddPage = (estimatedPages?: number) => {
      // Add footer to current page before switching (skip first page)
      if (pageCount > 1) {
        addFooterInline(
          doc,
          organization,
          job.id,
          reportGeneratedAt,
          currentPage,
          estimatedPages || pageCount
        );
      }

      // Create new page
      doc.addPage();
      pageCount++;
      currentPage = pageCount;

      // Add watermark to new page
      addWatermark(doc);
      
      // Reset cursor to top of content area (below header/watermark)
      // This ensures content starts at the right position
      doc.y = STYLES.spacing.sectionTop;
    };

    // ============================================
    // WIRING IT ALL TOGETHER
    // ============================================

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    // First page (cover) is created by PDFKit constructor
    addWatermark(doc);
    renderCoverPage(
      doc,
      job,
      organization,
      logoBuffer,
      reportGeneratedAt,
      pageWidth,
      pageHeight,
      margin
    );

    renderExecutiveSummary(
      doc,
      job,
      riskScore,
      mitigationItems,
      photos,
      pageWidth,
      margin,
      safeAddPage,
      estimatedTotalPages
    );

    renderHazardChecklist(
      doc,
      job,
      riskScore,
      pageWidth,
      pageHeight,
      margin,
      safeAddPage,
      estimatedTotalPages
    );

    renderControlsApplied(
      doc,
      mitigationItems,
      accent,
      pageWidth,
      pageHeight,
      margin,
      safeAddPage,
      estimatedTotalPages
    );

    renderTimeline(
      doc,
      auditLogs,
      pageWidth,
      pageHeight,
      margin,
      safeAddPage,
      estimatedTotalPages
    );

    renderPhotosSection(
      doc,
      photos,
      job.start_date,
      job.end_date,
      pageWidth,
      pageHeight,
      margin,
      safeAddPage,
      estimatedTotalPages
    );

    renderSignaturesAndCompliance(
      doc,
      pageWidth,
      pageHeight,
      margin,
      safeAddPage,
      estimatedTotalPages,
      finalSignatures
    );

    // Final footer for last page
    addFooterInline(doc, organization, job.id, reportGeneratedAt, pageCount, pageCount);

    doc.end();
  });
}

// Re-export types for convenience
export type {
  JobData,
  RiskScoreData,
  MitigationItem,
  OrganizationData,
  JobDocumentAsset,
  AuditLogEntry,
};

