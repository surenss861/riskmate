import PDFDocument from 'pdfkit';
import { STYLES } from '../styles';
import { addSectionHeader } from '../helpers';
import { formatTime, truncateText, categorizePhotos } from '../utils';
import type { JobDocumentAsset } from '../types';

export function renderPhotosSection(
  doc: PDFKit.PDFDocument,
  photos: JobDocumentAsset[],
  jobStartDate: string | null | undefined,
  jobEndDate: string | null | undefined,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  safeAddPage: (estimatedPages?: number) => void,
  estimatedTotalPages: number
) {
  const { before, during, after } = categorizePhotos(photos, jobStartDate, jobEndDate);

  const sections = [
    { title: 'Before Photos', photos: before },
    { title: 'During Job Photos', photos: during },
    { title: 'After Photos', photos: after },
  ];

  sections.forEach((section) => {
    if (!section.photos.length) return;

    safeAddPage(estimatedTotalPages);
    addSectionHeader(doc, section.title);

    const gridY = doc.y;
    const imagesPerRow = 3;
    const imageWidth =
      (pageWidth - margin * 2 - STYLES.spacing.imagePadding * 2) / 3;
    const imageHeight = 160;
    const gutter = STYLES.spacing.imagePadding;

    let x = margin;
    let y = gridY;

    section.photos.forEach((photo, index) => {
      if (index > 0 && index % imagesPerRow === 0) {
        x = margin;
        y += imageHeight + 80;

        if (y + imageHeight > pageHeight - 100) {
          safeAddPage(estimatedTotalPages);
          // Reset position for photo grid continuation
          doc.y = STYLES.spacing.sectionTop + 40;
          y = doc.y;
          x = margin; // Reset x position for new row
        }
      }

      try {
        doc
          .rect(x - 2, y - 2, imageWidth + 4, imageHeight + 4)
          .stroke(STYLES.colors.borderGray)
          .lineWidth(1);

        if (photo.buffer && photo.buffer.length > 100) {
          const isJPEG =
            photo.buffer[0] === 0xff && photo.buffer[1] === 0xd8;
          const isPNG =
            photo.buffer[0] === 0x89 &&
            photo.buffer[1] === 0x50 &&
            photo.buffer[2] === 0x4e &&
            photo.buffer[3] === 0x47;

          if (!isJPEG && !isPNG) {
            throw new Error('Unsupported image format (only JPEG/PNG supported)');
          }

          try {
            doc.image(photo.buffer, x, y, {
              fit: [imageWidth, imageHeight],
              align: 'center',
              valign: 'center',
            });
          } catch (imageError: any) {
            console.warn('Image format not supported:', imageError?.message);
            throw new Error('Unsupported image format');
          }
        } else {
          throw new Error('Empty or invalid image buffer');
        }
      } catch (error) {
        console.warn('Failed to render photo in PDF:', error);

        doc
          .rect(x, y, imageWidth, imageHeight)
          .fill(STYLES.colors.lightGrayBg)
          .stroke(STYLES.colors.borderGray)
          .lineWidth(1.5);

        doc
          .fillColor(STYLES.colors.secondaryText)
          .fontSize(24)
          .font(STYLES.fonts.body)
          .text('[IMG]', x + imageWidth / 2 - 20, y + imageHeight / 2 - 12);

        doc
          .fillColor(STYLES.colors.secondaryText)
          .fontSize(STYLES.sizes.caption)
          .font(STYLES.fonts.light)
          .text('Photo', x + imageWidth / 2 - 15, y + imageHeight / 2 + 5);
      }

      const caption = photo.description || `Photo ${index + 1}`;
      doc
        .fillColor(STYLES.colors.primaryText)
        .fontSize(STYLES.sizes.caption)
        .font(STYLES.fonts.body)
        .text(truncateText(caption, 40), x, y + imageHeight + 8, {
          width: imageWidth,
        });

      if (photo.created_at) {
        doc
          .fillColor(STYLES.colors.secondaryText)
          .fontSize(STYLES.sizes.caption)
          .font(STYLES.fonts.light)
          .text(formatTime(photo.created_at), x, y + imageHeight + 20, {
            width: imageWidth,
          });
      }

      x += imageWidth + gutter;
    });
  });
}

