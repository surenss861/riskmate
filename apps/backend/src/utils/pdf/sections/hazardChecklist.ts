import PDFDocument from 'pdfkit';
import { STYLES } from '../styles';
import { addSectionHeader } from '../helpers';
import { formatTime, getSeverityColor, truncateText } from '../utils';
import type { JobData, RiskScoreData } from '../types';

export function renderHazardChecklist(
  doc: PDFDocument,
  job: JobData,
  riskScore: RiskScoreData | null,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  safeAddPage: (estimatedPages?: number) => void,
  estimatedTotalPages: number
) {
  if (!riskScore || !riskScore.factors.length) return;

  safeAddPage(estimatedTotalPages);
  addSectionHeader(doc, 'Hazard Checklist');

  const tableY = doc.y;
  const tableWidth = pageWidth - margin * 2;
  const col1X = margin;
  const col1Width = tableWidth * 0.35;
  const col2X = col1X + col1Width;
  const col2Width = tableWidth * 0.15;
  const col3X = col2X + col2Width;
  const col3Width = tableWidth * 0.1;
  const col4X = col3X + col3Width;
  const col4Width = tableWidth * 0.2;
  const col5X = col4X + col4Width;
  const col5Width = tableWidth * 0.2;

  doc
    .rect(margin, tableY, tableWidth, 24)
    .fill(STYLES.colors.cardBg);

  doc
    .fillColor(STYLES.colors.primaryText)
    .fontSize(STYLES.sizes.body)
    .font(STYLES.fonts.header)
    .text('Hazard', col1X, tableY + 6, { width: col1Width })
    .text('Severity', col2X, tableY + 6, { width: col2Width })
    .text('Present', col3X, tableY + 6, { width: col3Width })
    .text('Notes', col4X, tableY + 6, { width: col4Width })
    .text('Timestamp', col5X, tableY + 6, {
      width: col5Width,
      align: 'right',
    });

  doc
    .strokeColor(STYLES.colors.borderGray)
    .lineWidth(1)
    .moveTo(margin, tableY + 24)
    .lineTo(pageWidth - margin, tableY + 24)
    .stroke();

  doc.y = tableY + 32;
  let rowIndex = 0;

  riskScore.factors.forEach((factor) => {
    if (doc.y > pageHeight - 100) {
      safeAddPage(estimatedTotalPages);
      // Don't re-add header, just reset position for table continuation
      doc.y = STYLES.spacing.sectionTop + 40;
      rowIndex = 0;
    }

    const rowY = doc.y;

    if (rowIndex % 2 === 0) {
      doc
        .rect(margin, rowY - 4, pageWidth - margin * 2, 20)
        .fill(STYLES.colors.lightGrayBg);
    }

    const severity = factor.severity || 'low';
    const severityColor = getSeverityColor(severity);
    const factorName = factor.name || factor.code || 'Unknown Hazard';
    const notes = truncateText((factor as any).description || '—', 30);

    doc
      .fillColor(STYLES.colors.primaryText)
      .fontSize(STYLES.sizes.body)
      .font(STYLES.fonts.header)
      .text(truncateText(factorName, 30), col1X + 8, rowY, {
        width: col1Width - 16,
      });

    const badgeWidth = 60;
    const badgeHeight = 16;
    doc
      .roundedRect(col2X, rowY, badgeWidth, badgeHeight, 3)
      .fill(severityColor + '40')
      .stroke(severityColor);
    doc
      .fillColor(severityColor)
      .fontSize(9)
      .font(STYLES.fonts.header)
      .text(severity.toUpperCase(), col2X + 4, rowY + 3, {
        width: badgeWidth - 8,
      });

    doc
      .fillColor(STYLES.colors.secondaryText)
      .fontSize(STYLES.sizes.body)
      .font(STYLES.fonts.body)
      .text('Yes', col3X, rowY);

    doc
      .fillColor(STYLES.colors.secondaryText)
      .fontSize(STYLES.sizes.body)
      .font(STYLES.fonts.body)
      .text(notes, col4X + 8, rowY, {
        width: col4Width - 16,
      });

    doc
      .fillColor(STYLES.colors.secondaryText)
      .fontSize(STYLES.sizes.caption)
      .font(STYLES.fonts.light)
      .text(formatTime(job.created_at), col5X, rowY + 2, {
        width: col5Width,
        align: 'right',
      });

    doc.y = rowY + 24;
    rowIndex++;
  });
}

