import PDFDocument from 'pdfkit';
import { STYLES } from '../styles';
import { addSectionHeader } from '../helpers';
import { formatDate } from '../utils';

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

/** Required roles in display order; placeholders shown for missing roles */
const REQUIRED_ROLES: (keyof typeof ROLE_LABELS)[] = ['prepared_by', 'reviewed_by', 'approved_by'];

/** Extract first path d attribute from SVG string */
function extractPathD(svg: string): string | null {
  if (!svg || typeof svg !== 'string') return null;
  const match = svg.match(/d\s*=\s*["']([^"']+)["']/i);
  return match ? match[1].trim() : null;
}

/** Parse viewBox from SVG to get width/height for scaling (e.g. viewBox="0 0 400 100") */
function getViewBox(svg: string): { w: number; h: number } | null {
  const match = svg.match(/viewBox\s*=\s*["']?\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)["']?/i);
  if (!match) return null;
  const w = parseFloat(match[1]);
  const h = parseFloat(match[2]);
  return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? { w, h } : null;
}

/**
 * Draw signature SVG path into the given box. Path is scaled to fit.
 * PDFKit accepts SVG path syntax in .path().
 */
function drawSignatureSvgPath(
  doc: PDFKit.PDFDocument,
  signatureSvg: string,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number
): void {
  const pathD = extractPathD(signatureSvg);
  if (!pathD) return;

  const viewBox = getViewBox(signatureSvg);
  const srcW = viewBox?.w ?? 400;
  const srcH = viewBox?.h ?? 100;
  const pad = 2;
  const scaleX = (boxW - pad * 2) / srcW;
  const scaleY = (boxH - pad * 2) / srcH;
  const scale = Math.min(scaleX, scaleY, 1.2);
  const offsetX = boxX + pad + (boxW - pad * 2 - srcW * scale) / 2;
  const offsetY = boxY + pad + (boxH - pad * 2 - srcH * scale) / 2;

  doc.save();
  doc.translate(offsetX, offsetY);
  doc.scale(scale);
  doc
    .strokeColor(STYLES.colors.primaryText)
    .lineWidth(1);
  try {
    doc.path(pathD).stroke();
  } catch {
    // If path() throws (malformed d), skip drawing
  }
  doc.restore();
}

/**
 * Renders Signatures & Compliance section.
 * When signatures array is provided, maps by role and renders each signature's SVG path(s),
 * signer name/title, signed_at, and signature_hash. Placeholders only for missing roles.
 */
export function renderSignaturesAndCompliance(
  doc: PDFKit.PDFDocument,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  safeAddPage: (estimatedPages?: number) => void,
  estimatedTotalPages: number,
  signatures?: PdfSignatureData[]
) {
  safeAddPage(estimatedTotalPages);
  addSectionHeader(doc, 'Signatures & Compliance');

  doc
    .fillColor(STYLES.colors.primaryText)
    .fontSize(STYLES.sizes.h3)
    .font(STYLES.fonts.header)
    .text('Crew Signatures', { align: 'left' });

  doc.moveDown(0.5);

  const sigBoxY = doc.y;
  const sigBoxHeight = 100;
  const sigBoxWidth = (pageWidth - margin * 2 - 20) / 2;
  const sigSpacing = 20;
  // Map signatures by role; use fixed slots for required roles, placeholders for missing
  const signaturesByRole = new Map<string, PdfSignatureData>();
  if (signatures?.length) {
    for (const s of signatures) {
      if (s?.signature_role) signaturesByRole.set(s.signature_role, s);
    }
  }
  const slots = REQUIRED_ROLES.map((role) => ({ role, sig: signaturesByRole.get(role) }));
  const count = Math.max(slots.length, 4);

  for (let i = 0; i < count; i++) {
    const slot = slots[i];
    const sig = slot?.sig;
    const role = slot?.role ?? 'other';
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
        const roleLabel = ROLE_LABELS[role] ?? role;
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
          .text(sig.signer_name, x + 15, y + 40, { width: sigBoxWidth - 30 })
          .text(sig.signer_title, x + 15, y + 54, { width: sigBoxWidth - 30 });

        // Render actual signature SVG path(s) in place of placeholder
        if (sig.signature_svg) {
          const pathBoxX = x + 15;
          const pathBoxY = y + 56;
          const pathBoxW = sigBoxWidth - 30;
          const pathBoxH = 22;
          drawSignatureSvgPath(doc, sig.signature_svg, pathBoxX, pathBoxY, pathBoxW, pathBoxH);
        }

        doc
          .fillColor(STYLES.colors.secondaryText)
          .fontSize(STYLES.sizes.caption)
          .font(STYLES.fonts.light)
          .text(`Signed: ${dateStr}`, x + 15, y + 80, { width: sigBoxWidth - 30 });
        if (hashStr) {
          doc
            .fillColor(STYLES.colors.secondaryText)
            .fontSize(8)
            .font(STYLES.fonts.light)
            .text(`Hash: ${hashStr}`, x + 15, y + 90, { width: sigBoxWidth - 30 });
        }
      } else {
        doc
          .fillColor(STYLES.colors.secondaryText)
          .fontSize(STYLES.sizes.caption)
          .font(STYLES.fonts.light)
          .text(ROLE_LABELS[role] ?? 'Signature', x + 15, y + 25)
          .fillColor(STYLES.colors.primaryText)
          .fontSize(STYLES.sizes.body)
          .font(STYLES.fonts.body)
          .text('Printed Name: _________________', x + 15, y + 50, { width: sigBoxWidth - 30 })
          .text('Crew Role: _________________', x + 15, y + 70, { width: sigBoxWidth - 30 })
          .fillColor(STYLES.colors.secondaryText)
          .fontSize(STYLES.sizes.caption)
          .font(STYLES.fonts.light)
          .text('Date: _________________', x + 15, y + 85);
      }
    };

    if (sigY + sigBoxHeight > pageHeight - 200) {
      safeAddPage(estimatedTotalPages);
      const newY = STYLES.spacing.sectionTop + 40;
      const adjustedRow = Math.floor(i / 2);
      const adjustedY = newY + adjustedRow * (sigBoxHeight + sigSpacing);
      const adjustedX = margin + col * (sigBoxWidth + sigSpacing);
      drawBox(adjustedX, adjustedY);
    } else {
      drawBox(sigX, sigY);
    }
  }

  doc.y = sigBoxY + 2 * (sigBoxHeight + sigSpacing) + 40;
  const complianceY = doc.y;

  doc
    .fillColor(STYLES.colors.primaryText)
    .fontSize(STYLES.sizes.h3)
    .font(STYLES.fonts.header)
    .text('Compliance Statement', margin, complianceY);

  const complianceText =
    'This report was generated through Riskmate and includes all safety, hazard, and control ' +
    'documentation submitted by the assigned crew. All data is timestamped and stored securely. ' +
    'This documentation serves as evidence of compliance with safety protocols and regulatory requirements.';

  doc
    .fillColor(STYLES.colors.secondaryText)
    .fontSize(STYLES.sizes.body)
    .font(STYLES.fonts.light)
    .text(complianceText, margin, complianceY + 24, {
      width: pageWidth - margin * 2,
      lineGap: 4,
    });
}
