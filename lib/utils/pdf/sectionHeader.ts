import PDFDocument from 'pdfkit';
import { STYLES } from './styles';

/**
 * Section header (used during content rendering).
 * Kept in a separate module with no @/ deps so shared sections can be used by backend.
 */
export function addSectionHeader(doc: PDFKit.PDFDocument, title: string, prefix?: string): void {
  const margin = STYLES.spacing.pageMargin;

  doc.y = STYLES.spacing.sectionTop;

  const titleText = prefix ? `${prefix} ${title}` : title;
  doc
    .fillColor(STYLES.colors.primaryText)
    .fontSize(STYLES.sizes.h2)
    .font(STYLES.fonts.header)
    .text(titleText, { align: 'left' });

  const underlineY = doc.y - 4;
  doc
    .strokeColor(STYLES.colors.accent)
    .lineWidth(2)
    .moveTo(margin, underlineY)
    .lineTo(margin + 100, underlineY)
    .stroke();

  doc
    .strokeColor(STYLES.colors.divider)
    .lineWidth(0.5)
    .moveTo(margin, underlineY + 8)
    .lineTo(doc.page.width - margin, underlineY + 8)
    .stroke();

  doc.moveDown(1.5);
}
