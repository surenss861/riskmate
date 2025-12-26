import PDFDocument from 'pdfkit';
import { STYLES } from '../styles';
import { addSectionHeader } from '../helpers';
import type { JobData } from '../types';

/**
 * Signatures & Compliance - Legal/Compliance Style
 * 
 * Hybrid approach: Pages 2+ = legal/compliance style
 * 
 * Improvements:
 * - Add "Prepared by RiskMate" line
 * - Add Document ID / hash style line
 * - Put compliance paragraph into bordered callout block
 * - Keep signature rows aligned, less vertical sprawl
 */
export function renderSignaturesAndCompliance(
  doc: PDFKit.PDFDocument,
  job: JobData,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  safeAddPage: () => void
) {
  safeAddPage();
  addSectionHeader(doc, 'Signatures & Compliance');

  // ============================================
  // PREPARED BY & DOCUMENT ID
  // ============================================
  doc
    .fillColor(STYLES.colors.secondaryText)
    .fontSize(9)
    .font(STYLES.fonts.body)
    .text('Prepared by RiskMate', margin, doc.y)
    .text(`Document ID: ${job.id.substring(0, 8).toUpperCase()}`, margin, doc.y + 12);

  doc.moveDown(2);

  // ============================================
  // CREW SIGNATURES
  // ============================================
  doc
    .fillColor(STYLES.colors.primaryText)
    .fontSize(14)
    .font(STYLES.fonts.header)
    .text('Crew Signatures', { align: 'left' });

  doc.moveDown(0.8);

  const sigBoxY = doc.y;
  const sigBoxHeight = 90; // Reduced from 100 for tighter layout
  const sigBoxWidth = (pageWidth - margin * 2 - 20) / 2;
  const sigSpacing = 20;

  for (let i = 0; i < 4; i++) {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const sigY = sigBoxY + row * (sigBoxHeight + sigSpacing);
    const sigX = margin + col * (sigBoxWidth + sigSpacing);

    if (sigY + sigBoxHeight > pageHeight - 200) {
      safeAddPage();
      const newY = STYLES.spacing.sectionTop + 40;
      const adjustedRow = Math.floor(i / 2);
      const adjustedY = newY + adjustedRow * (sigBoxHeight + sigSpacing);
      const adjustedX = margin + col * (sigBoxWidth + sigSpacing);

      doc
        .rect(adjustedX, adjustedY, sigBoxWidth, sigBoxHeight)
        .fill(STYLES.colors.sectionBg)
        .stroke(STYLES.colors.borderGray)
        .lineWidth(1.5);

      doc
        .strokeColor(STYLES.colors.secondaryText)
        .lineWidth(1)
        .dash(3, { space: 2 })
        .moveTo(adjustedX + 15, adjustedY + 20)
        .lineTo(adjustedX + sigBoxWidth - 15, adjustedY + 20)
        .stroke()
        .undash();

      doc
        .fillColor(STYLES.colors.secondaryText)
        .fontSize(STYLES.sizes.caption)
        .font(STYLES.fonts.light)
        .text('Signature', adjustedX + 15, adjustedY + 25)
        .fillColor(STYLES.colors.primaryText)
        .fontSize(STYLES.sizes.body)
        .font(STYLES.fonts.body)
        .text('Printed Name: _________________', adjustedX + 15, adjustedY + 45, {
          width: sigBoxWidth - 30,
        })
        .text('Crew Role: _________________', adjustedX + 15, adjustedY + 65, {
          width: sigBoxWidth - 30,
        })
        .fillColor(STYLES.colors.secondaryText)
        .fontSize(STYLES.sizes.caption)
        .font(STYLES.fonts.light)
        .text('Date: _________________', adjustedX + 15, adjustedY + 80);
    } else {
      doc
        .rect(sigX, sigY, sigBoxWidth, sigBoxHeight)
        .fill(STYLES.colors.sectionBg)
        .stroke(STYLES.colors.borderGray)
        .lineWidth(1.5);

      doc
        .strokeColor(STYLES.colors.secondaryText)
        .lineWidth(1)
        .dash(3, { space: 2 })
        .moveTo(sigX + 15, sigY + 20)
        .lineTo(sigX + sigBoxWidth - 15, sigY + 20)
        .stroke()
        .undash();

      doc
        .fillColor(STYLES.colors.secondaryText)
        .fontSize(STYLES.sizes.caption)
        .font(STYLES.fonts.light)
        .text('Signature', sigX + 15, sigY + 25)
        .fillColor(STYLES.colors.primaryText)
        .fontSize(STYLES.sizes.body)
        .font(STYLES.fonts.body)
        .text('Printed Name: _________________', sigX + 15, sigY + 45, {
          width: sigBoxWidth - 30,
        })
        .text('Crew Role: _________________', sigX + 15, sigY + 65, {
          width: sigBoxWidth - 30,
        })
        .fillColor(STYLES.colors.secondaryText)
        .fontSize(STYLES.sizes.caption)
        .font(STYLES.fonts.light)
        .text('Date: _________________', sigX + 15, sigY + 80);
    }
  }

  doc.y = sigBoxY + 2 * (sigBoxHeight + sigSpacing) + 30; // Reduced spacing
  const complianceY = doc.y;

  // ============================================
  // COMPLIANCE STATEMENT (Bordered Callout Block)
  // ============================================
  doc
    .fillColor(STYLES.colors.primaryText)
    .fontSize(14)
    .font(STYLES.fonts.header)
    .text('Compliance Statement', margin, complianceY);

  doc.moveDown(0.8);

  const complianceText =
    'This report was generated through RiskMate and includes all safety, hazard, and control ' +
    'documentation submitted by the assigned crew. All data is timestamped and stored securely. ' +
    'This documentation serves as evidence of compliance with safety protocols and regulatory requirements.';

  // Calculate text height for callout box
  const complianceTextHeight = doc.heightOfString(complianceText, {
    width: pageWidth - margin * 2 - 32,
    lineGap: 4,
  });

  const calloutY = doc.y;
  const calloutHeight = complianceTextHeight + 24;
  const calloutWidth = pageWidth - margin * 2;

  // Bordered callout block
  doc
    .roundedRect(margin, calloutY, calloutWidth, calloutHeight, 6)
    .fill(STYLES.colors.lightGrayBg)
    .stroke(STYLES.colors.borderGray)
    .lineWidth(1.5);

  // Compliance text inside callout
  doc
    .fillColor(STYLES.colors.secondaryText)
    .fontSize(STYLES.sizes.body)
    .font(STYLES.fonts.body)
    .text(complianceText, margin + 16, calloutY + 12, {
      width: calloutWidth - 32,
      lineGap: 4,
    });
}
