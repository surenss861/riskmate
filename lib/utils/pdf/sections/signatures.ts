import PDFDocument from 'pdfkit';
import { STYLES } from '../styles';
import { addSectionHeader } from '../helpers';
import { formatDate } from '../utils';
import type { JobData } from '../types';
import { drawSignatureSvgPath } from '../signatureHelpers';
import { validateSignatureSvg } from '../../signatureValidation';

/** Signature data for PDF rendering (run's report_signatures) */
export interface PdfSignatureData {
  signer_name: string;
  signer_title: string;
  signature_role: 'prepared_by' | 'reviewed_by' | 'approved_by' | 'other';
  signature_svg: string;
  signed_at: string;
  signature_hash?: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  prepared_by: 'Prepared By',
  reviewed_by: 'Reviewed By',
  approved_by: 'Approved By',
  other: 'Signature',
};

/**
 * Signatures & Compliance - Legal/Compliance Style
 *
 * When signatures array is provided, renders actual signer name/title, timestamp, signature hash,
 * and indicates signature captured (SVG stored). Otherwise renders placeholder boxes.
 */
export function renderSignaturesAndCompliance(
  doc: PDFKit.PDFDocument,
  job: JobData,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  safeAddPage: () => void,
  signatures?: PdfSignatureData[]
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
    .text('Prepared by Riskmate', margin, doc.y)
    .text(`Document ID: ${job.id.substring(0, 8).toUpperCase()}`, margin, doc.y + 12);

  doc.moveDown(2);

  // ============================================
  // CREW SIGNATURES (actual data or placeholders)
  // ============================================
  doc
    .fillColor(STYLES.colors.primaryText)
    .fontSize(14)
    .font(STYLES.fonts.header)
    .text('Crew Signatures', { align: 'left' });

  doc.moveDown(0.8);

  const sigBoxY = doc.y;
  const sigBoxHeight = 90;
  const sigBoxWidth = (pageWidth - margin * 2 - 20) / 2;
  const sigSpacing = 20;
  const count = signatures?.length ? Math.min(signatures.length, 4) : 4;

  for (let i = 0; i < count; i++) {
    const sig = signatures?.[i];
    const row = Math.floor(i / 2);
    const col = i % 2;
    const sigY = sigBoxY + row * (sigBoxHeight + sigSpacing);
    const sigX = margin + col * (sigBoxWidth + sigSpacing);

    const drawBox = (x: number, y: number) => {
      doc
        .rect(x, y, sigBoxWidth, sigBoxHeight)
        .fill(STYLES.colors.sectionBg)
        .stroke(STYLES.colors.borderGray)
        .lineWidth(1.5);

      doc
        .strokeColor(STYLES.colors.secondaryText)
        .lineWidth(1)
        .dash(3, { space: 2 })
        .moveTo(x + 15, y + 20)
        .lineTo(x + sigBoxWidth - 15, y + 20)
        .stroke()
        .undash();

      if (sig) {
        const roleLabel = ROLE_LABELS[sig.signature_role] ?? sig.signature_role;
        const dateStr = formatDate(sig.signed_at);
        const hashStr = sig.signature_hash
          ? `${sig.signature_hash.substring(0, 12)}…${sig.signature_hash.substring(sig.signature_hash.length - 8)}`
          : '';

        doc
          .fillColor(STYLES.colors.secondaryText)
          .fontSize(STYLES.sizes.caption)
          .font(STYLES.fonts.light)
          .text(roleLabel, x + 15, y + 25);
        doc
          .fillColor(STYLES.colors.primaryText)
          .fontSize(STYLES.sizes.body)
          .font(STYLES.fonts.body)
          .text(sig.signer_name, x + 15, y + 38, { width: sigBoxWidth - 30 })
          .text(sig.signer_title, x + 15, y + 52, { width: sigBoxWidth - 30 });
        if (sig.signature_svg) {
          // Validate signature before rendering
          const validation = validateSignatureSvg(sig.signature_svg);
          if (validation.valid) {
            const pathBoxX = x + 15;
            const pathBoxY = y + 54;
            const pathBoxW = sigBoxWidth - 30;
            const pathBoxH = 16;
            drawSignatureSvgPath(
              doc,
              sig.signature_svg,
              pathBoxX,
              pathBoxY,
              pathBoxW,
              pathBoxH,
              STYLES.colors.primaryText,
              1
            );
          }
          // If invalid, signature box is rendered without SVG path (placeholder behavior)
        }
        doc
          .fillColor(STYLES.colors.primaryText)
          .fontSize(STYLES.sizes.body)
          .font(STYLES.fonts.body)
          .text(`Signed: ${dateStr}`, x + 15, y + 72, { width: sigBoxWidth - 30 });
        if (hashStr) {
          doc
            .fillColor(STYLES.colors.secondaryText)
            .fontSize(8)
            .font(STYLES.fonts.light)
            .text(`Hash: ${hashStr}`, x + 15, y + 78, { width: sigBoxWidth - 30 });
        }
        doc
          .fillColor(STYLES.colors.secondaryText)
          .fontSize(8)
          .font(STYLES.fonts.light)
          .text('Signature captured (SVG on file)', x + 15, y + 86, { width: sigBoxWidth - 30 });
      } else {
        doc
          .fillColor(STYLES.colors.secondaryText)
          .fontSize(STYLES.sizes.caption)
          .font(STYLES.fonts.light)
          .text('Signature', x + 15, y + 25)
          .fillColor(STYLES.colors.primaryText)
          .fontSize(STYLES.sizes.body)
          .font(STYLES.fonts.body)
          .text('Printed Name: _________________', x + 15, y + 45, { width: sigBoxWidth - 30 })
          .text('Crew Role: _________________', x + 15, y + 65, { width: sigBoxWidth - 30 })
          .fillColor(STYLES.colors.secondaryText)
          .fontSize(STYLES.sizes.caption)
          .font(STYLES.fonts.light)
          .text('Date: _________________', x + 15, y + 80);
      }
    };

    if (sigY + sigBoxHeight > pageHeight - 200) {
      safeAddPage();
      const newY = STYLES.spacing.sectionTop + 40;
      const adjustedRow = Math.floor(i / 2);
      const adjustedY = newY + adjustedRow * (sigBoxHeight + sigSpacing);
      const adjustedX = margin + col * (sigBoxWidth + sigSpacing);
      drawBox(adjustedX, adjustedY);
    } else {
      drawBox(sigX, sigY);
    }
  }

  doc.y = sigBoxY + 2 * (sigBoxHeight + sigSpacing) + 30;
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
    'This report was generated through Riskmate and includes all safety, hazard, and control ' +
    'documentation submitted by the assigned crew. All data is timestamped and stored securely. ' +
    'This documentation serves as evidence of compliance with safety protocols and regulatory requirements.';

  const complianceTextHeight = doc.heightOfString(complianceText, {
    width: pageWidth - margin * 2 - 32,
    lineGap: 4,
  });

  const calloutY = doc.y;
  const calloutHeight = complianceTextHeight + 24;
  const calloutWidth = pageWidth - margin * 2;

  doc
    .roundedRect(margin, calloutY, calloutWidth, calloutHeight, 6)
    .fill(STYLES.colors.lightGrayBg)
    .stroke(STYLES.colors.borderGray)
    .lineWidth(1.5);

  doc
    .fillColor(STYLES.colors.secondaryText)
    .fontSize(STYLES.sizes.body)
    .font(STYLES.fonts.body)
    .text(complianceText, margin + 16, calloutY + 12, {
      width: calloutWidth - 32,
      lineGap: 4,
    });
}
