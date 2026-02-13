import PDFDocument from 'pdfkit';
import { STYLES } from '../styles';
import { addSectionHeader } from '../sectionHeader';
import { formatDate } from '../formatDate';
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

/** Options for the shared Signatures & Compliance section */
export interface RenderSignaturesOptions {
  /** When set, renders "Prepared by Riskmate" and "Document ID: ..." above Crew Signatures */
  documentId?: string;
  /** When set, passed to safeAddPage(estimatedTotalPages) for footer page numbering */
  estimatedTotalPages?: number;
}

const ROLE_LABELS: Record<string, string> = {
  prepared_by: 'Prepared By',
  reviewed_by: 'Reviewed By',
  approved_by: 'Approved By',
  other: 'Signature',
};

const REQUIRED_ROLES: Array<'prepared_by' | 'reviewed_by' | 'approved_by'> = [
  'prepared_by',
  'reviewed_by',
  'approved_by',
];

/**
 * Signatures & Compliance - shared implementation for web and backend PDF generators.
 * Renders layout, validation, SVG via drawSignatureSvgPath. Callers supply signatures
 * (e.g. from report_signatures for a run). Optional documentId shows "Prepared by Riskmate" / Document ID.
 */
export function renderSignaturesAndCompliance(
  doc: PDFKit.PDFDocument,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  safeAddPage: (estimatedPages?: number) => void,
  signatures: PdfSignatureData[],
  options?: RenderSignaturesOptions
): void {
  const addPage = () => {
    if (options?.estimatedTotalPages != null) {
      safeAddPage(options.estimatedTotalPages);
    } else {
      safeAddPage();
    }
  };

  addPage();
  addSectionHeader(doc, 'Signatures & Compliance');

  if (options?.documentId != null) {
    doc
      .fillColor(STYLES.colors.secondaryText)
      .fontSize(9)
      .font(STYLES.fonts.body)
      .text('Prepared by Riskmate', margin, doc.y)
      .text(`Document ID: ${options.documentId.substring(0, 8).toUpperCase()}`, margin, doc.y + 12);
    doc.moveDown(2);
  }

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

  const sigsByRole = new Map<string, PdfSignatureData>();
  for (const sig of signatures) {
    sigsByRole.set(sig.signature_role, sig);
  }

  const slots: Array<PdfSignatureData | { role: string; placeholder: true }> = [];
  for (const role of REQUIRED_ROLES) {
    const sig = sigsByRole.get(role);
    if (sig) slots.push(sig);
    else slots.push({ role, placeholder: true });
  }
  for (const sig of signatures) {
    if (sig.signature_role === 'other') slots.push(sig);
  }

  const count = slots.length;
  let currentPageStartY = sigBoxY;
  let rowOnCurrentPage = 0;

  for (let i = 0; i < count; i++) {
    const slot = slots[i];
    const sig = 'placeholder' in slot ? undefined : slot;
    const col = i % 2;
    const sigValidation = sig?.signature_svg ? validateSignatureSvg(sig.signature_svg) : null;

    const sigY = currentPageStartY + rowOnCurrentPage * (sigBoxHeight + sigSpacing);
    const sigX = margin + col * (sigBoxWidth + sigSpacing);

    const drawBox = (x: number, y: number) => {
      let boxFill = STYLES.colors.sectionBg;
      let boxStroke = STYLES.colors.borderGray;
      if (sigValidation && !sigValidation.valid) {
        boxFill = STYLES.colors.accentLight;
        boxStroke = STYLES.colors.riskCritical;
      }
      doc
        .rect(x, y, sigBoxWidth, sigBoxHeight)
        .fill(boxFill)
        .strokeColor(boxStroke)
        .lineWidth(1.5)
        .stroke();

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

        const signatureValid = sigValidation?.valid ?? false;
        const signatureInvalid = sigValidation && !sigValidation.valid;

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

        if (sig.signature_svg && signatureValid) {
          drawSignatureSvgPath(
            doc,
            sig.signature_svg,
            x + 15,
            y + 54,
            sigBoxWidth - 30,
            16,
            STYLES.colors.primaryText,
            1
          );
        }

        if (signatureInvalid) {
          doc
            .fillColor(STYLES.colors.riskCritical)
            .fontSize(STYLES.sizes.caption)
            .font(STYLES.fonts.body)
            .text('Signature invalid or unavailable', x + 15, y + 54, { width: sigBoxWidth - 30 });
        } else {
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
          if (signatureValid) {
            doc
              .fillColor(STYLES.colors.secondaryText)
              .fontSize(8)
              .font(STYLES.fonts.light)
              .text('Signature captured (SVG on file)', x + 15, y + 86, { width: sigBoxWidth - 30 });
          }
        }
      } else {
        const placeholderSlot = slots[i];
        const roleLabel =
          'placeholder' in placeholderSlot && placeholderSlot.role
            ? ROLE_LABELS[placeholderSlot.role] ?? 'Signature'
            : 'Signature';

        doc
          .fillColor(STYLES.colors.secondaryText)
          .fontSize(STYLES.sizes.caption)
          .font(STYLES.fonts.light)
          .text(roleLabel, x + 15, y + 25)
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
      addPage();
      currentPageStartY = STYLES.spacing.sectionTop + 40;
      rowOnCurrentPage = 0;
      const newSigY = currentPageStartY;
      const newSigX = margin + col * (sigBoxWidth + sigSpacing);
      drawBox(newSigX, newSigY);
      doc.y = newSigY + sigBoxHeight;
    } else {
      drawBox(sigX, sigY);
      doc.y = sigY + sigBoxHeight;
    }

    if (col === 1) {
      rowOnCurrentPage++;
    }
  }

  doc.y = doc.y + 30;
  const complianceY = doc.y;

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
