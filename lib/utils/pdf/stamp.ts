/**
 * PDF Stamping with pdf-lib
 * 
 * Stamps headers, footers, and watermarks onto existing PDF buffers.
 * Uses pdf-lib instead of PDFKit to avoid flow-mode pagination issues.
 * 
 * This function is called AFTER PDFKit generates the content-only PDF.
 */

import { PDFDocument, StandardFonts, rgb, degrees, PDFPage } from 'pdf-lib';

type StampOptions = {
  draft?: boolean;
  brand?: string;
  jobId?: string;
  reportTitle?: string;
  status?: string;
};

export async function stampPdf(input: Buffer, opts: StampOptions = {}): Promise<Buffer> {
  const pdf = await PDFDocument.load(input);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  
  // Embed bold font (fallback to regular if embedding fails)
  let fontBold = font;
  try {
    fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  } catch (err) {
    console.warn('[pdf-stamp] Failed to embed HelveticaBold, using regular font');
  }

  const pages = pdf.getPages();
  const total = pages.length;

  for (let i = 0; i < total; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();

    // Skip cover page (first page) - it has its own design
    const isCoverPage = i === 0;

    // --- Watermark (only on content pages, not cover) ---
    if (!isCoverPage) {
      const watermarkText = opts.draft ? 'DRAFT' : (opts.brand ?? 'RiskMate');
      const wmSize = opts.draft ? 72 : 64;
      const centerX = width / 2;
      const centerY = height / 2;

      // Calculate text width and height for proper centering
      // For DRAFT, ensure it's treated as a single word (no wrapping)
      const textWidth = font.widthOfTextAtSize(watermarkText, wmSize);
      const textHeight = font.heightAtSize(wmSize);
      
      // Draw watermark at center with rotation
      // Opacity max 0.02 for very subtle background texture (not competing with content)
      // DRAFT is drawn as single line - pdf-lib drawText doesn't wrap by default
      page.drawText(watermarkText, {
        x: centerX - textWidth / 2, // Explicitly center based on measured width
        y: centerY - textHeight / 2,
        size: wmSize,
        font,
        color: rgb(0, 0, 0),
        opacity: 0.02, // Max 0.02 opacity (same for DRAFT and brand)
        rotate: degrees(-45),
        // No width/lineBreak options - pdf-lib drawText doesn't wrap by default
      });
    }

    // --- Header (every page except cover) ---
    if (!isCoverPage) {
      const marginX = 48;
      const headerY = height - 36;

      // Left: Brand name (small)
      page.drawText(opts.brand ?? 'RiskMate', {
        x: marginX,
        y: headerY,
        size: 9,
        font: fontBold,
        color: rgb(0.145, 0.184, 0.251), // Cordovan-ish dark
        opacity: 0.9,
      });

      // Center: Report title (if provided)
      if (opts.reportTitle) {
        const titleWidth = font.widthOfTextAtSize(opts.reportTitle, 9);
        page.drawText(opts.reportTitle, {
          x: (width - titleWidth) / 2,
          y: headerY,
          size: 9,
          font,
          color: rgb(0.25, 0.25, 0.25),
          opacity: 0.9,
        });
      }

      // Right: Status chip (if provided)
      if (opts.status) {
        const statusText = opts.status.toUpperCase();
        const statusWidth = font.widthOfTextAtSize(statusText, 9);
        page.drawText(statusText, {
          x: width - marginX - statusWidth,
          y: headerY,
          size: 9,
          font,
          color: rgb(0.25, 0.25, 0.25),
          opacity: 0.9,
        });
      }

      // Header divider line
      page.drawLine({
        start: { x: marginX, y: headerY - 8 },
        end: { x: width - marginX, y: headerY - 8 },
        thickness: 0.5,
        color: rgb(0.9, 0.9, 0.9),
      });
    }

    // --- Footer (every page) ---
    const marginX = 48;
    const footerY = 24;

    // Left: "CONFIDENTIAL"
    page.drawText('CONFIDENTIAL', {
      x: marginX,
      y: footerY,
      size: 9,
      font,
      color: rgb(0.25, 0.25, 0.25),
      opacity: 0.9,
    });

    // Center: Job ID (if provided)
    if (opts.jobId && !isCoverPage) {
      const jobIdText = `Job ID: ${opts.jobId.substring(0, 8).toUpperCase()}`;
      const jobIdWidth = font.widthOfTextAtSize(jobIdText, 9);
      page.drawText(jobIdText, {
        x: (width - jobIdWidth) / 2,
        y: footerY,
        size: 9,
        font,
        color: rgb(0.25, 0.25, 0.25),
        opacity: 0.9,
      });
    }

    // Right: Page number
    const footerText = `Page ${i + 1} of ${total}`;
    const footerWidth = font.widthOfTextAtSize(footerText, 9);
    page.drawText(footerText, {
      x: width - marginX - footerWidth,
      y: footerY,
      size: 9,
      font,
      color: rgb(0.25, 0.25, 0.25),
      opacity: 0.9,
    });

    // Footer divider line
    if (!isCoverPage) {
      page.drawLine({
        start: { x: marginX, y: footerY + 12 },
        end: { x: width - marginX, y: footerY + 12 },
        thickness: 0.5,
        color: rgb(0.9, 0.9, 0.9),
      });
    }
  }

  const out = await pdf.save();
  return Buffer.from(out);
}

