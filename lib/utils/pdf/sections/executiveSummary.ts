import PDFDocument from 'pdfkit';
import { STYLES } from '../styles';
import { addSectionHeader } from '../helpers';
import { formatDate, getRiskColor, getSeverityColor, truncateText } from '../utils';
import type { JobData, RiskScoreData, MitigationItem, JobDocumentAsset } from '../types';

/**
 * Executive Summary - Redesigned Layout
 * 
 * Hybrid approach: Legal/compliance style (Pages 2+)
 * 
 * Layout:
 * - Left column: Job details (Client, Location, Dates, Status)
 * - Right column: Risk block (Score + severity label + top drivers)
 * - Below: "Key Findings" bullets (top 3-5 hazards)
 */
export function renderExecutiveSummary(
  doc: PDFKit.PDFDocument,
  job: JobData,
  riskScore: RiskScoreData | null,
  mitigationItems: MitigationItem[],
  photos: JobDocumentAsset[],
  pageWidth: number,
  margin: number,
  safeAddPage: () => void,
  isDraft: boolean
) {
  safeAddPage();
  addSectionHeader(doc, 'Executive Summary');

  // Calculate stats
  const hazardsCount = riskScore?.factors?.length || 0;
  const controlsCount = mitigationItems.length;
  const completedControls = mitigationItems.filter(
    (m) => m.done || m.is_completed
  ).length;
  const riskLevel = riskScore?.risk_level || 'unknown';

  // ============================================
  // OVERVIEW PARAGRAPH
  // ============================================
  const overviewText =
    job.description ||
    `This safety report summarizes the ${job.job_type} job performed at ${job.location} for ${job.client_name}. ` +
      `A total of ${hazardsCount} hazard${hazardsCount !== 1 ? 's' : ''} ${hazardsCount === 1 ? 'was' : 'were'} identified, ` +
      `with ${completedControls} of ${controlsCount} control measure${controlsCount !== 1 ? 's' : ''} applied by the assigned crew. ` +
      `The overall risk level for this job is classified as ${riskLevel.toUpperCase()}.`;

  doc
    .fillColor(STYLES.colors.primaryText)
    .fontSize(STYLES.sizes.body)
    .font(STYLES.fonts.body)
    .text(overviewText, {
      width: pageWidth - margin * 2,
      lineGap: 6,
      align: 'left',
    });

  doc.moveDown(2);

  // ============================================
  // TWO-COLUMN LAYOUT: Job Details | Risk Block
  // ============================================
  const twoColY = doc.y;
  const twoColHeight = 140;
  const twoColWidth = pageWidth - margin * 2;
  const colSpacing = 20;
  const colWidth = (twoColWidth - colSpacing) / 2;
  const col1X = margin;
  const col2X = margin + colWidth + colSpacing;

  // ============================================
  // LEFT COLUMN: Job Details
  // ============================================
  const jobDetailsY = twoColY;
  
  // Card background
  doc
    .roundedRect(col1X, jobDetailsY, colWidth, twoColHeight, 6)
    .fill(STYLES.colors.sectionBg)
    .stroke(STYLES.colors.borderGray)
    .lineWidth(1);

  // Card title
  doc
    .fillColor(STYLES.colors.primaryText)
    .fontSize(14)
    .font(STYLES.fonts.header)
    .text('Job Details', col1X + 16, jobDetailsY + 16);

  // Job details list
  const detailStartY = jobDetailsY + 40;
  const detailLineHeight = 20;
  
  doc
    .fillColor(STYLES.colors.secondaryText)
    .fontSize(STYLES.sizes.body)
    .font(STYLES.fonts.body)
    .text(`Client: ${job.client_name}`, col1X + 16, detailStartY)
    .text(`Location: ${job.location}`, col1X + 16, detailStartY + detailLineHeight, {
      width: colWidth - 32,
    })
    .text(`Job Type: ${job.job_type}`, col1X + 16, detailStartY + detailLineHeight * 2);

  // Dates
  const jobDuration =
    job.start_date && job.end_date
      ? `${formatDate(job.start_date)} - ${formatDate(job.end_date)}`
      : job.start_date
      ? `Started: ${formatDate(job.start_date)}`
      : 'Duration: N/A';
  
  doc.text(jobDuration, col1X + 16, detailStartY + detailLineHeight * 3, {
    width: colWidth - 32,
  });

  // Status
  doc.text(`Status: ${job.status}`, col1X + 16, detailStartY + detailLineHeight * 4);

  // ============================================
  // RIGHT COLUMN: Risk Block
  // ============================================
  const riskBlockY = twoColY;
  const riskColor = getRiskColor(riskLevel);
  
  // Card background with left accent border
  doc
    .roundedRect(col2X, riskBlockY, colWidth, twoColHeight, 6)
    .fill(STYLES.colors.sectionBg)
    .stroke(STYLES.colors.borderGray)
    .lineWidth(1);

  // Left accent border
  doc
    .rect(col2X, riskBlockY, 4, twoColHeight)
    .fill(riskColor);

  // Card title
  doc
    .fillColor(STYLES.colors.primaryText)
    .fontSize(14)
    .font(STYLES.fonts.header)
    .text('Risk Assessment', col2X + 16, riskBlockY + 16);

  // Risk Score (centered in column)
  const riskScoreValue = riskScore?.overall_score || 0;
  const scoreX = col2X + colWidth / 2;
  const scoreY = riskBlockY + 45;

  doc
    .fillColor(riskColor)
    .fontSize(42)
    .font(STYLES.fonts.header)
    .text(riskScoreValue.toString(), scoreX, scoreY, {
      align: 'center',
    });

  // Risk level badge
  const badgeY = scoreY + 40;
  const badgeWidth = 90;
  const badgeHeight = 22;
  const badgeX = col2X + colWidth / 2 - badgeWidth / 2;

  doc
    .roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 11)
    .fill(riskColor + '20')
    .stroke(riskColor)
    .lineWidth(1.5);

  doc
    .fillColor(riskColor)
    .fontSize(11)
    .font(STYLES.fonts.header)
    .text(riskLevel.toUpperCase(), scoreX, badgeY + 5, {
      align: 'center',
    });

  // Top risk drivers (if available)
  if (riskScore?.factors && riskScore.factors.length > 0) {
    const driversY = badgeY + badgeHeight + 12;
    doc
      .fillColor(STYLES.colors.secondaryText)
      .fontSize(9)
      .font(STYLES.fonts.body)
      .text('Top Drivers:', col2X + 16, driversY);

    // Show top 3 factors
    const topFactors = riskScore.factors.slice(0, 3);
    topFactors.forEach((factor, idx) => {
      const factorName = truncateText(factor.name || factor.code || 'Unknown', 25);
      doc.text(`• ${factorName}`, col2X + 16, driversY + 14 + idx * 12, {
        width: colWidth - 32,
      });
    });
  }

  doc.y = twoColY + twoColHeight + 24;

  // Separator line
  doc
    .strokeColor(STYLES.colors.divider)
    .lineWidth(0.5)
    .moveTo(margin, doc.y)
    .lineTo(pageWidth - margin, doc.y)
    .stroke();

  doc.moveDown(1.5);

  // ============================================
  // KEY FINDINGS BULLETS (Top 3-5 Hazards)
  // ============================================
  if (riskScore?.factors && riskScore.factors.length > 0) {
    doc
      .fillColor(STYLES.colors.primaryText)
      .fontSize(16)
      .font(STYLES.fonts.header)
      .text('Key Findings', margin, doc.y);

    doc.moveDown(0.8);

    // Show top 5 hazards as bullets
    const topHazards = riskScore.factors.slice(0, 5);
    topHazards.forEach((factor, idx) => {
      const factorName = factor.name || factor.code || 'Unknown Hazard';
      const severity = factor.severity || 'low';
      const severityColor = getRiskColor(severity);
      const description = truncateText((factor as any).description || 'No description provided', 60);

      // Bullet point with severity indicator
      const bulletY = doc.y;
      
      // Severity dot
      doc
        .circle(margin + 8, bulletY + 5, 4)
        .fill(severityColor);

      // Hazard name (bold)
      doc
        .fillColor(STYLES.colors.primaryText)
        .fontSize(STYLES.sizes.body)
        .font(STYLES.fonts.header)
        .text(factorName, margin + 20, bulletY, {
          width: pageWidth - margin * 2 - 20,
        });

      // Description (regular)
      if (description && description !== 'No description provided') {
        doc
          .fillColor(STYLES.colors.secondaryText)
          .fontSize(STYLES.sizes.body - 0.5)
          .font(STYLES.fonts.body)
          .text(description, margin + 20, bulletY + 14, {
            width: pageWidth - margin * 2 - 20,
            lineGap: 2,
          });
        doc.moveDown(1.2);
      } else {
        doc.moveDown(0.8);
      }
    });
  }
}
