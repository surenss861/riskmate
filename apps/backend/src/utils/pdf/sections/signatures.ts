import PDFDocument from 'pdfkit';
import { STYLES } from '../styles';
import { addSectionHeader } from '../helpers';
import { formatDate } from '../utils';
import { drawSignatureSvgPath } from '../../../../../../lib/utils/pdf/signatureHelpers';
import { validateSignatureSvg } from '../../../../../../lib/utils/signatureValidation';
import { supabase } from '../../../lib/supabaseClient';

/** Signature data for PDF rendering (run's report_signatures) */
export interface PdfSignatureData {
  signer_name: string;
  signer_title: string;
  signature_role: 'prepared_by' | 'reviewed_by' | 'approved_by' | 'other';
  signature_svg: string;
  signed_at: string;
  signature_hash?: string | null;
}

/** Optional: inject a custom fetcher for signatures (e.g. for tests). When omitted, uses Supabase. */
export type FetchSignaturesForRun = (reportRunId: string) => Promise<PdfSignatureData[]>;

const ROLE_LABELS: Record<string, string> = {
  prepared_by: 'Prepared By',
  reviewed_by: 'Reviewed By',
  approved_by: 'Approved By',
  other: 'Signature',
};

/** Required roles in display order; placeholders shown for missing roles */
const REQUIRED_ROLES: (keyof typeof ROLE_LABELS)[] = ['prepared_by', 'reviewed_by', 'approved_by'];

async function defaultFetchSignaturesForRun(reportRunId: string): Promise<PdfSignatureData[]> {
  const { data, error } = await supabase
    .from('report_signatures')
    .select('signer_name, signer_title, signature_role, signature_svg, signed_at, signature_hash')
    .eq('report_run_id', reportRunId)
    .is('revoked_at', null)
    .order('signed_at', { ascending: true });

  if (error) {
    console.warn('Failed to fetch signatures for PDF:', error);
    return [];
  }
  if (!data?.length) return [];
  return data.map((row: any) => ({
    signer_name: row.signer_name,
    signer_title: row.signer_title,
    signature_role: row.signature_role,
    signature_svg: row.signature_svg,
    signed_at: row.signed_at,
    signature_hash: row.signature_hash,
  }));
}

/**
 * Renders Signatures & Compliance section.
 * When reportRunId is provided, fetches signatures from report_signatures for that run
 * (revoked_at IS NULL, order by signed_at) and uses them; otherwise uses the optional
 * signatures array. Optional fetchSignaturesForRun overrides the default Supabase query.
 */
export async function renderSignaturesAndCompliance(
  doc: PDFKit.PDFDocument,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  safeAddPage: (estimatedPages?: number) => void,
  estimatedTotalPages: number,
  options?: {
    reportRunId?: string;
    signatures?: PdfSignatureData[];
    fetchSignaturesForRun?: FetchSignaturesForRun;
  }
): Promise<void> {
  let signatures: PdfSignatureData[] | undefined;
  if (options?.reportRunId) {
    const fetchFn = options.fetchSignaturesForRun ?? defaultFetchSignaturesForRun;
    signatures = await fetchFn(options.reportRunId);
  } else {
    signatures = options?.signatures;
  }

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
  let currentPageStartY = sigBoxY;
  let rowOnCurrentPage = 0;
  // Map signatures by role; use fixed slots for required roles, placeholders for missing
  const signaturesByRole = new Map<string, PdfSignatureData>();
  if (signatures?.length) {
    for (const s of signatures) {
      if (s?.signature_role) signaturesByRole.set(s.signature_role, s);
    }
  }
  const slots = REQUIRED_ROLES.map((role) => ({ role, sig: signaturesByRole.get(role) }));
  
  // Append any signatures with role='other' (or additional signatures per role)
  if (signatures?.length) {
    for (const s of signatures) {
      if (s?.signature_role === 'other') {
        slots.push({ role: 'other', sig: s });
      }
    }
  }
  
  const count = Math.max(slots.length, 4);

  for (let i = 0; i < count; i++) {
    const slot = slots[i];
    const sig = slot?.sig;
    const role = slot?.role ?? 'other';
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

        const signatureValid = sigValidation?.valid ?? false;
        const signatureInvalid = sigValidation && !sigValidation.valid;

        if (sig.signature_svg && signatureValid) {
          const pathBoxX = x + 15;
          const pathBoxY = y + 56;
          const pathBoxW = sigBoxWidth - 30;
          const pathBoxH = 22;
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

        if (signatureInvalid) {
          doc
            .fillColor(STYLES.colors.riskCritical)
            .fontSize(STYLES.sizes.caption)
            .font(STYLES.fonts.body)
            .text('Signature invalid or unavailable', x + 15, y + 58, { width: sigBoxWidth - 30 });
        } else {
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

  doc.y = doc.y + 40;

  const complianceText =
    'This report was generated through Riskmate and includes all safety, hazard, and control ' +
    'documentation submitted by the assigned crew. All data is timestamped and stored securely. ' +
    'This documentation serves as evidence of compliance with safety protocols and regulatory requirements.';

  // Projected height of Compliance Statement (title + gap + text)
  doc.fontSize(STYLES.sizes.h3).font(STYLES.fonts.header);
  const titleHeight = doc.heightOfString('Compliance Statement', {
    width: pageWidth - margin * 2,
  });
  doc.fontSize(STYLES.sizes.body).font(STYLES.fonts.light);
  const textHeight = doc.heightOfString(complianceText, {
    width: pageWidth - margin * 2,
    lineGap: 4,
  });
  const projectedHeight = titleHeight + 24 + textHeight;
  const footerSpace = 60;
  const printableBottom = pageHeight - margin - footerSpace;
  if (doc.y + projectedHeight > printableBottom) {
    safeAddPage(estimatedTotalPages);
  }

  const complianceY = doc.y;

  doc
    .fillColor(STYLES.colors.primaryText)
    .fontSize(STYLES.sizes.h3)
    .font(STYLES.fonts.header)
    .text('Compliance Statement', margin, complianceY);

  doc
    .fillColor(STYLES.colors.secondaryText)
    .fontSize(STYLES.sizes.body)
    .font(STYLES.fonts.light)
    .text(complianceText, margin, complianceY + 24, {
      width: pageWidth - margin * 2,
      lineGap: 4,
    });
}
