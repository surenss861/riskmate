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
import { groupTimelineEvents } from './helpers';
import { renderCoverPage } from './sections/cover';
import { renderExecutiveSummary } from './sections/executiveSummary';
import { renderHazardChecklist } from './sections/hazardChecklist';
import { renderControlsApplied } from './sections/controlsApplied';
import { renderTimeline } from './sections/timeline';
import { renderPhotosSection } from './sections/photos';
import { renderSignaturesAndCompliance } from './sections/signatures';

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
  const isDraft = job.status?.toLowerCase() === 'draft';

  return new Promise((resolve, reject) => {
    let doc: PDFKit.PDFDocument;
    
    try {
      doc = new PDFDocument({
        size: 'LETTER',
        bufferPages: true, // Enable page buffering for post-pass header/footer rendering
        margins: {
          top: STYLES.spacing.pageMargin, // 48pt for more breathing room
          bottom: 60,
          left: STYLES.spacing.pageMargin,
          right: STYLES.spacing.pageMargin,
        },
      });
    } catch (initError: any) {
      return reject(new Error(`Failed to initialize PDF: ${initError?.message || String(initError)}`));
    }

    const chunks: Buffer[] = [];
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = STYLES.spacing.pageMargin;

    // Simple add page function - NO headers/footers/watermarks here
    // We'll add those in a post-pass after all content is rendered
    const safeAddPage = () => {
      doc.addPage();
      // Reset cursor to top of content area
      doc.y = STYLES.spacing.sectionTop;
    };

    // ============================================
    // RENDER ALL CONTENT FIRST (no headers/footers/watermarks)
    // ============================================

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    
    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    
    doc.on('error', (err: any) => {
      if (err?.message?.includes('ENOENT') && err?.message?.includes('.afm')) {
        reject(new Error('PDF generation failed: Font files not available. This is a known issue in serverless environments. Please ensure PDFKit font data is included in the deployment.'));
      } else {
        reject(err);
      }
    });

    // First page (cover) - render content only
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

    // Render all sections - they will only add pages when there's content
    renderExecutiveSummary(
      doc,
      job,
      riskScore,
      mitigationItems,
      photos,
      pageWidth,
      margin,
      safeAddPage,
      isDraft
    );

    renderHazardChecklist(
      doc,
      job,
      riskScore,
      pageWidth,
      pageHeight,
      margin,
      safeAddPage
    );

    renderControlsApplied(
      doc,
      mitigationItems,
      accent,
      pageWidth,
      pageHeight,
      margin,
      safeAddPage
    );

    renderTimeline(
      doc,
      auditLogs,
      pageWidth,
      pageHeight,
      margin,
      safeAddPage
    );

    renderPhotosSection(
      doc,
      photos,
      job.start_date,
      pageWidth,
      pageHeight,
      margin,
      safeAddPage
    );

    renderSignaturesAndCompliance(
      doc,
      pageWidth,
      pageHeight,
      margin,
      safeAddPage
    );

    // ============================================
    // NO POST-PASS STAMPING - PDFKit generation complete
    // Stamping (headers/footers/watermarks) is now handled by pdf-lib
    // after this buffer is returned. This eliminates ghost pages caused
    // by PDFKit's flow-mode pagination during stamping.
    // ============================================
    
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
