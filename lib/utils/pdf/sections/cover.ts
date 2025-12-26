import PDFDocument from 'pdfkit';
import { STYLES } from '../styles';
import { formatDate, getRiskColor } from '../utils';
import type { JobData, OrganizationData, RiskScoreData, MitigationItem, JobDocumentAsset } from '../types';

/**
 * Cover Page - Clean Branded Executive Deck Snapshot
 * 
 * Hybrid approach: Page 1 = product-generated deck, Pages 2+ = legal/compliance
 * 
 * Layout:
 * - Big title: "Risk Snapshot Report"
 * - Subheader row: Job Name • Address • Job ID • Generated On
 * - KPI pills strip: Risk Score, Hazards, Controls, Photos, Status
 */
export function renderCoverPage(
  doc: PDFKit.PDFDocument,
  job: JobData,
  organization: OrganizationData,
  logoBuffer: Buffer | null,
  reportGeneratedAt: Date,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  riskScore: RiskScoreData | null,
  mitigationItems: MitigationItem[],
  photos: JobDocumentAsset[],
  safeFont?: (fontName: string | undefined, callback: () => void) => void
) {
  // Clean white background
  doc.rect(0, 0, pageWidth, pageHeight).fill('#FFFFFF');

  const headerY = 60;

  // Logo (top right)
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, pageWidth - margin - 120, headerY, { fit: [100, 50] });
    } catch (error) {
      console.warn('Unable to render logo in PDF:', error);
    }
  }

  // Brand name (top left)
  doc
    .fillColor(STYLES.colors.accent)
    .fontSize(20)
    .font(STYLES.fonts.header)
    .text('RiskMate', margin, headerY, {
      width: 120,
      lineBreak: false,
    });

  // ============================================
  // BIG TITLE
  // ============================================
  const titleY = 140;
  doc
    .fillColor(STYLES.colors.primaryText)
    .fontSize(36)
    .font(STYLES.fonts.header)
    .text('Risk Snapshot Report', margin, titleY);

  // Accent line under title
  doc
    .strokeColor(STYLES.colors.accent)
    .lineWidth(3)
    .moveTo(margin, titleY + 50)
    .lineTo(margin + 280, titleY + 50)
    .stroke();

  // ============================================
  // SUBHEADER ROW (Job Name • Address • Job ID • Generated On)
  // ============================================
  const subheaderY = titleY + 80;
  const subheaderFontSize = 10.5;
  const subheaderLineHeight = 16;
  
  doc
    .fillColor(STYLES.colors.secondaryText)
    .fontSize(subheaderFontSize)
    .font(STYLES.fonts.body);

  // Job Name
  doc.text(job.job_type || 'N/A', margin, subheaderY);
  
  // Bullet separator
  doc.fontSize(subheaderFontSize);
  const jobNameWidth = doc.widthOfString(job.job_type || 'N/A');
  doc.text(' • ', margin + jobNameWidth, subheaderY);
  
  // Address (truncated if too long)
  const addressText = job.location || 'N/A';
  const addressMaxWidth = 200;
  const addressWidth = Math.min(
    doc.widthOfString(addressText),
    addressMaxWidth
  );
  doc.text(addressText.substring(0, 40), margin + jobNameWidth + 12, subheaderY, {
    width: addressMaxWidth,
  });
  
  // Job ID
  const jobIdText = `Job ID: ${job.id.substring(0, 8).toUpperCase()}`;
  const jobIdX = margin + jobNameWidth + addressMaxWidth + 30;
  doc.text(jobIdText, jobIdX, subheaderY);
  
  // Generated On
  const generatedText = `Generated: ${formatDate(reportGeneratedAt.toISOString())}`;
  const generatedX = pageWidth - margin - doc.widthOfString(generatedText);
  doc.text(generatedText, generatedX, subheaderY);

  // ============================================
  // KPI PILLS STRIP
  // ============================================
  const pillsY = subheaderY + 50;
  const pillHeight = 80;
  const pillSpacing = 12;
  const pillsStartX = margin;
  
  // Calculate stats
  const hazardsCount = riskScore?.factors?.length || 0;
  const controlsCount = mitigationItems.length;
  const completedControls = mitigationItems.filter((m) => m.done || m.is_completed).length;
  const photosCount = photos.length;
  const riskLevel = riskScore?.risk_level || 'unknown';
  const riskScoreValue = riskScore?.overall_score || 0;
  const riskColor = getRiskColor(riskLevel);

  // Available width for pills
  const availableWidth = pageWidth - margin * 2;
  const pillCount = 5;
  const totalSpacing = pillSpacing * (pillCount - 1);
  const pillWidth = (availableWidth - totalSpacing) / pillCount;

  // Pill 1: Risk Score
  const pill1X = pillsStartX;
  doc
    .roundedRect(pill1X, pillsY, pillWidth, pillHeight, 8)
    .fill(riskColor + '15') // Light background tint
    .stroke(riskColor)
    .lineWidth(2);
  
  // Risk Score number
  doc
    .fillColor(riskColor)
    .fontSize(32)
    .font(STYLES.fonts.header)
    .text(riskScoreValue.toString(), pill1X + pillWidth / 2, pillsY + 12, {
      align: 'center',
    });
  
  // Risk level label
  doc
    .fillColor(STYLES.colors.secondaryText)
    .fontSize(9)
    .font(STYLES.fonts.body)
    .text(riskLevel.toUpperCase(), pill1X + pillWidth / 2, pillsY + 50, {
      align: 'center',
    });

  // Pill 2: Hazards
  const pill2X = pill1X + pillWidth + pillSpacing;
  doc
    .roundedRect(pill2X, pillsY, pillWidth, pillHeight, 8)
    .fill(STYLES.colors.lightGrayBg)
    .stroke(STYLES.colors.borderGray)
    .lineWidth(1);
  
  doc
    .fillColor(STYLES.colors.primaryText)
    .fontSize(32)
    .font(STYLES.fonts.header)
    .text(hazardsCount.toString(), pill2X + pillWidth / 2, pillsY + 12, {
      align: 'center',
    });
  
  doc
    .fillColor(STYLES.colors.secondaryText)
    .fontSize(9)
    .font(STYLES.fonts.body)
    .text('Hazards', pill2X + pillWidth / 2, pillsY + 50, {
      align: 'center',
    });

  // Pill 3: Controls
  const pill3X = pill2X + pillWidth + pillSpacing;
  doc
    .roundedRect(pill3X, pillsY, pillWidth, pillHeight, 8)
    .fill(STYLES.colors.lightGrayBg)
    .stroke(STYLES.colors.borderGray)
    .lineWidth(1);
  
  const controlsText = controlsCount === 0 ? '—' : `${completedControls}/${controlsCount}`;
  doc
    .fillColor(STYLES.colors.primaryText)
    .fontSize(controlsCount === 0 ? 24 : 28)
    .font(STYLES.fonts.header)
    .text(controlsText, pill3X + pillWidth / 2, pillsY + 12, {
      align: 'center',
    });
  
  doc
    .fillColor(STYLES.colors.secondaryText)
    .fontSize(9)
    .font(STYLES.fonts.body)
    .text('Controls', pill3X + pillWidth / 2, pillsY + 50, {
      align: 'center',
    });

  // Pill 4: Photos
  const pill4X = pill3X + pillWidth + pillSpacing;
  doc
    .roundedRect(pill4X, pillsY, pillWidth, pillHeight, 8)
    .fill(STYLES.colors.lightGrayBg)
    .stroke(STYLES.colors.borderGray)
    .lineWidth(1);
  
  doc
    .fillColor(STYLES.colors.primaryText)
    .fontSize(32)
    .font(STYLES.fonts.header)
    .text(photosCount.toString(), pill4X + pillWidth / 2, pillsY + 12, {
      align: 'center',
    });
  
  doc
    .fillColor(STYLES.colors.secondaryText)
    .fontSize(9)
    .font(STYLES.fonts.body)
    .text('Photos', pill4X + pillWidth / 2, pillsY + 50, {
      align: 'center',
    });

  // Pill 5: Status
  const pill5X = pill4X + pillWidth + pillSpacing;
  doc
    .roundedRect(pill5X, pillsY, pillWidth, pillHeight, 8)
    .fill(STYLES.colors.lightGrayBg)
    .stroke(STYLES.colors.borderGray)
    .lineWidth(1);
  
  doc
    .fillColor(STYLES.colors.primaryText)
    .fontSize(20)
    .font(STYLES.fonts.header)
    .text(job.status.toUpperCase(), pill5X + pillWidth / 2, pillsY + 20, {
      align: 'center',
    });
  
  doc
    .fillColor(STYLES.colors.secondaryText)
    .fontSize(9)
    .font(STYLES.fonts.body)
    .text('Status', pill5X + pillWidth / 2, pillsY + 50, {
      align: 'center',
    });
}
