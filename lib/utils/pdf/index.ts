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
import { renderSignaturesAndCompliance } from './sections/signatures';

// Workaround for serverless environments where font files aren't available
// PDFKit needs font metric files, but in Vercel/serverless they may not be available
// Solution: Use PDFKit's built-in fonts without specifying font names explicitly
// PDFKit's default font works without .afm files in serverless environments
// We'll wrap font calls in try-catch to handle any font loading errors gracefully

// ============================================
// MAIN GENERATOR
// ============================================
export async function generateRiskSnapshotPDF(
  job: JobData,
  riskScore: RiskScoreData | null,
  mitigationItems: MitigationItem[],
  organization: OrganizationData,
  photos: JobDocumentAsset[] = [],
  auditLogs: AuditLogEntry[] = []
): Promise<Buffer> {
  const accent = organization.accent_color || '#F97316';
  const logoBuffer = await fetchLogoBuffer(organization.logo_url);
  const reportGeneratedAt = new Date();
  const jobStartDate = job.start_date ? new Date(job.start_date) : null;
  const jobEndDate = job.end_date ? new Date(job.end_date) : null;

  return new Promise((resolve, reject) => {
    let doc: PDFKit.PDFDocument;
    
    try {
      doc = new PDFDocument({
        size: 'LETTER',
        margins: {
          top: STYLES.spacing.pageMargin,
          bottom: 60,
          left: STYLES.spacing.pageMargin,
          right: STYLES.spacing.pageMargin,
        },
      });
    } catch (initError: any) {
      return reject(new Error(`Failed to initialize PDF: ${initError?.message || String(initError)}`));
    }

    const chunks: Buffer[] = [];
    let pageCount = 1;
    let currentPage = 1;

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = STYLES.spacing.pageMargin;

    const groupedTimeline = groupTimelineEvents(auditLogs);
    const { before, during, after } = categorizePhotos(photos, job.start_date);

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
    doc.on('error', (err: any) => {
      // Handle font loading errors in serverless environments
      if (err?.message?.includes('ENOENT') && err?.message?.includes('.afm')) {
        reject(new Error('PDF generation failed: Font files not available. This is a known issue in serverless environments. Please ensure PDFKit font data is included in the deployment.'));
      } else {
        reject(err);
      }
    });

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
      estimatedTotalPages
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

