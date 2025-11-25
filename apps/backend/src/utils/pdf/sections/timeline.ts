import PDFDocument from 'pdfkit';
import { STYLES } from '../styles';
import { addSectionHeader, groupTimelineEvents } from '../helpers';
import type { AuditLogEntry } from '../types';

export function renderTimeline(
  doc: PDFDocument,
  auditLogs: AuditLogEntry[],
  pageWidth: number,
  pageHeight: number,
  margin: number,
  safeAddPage: (estimatedPages?: number) => void,
  estimatedTotalPages: number
) {
  const groupedTimeline = groupTimelineEvents(auditLogs);
  if (!groupedTimeline.length) return;

  safeAddPage(estimatedTotalPages);
  addSectionHeader(doc, 'Job Log Timeline');

  let timelineY = doc.y;
  const lineX = margin + 25;
  const textX = margin + 50;

  groupedTimeline.forEach((event, index) => {
    if (doc.y > pageHeight - 100) {
      safeAddPage(estimatedTotalPages);
      // Don't re-add header, just reset position for timeline continuation
      doc.y = STYLES.spacing.sectionTop + 40;
    }
    timelineY = doc.y;

    if (index < groupedTimeline.length - 1) {
      doc
        .strokeColor(STYLES.colors.accent)
        .lineWidth(1)
        .moveTo(lineX, timelineY + 8)
        .lineTo(lineX, timelineY + 45)
        .stroke();
    }

    doc
      .circle(lineX, timelineY + 8, 5)
      .fill(STYLES.colors.accent);

    let timeText = event.time;
    if (event.timeEnd && event.time !== event.timeEnd) {
      const startTime = event.time.replace(' AM', '').replace(' PM', '');
      const endTime = event.timeEnd.replace(' AM', '').replace(' PM', '');
      const amPm = event.time.includes('AM') ? 'AM' : 'PM';
      timeText = `${startTime}-${endTime} ${amPm}`;
    }

    doc
      .fillColor(STYLES.colors.primaryText)
      .fontSize(STYLES.sizes.body)
      .font(STYLES.fonts.header)
      .text(timeText, textX, timelineY);

    doc
      .fillColor(STYLES.colors.secondaryText)
      .fontSize(STYLES.sizes.body)
      .font(STYLES.fonts.body)
      .text(event.description, textX, timelineY + 14, {
        width: pageWidth - textX - margin,
      });

    doc
      .fillColor(STYLES.colors.secondaryText)
      .fontSize(STYLES.sizes.caption)
      .font(STYLES.fonts.light)
      .text(`by ${event.actorName}`, textX, timelineY + 26);

    timelineY += 50;
  });
}

