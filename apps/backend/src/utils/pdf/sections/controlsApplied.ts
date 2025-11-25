import PDFDocument from 'pdfkit';
import { STYLES } from '../styles';
import { addSectionHeader } from '../helpers';
import { formatTime, truncateText } from '../utils';
import type { MitigationItem } from '../types';

export function renderControlsApplied(
  doc: PDFDocument,
  mitigationItems: MitigationItem[],
  accent: string,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  safeAddPage: (estimatedPages?: number) => void,
  estimatedTotalPages: number
) {
  if (!mitigationItems.length) return;

  safeAddPage(estimatedTotalPages);
  addSectionHeader(doc, 'Controls Applied');

  const completedCount = mitigationItems.filter(
    (m) => m.done || m.is_completed
  ).length;
  const totalCount = mitigationItems.length;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const complianceY = doc.y;
  const complianceColor =
    progressPercent >= 80
      ? STYLES.colors.riskLow
      : progressPercent >= 50
      ? STYLES.colors.riskMedium
      : STYLES.colors.riskHigh;

  doc
    .fillColor(STYLES.colors.primaryText)
    .fontSize(STYLES.sizes.body)
    .font(STYLES.fonts.header)
    .text(`Compliance Score: ${progressPercent}%`, margin, complianceY);

  const complianceBadgeY = complianceY + 20;
  const complianceBadgeWidth = 200;
  const complianceBadgeHeight = 20;

  doc
    .roundedRect(
      margin,
      complianceBadgeY,
      complianceBadgeWidth,
      complianceBadgeHeight,
      10
    )
    .fill(complianceColor + '20')
    .stroke(complianceColor)
    .lineWidth(1.5);

  doc
    .fillColor(complianceColor)
    .fontSize(STYLES.sizes.body)
    .font(STYLES.fonts.header)
    .text(
      `${completedCount}/${totalCount} Controls Completed`,
      margin + 10,
      complianceBadgeY + 4
    );

  const progressBarY = complianceY + 50;
  const progressBarWidth = pageWidth - margin * 2;
  const progressBarHeight = 12;

  doc
    .rect(margin, progressBarY, progressBarWidth, progressBarHeight)
    .fill(STYLES.colors.borderGray);

  if (progressPercent > 0) {
    const progressWidth = (progressPercent / 100) * progressBarWidth;
    doc
      .rect(margin, progressBarY, progressWidth, progressBarHeight)
      .fill(STYLES.colors.riskLow);
  }

  doc.moveDown(1.5);

  const tableY = doc.y;
  const tableWidth = pageWidth - margin * 2;
  const col1X = margin;
  const col1Width = tableWidth * 0.4;
  const col2X = col1X + col1Width;
  const col2Width = tableWidth * 0.15;
  const col3X = col2X + col2Width;
  const col3Width = tableWidth * 0.45;

  doc
    .rect(margin, tableY, tableWidth, 24)
    .fill(STYLES.colors.cardBg);

  doc
    .fillColor(STYLES.colors.primaryText)
    .fontSize(STYLES.sizes.body)
    .font(STYLES.fonts.header)
    .text('Control', col1X, tableY + 6, { width: col1Width })
    .text('Applied?', col2X, tableY + 6, { width: col2Width })
    .text('Notes', col3X, tableY + 6, { width: col3Width });

  doc
    .strokeColor(STYLES.colors.borderGray)
    .lineWidth(1)
    .moveTo(margin, tableY + 24)
    .lineTo(pageWidth - margin, tableY + 24)
    .stroke();

  doc.y = tableY + 32;
  let rowIndex = 0;

  mitigationItems.forEach((item, index) => {
    if (doc.y > pageHeight - 100) {
      safeAddPage(estimatedTotalPages);
      // Don't re-add header, just reset position for table continuation
      doc.y = STYLES.spacing.sectionTop + 40;
      rowIndex = 0;
    }

    const rowY = doc.y;

    if (index > 0 && index % 4 === 0) {
      doc.y += 8;
    }

    if (rowIndex % 2 === 0) {
      doc
        .rect(margin, rowY - 4, pageWidth - margin * 2, 28)
        .fill(STYLES.colors.lightGrayBg);
    }

    const isCompleted = item.done || item.is_completed;
    const checkmark = isCompleted ? '[X]' : '[ ]';
    const textColor = isCompleted
      ? STYLES.colors.secondaryText
      : STYLES.colors.primaryText;

    const fullTitle = item.title || 'Untitled Control';
    let controlText = fullTitle
      .replace(/^Mitigation for\s+/i, '')
      .replace(/^Mitigation:\s*/i, '')
      .replace(/^Control:\s*/i, '')
      .trim();

    if (controlText.length > 45) {
      controlText = controlText.substring(0, 42) + '...';
    }

    doc
      .fillColor(accent)
      .fontSize(STYLES.sizes.body)
      .font(STYLES.fonts.body)
      .text(checkmark, col1X, rowY)
      .fillColor(textColor)
      .fontSize(STYLES.sizes.body)
      .font(isCompleted ? STYLES.fonts.light : STYLES.fonts.body)
      .text(controlText, col1X + 25, rowY, {
        width: col1Width - 25,
        lineGap: 4,
      });

    doc
      .fillColor(
        isCompleted ? STYLES.colors.riskLow : STYLES.colors.secondaryText
      )
      .fontSize(STYLES.sizes.body)
      .font(STYLES.fonts.body)
      .text(isCompleted ? 'Yes' : 'No', col2X, rowY);

    const fullNotes = item.description || '—';
    let notes = fullNotes
      .replace(/^Request\s+/i, '')
      .replace(/^Verify\s+/i, '')
      .replace(/^Check\s+/i, '')
      .replace(/^Ensure\s+/i, '')
      .trim();

    const firstSentence = notes.split(/[.!?]/)[0];
    if (firstSentence && firstSentence.length < 60) {
      notes = firstSentence;
    } else if (notes.length > 60) {
      notes = notes.substring(0, 57).replace(/\s+\S*$/, '') + '...';
    }

    doc
      .fillColor(STYLES.colors.secondaryText)
      .fontSize(STYLES.sizes.body)
      .font(STYLES.fonts.body)
      .text(notes, col3X, rowY, {
        width: col3Width - 8,
        lineGap: 4,
      });

    if (isCompleted && item.completed_at) {
      doc
        .fillColor(STYLES.colors.secondaryText)
        .fontSize(STYLES.sizes.caption)
        .font(STYLES.fonts.light)
        .text(`Completed: ${formatTime(item.completed_at)}`, col1X + 25, rowY + 14);
    }

    const controlHeight = doc.heightOfString(controlText, {
      width: col1Width - 25,
      lineGap: 4,
    });
    const notesHeight = doc.heightOfString(notes, {
      width: col3Width - 8,
      lineGap: 4,
    });
    const rowHeight =
      Math.max(controlHeight, notesHeight, 20) +
      (isCompleted && item.completed_at ? 14 : 0);

    doc.y = rowY + Math.max(rowHeight, 28);
    rowIndex++;
  });
}

