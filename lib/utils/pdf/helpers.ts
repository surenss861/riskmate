import PDFDocument from 'pdfkit';
import { STYLES } from './styles';
import type { OrganizationData, AuditLogEntry } from './types';
import { formatTime, truncateText } from './utils';

// Draw header, footer, and watermark on a single page - ALL with explicit x,y coordinates
// This function is called AFTER doc.switchToPage(i), so we use the current page's dimensions
// CRITICAL: All operations must use absolute x,y coordinates - no cursor usage, no flow mode
export function drawHeaderFooterAndWatermark(
  doc: PDFKit.PDFDocument,
  organization: OrganizationData,
  jobId: string,
  reportGeneratedAt: Date,
  pageNumber: number,
  totalPages: number,
  isDraft: boolean
) {
  // Get current page dimensions AFTER switchToPage()
  const { width, height } = doc.page;
  const marginX = STYLES.spacing.pageMargin;
  
  // CLAMP footer Y to prevent edge-of-page auto pagination
  // PDFKit will trigger addPage() if text goes too close to bottom margin
  const bottomMargin = doc.page.margins.bottom || 60;
  const lineHeight = 12; // Approximate line height for footer text
  const maxSafeY = height - bottomMargin - lineHeight - 2; // Extra 2pt buffer
  const requestedFooterY = height - 36;
  const footerY = Math.min(requestedFooterY, maxSafeY);

  // Outer save to protect all drawing
  doc.save();

  // Footer divider line (absolute position) - this should never cause page breaks
  doc
    .strokeColor(STYLES.colors.divider)
    .lineWidth(0.5)
    .moveTo(marginX, footerY)
    .lineTo(width - marginX, footerY)
    .stroke();

  // Footer: "Riskmate" (left) - explicit x, y with large width and no line breaks
  doc
    .fillColor(STYLES.colors.accent)
    .fontSize(10)
    .font(STYLES.fonts.header)
    .text('Riskmate', marginX, footerY + 8, {
      width: 240,
      lineBreak: false,
    });

  // Footer: "CONFIDENTIAL" (center) - manually centered (no align option to avoid bounding box issues)
  // Calculate text width and center manually
  doc.fontSize(STYLES.sizes.caption);
  doc.font(STYLES.fonts.light);
  const confidentialText = 'CONFIDENTIAL - For Internal Use Only';
  const textWidth = doc.widthOfString(confidentialText);
  const confidentialX = (width - textWidth) / 2;
  doc
    .fillColor(STYLES.colors.secondaryText)
    .text(confidentialText, confidentialX, footerY + 8, {
      lineBreak: false,
    });

  // Footer: Page number (right) - manually right-aligned (no align option)
  const safeTotalPages = Math.max(totalPages, 1);
  const safePageNum = Math.max(pageNumber, 1);
  const pageText = `Page ${safePageNum} of ${safeTotalPages}`;
  doc.fontSize(STYLES.sizes.caption);
  doc.font(STYLES.fonts.body);
  const pageTextWidth = doc.widthOfString(pageText);
  const pageTextX = width - marginX - pageTextWidth;
  doc
    .fillColor(STYLES.colors.secondaryText)
    .text(pageText, pageTextX, footerY + 8, {
      lineBreak: false,
    });

  // Watermark (draw AFTER footer to ensure it's in background)
  // Use save/restore around transformations to isolate coordinate space
  if (isDraft) {
    const centerX = width / 2;
    const centerY = height / 2;

    doc.save(); // Isolate transform state
    doc.opacity(0.05); // Very subtle - background texture
    
    // Manual transform: translate to center, rotate, then draw at (0,0) in transformed space
    // This avoids issues with origin parameter causing bounding box miscalculations
    doc.translate(centerX, centerY);
    doc.rotate(-45);
    
    // Draw watermark text at (0,0) in transformed space (which is center of page in original space)
    // Use explicit width and no line breaks, NO align (just use x=0 which is center after translate)
    doc
      .font(STYLES.fonts.header)
      .fontSize(72)
      .fillColor('#FF6B35')
      .text('DRAFT', -100, -36, { // x=-100 to center 200px wide text (72pt font ~100px wide, so ~100px offset)
        width: 200,
        lineBreak: false,
      });
    
    doc.restore(); // Restore transform state
  } else {
    // Regular watermark (very subtle background texture)
    const centerX = width / 2;
    const centerY = height / 2;

    doc.save(); // Isolate opacity state
    doc.opacity(0.04); // Very subtle
    
    // Draw watermark text with explicit x, y (no transforms)
    // Use large width and no line breaks to prevent wrapping
    doc
      .fillColor(STYLES.colors.watermark)
      .fontSize(72)
      .font(STYLES.fonts.light)
      .text('Riskmate', centerX - 100, centerY - 36, { // x offset to center (approx half text width)
        width: 200,
        lineBreak: false,
      });
    
    doc.restore(); // Restore opacity state
  }

  doc.restore(); // Restore outer state
}

// Section header (used during content rendering, not post-pass)
export function addSectionHeader(doc: PDFKit.PDFDocument, title: string, prefix?: string): void {
  const margin = STYLES.spacing.pageMargin;

  // Move to section top (normalized spacing)
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

// Timeline grouping
export function groupTimelineEvents(
  auditLogs: AuditLogEntry[]
): Array<{
  time: string;
  timeEnd?: string;
  description: string;
  actorName: string;
  count?: number;
}> {
  const meaningfulEvents = new Set([
    'job.created',
    'job.updated',
    'document.uploaded',
    'mitigation.completed',
    'mitigation.reopened',
    'report.generated',
  ]);

  const filtered = auditLogs.filter((log) => meaningfulEvents.has(log.event_name));

  const eventGroups = new Map<string, AuditLogEntry[]>();

  filtered.forEach((log) => {
    const eventType = log.event_name;
    const time = new Date(log.created_at).getTime();

    let key: string;
    if (eventType === 'document.uploaded') {
      const window = Math.floor(time / (5 * 60 * 1000)); // 5 min
      key = `upload-${window}`;
    } else if (eventType === 'report.generated') {
      key = 'report-generated';
    } else {
      const window = Math.floor(time / (10 * 60 * 1000)); // 10 min
      key = `${eventType}-${window}`;
    }

    if (!eventGroups.has(key)) {
      eventGroups.set(key, []);
    }
    eventGroups.get(key)!.push(log);
  });

  const result: Array<{
    time: string;
    timeEnd?: string;
    description: string;
    actorName: string;
    count?: number;
  }> = [];

  const sortedGroups = Array.from(eventGroups.entries()).sort((a, b) => {
    const aTime = Math.min(...a[1].map((l) => new Date(l.created_at).getTime()));
    const bTime = Math.min(...b[1].map((l) => new Date(l.created_at).getTime()));
    return aTime - bTime;
  });

  sortedGroups.forEach(([, logs]) => {
    if (!logs.length) return;

    logs.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const firstLog = logs[0];
    const count = logs.length;
    const eventType = firstLog.event_name;
    const actorName = firstLog.actor_name || firstLog.actor_email || 'System';

    let description = '';
    let timeStr = formatTime(firstLog.created_at);
    let timeEndStr: string | undefined;

    if (count > 1) {
      const times = logs
        .map((l) => new Date(l.created_at).getTime())
        .sort((a, b) => a - b);

      const earliestTime = new Date(times[0]);
      const latestTime = new Date(times[times.length - 1]);

      if (earliestTime.getTime() < latestTime.getTime()) {
        timeStr = formatTime(earliestTime.toISOString());
        timeEndStr = formatTime(latestTime.toISOString());
      }
    }

    switch (eventType) {
      case 'job.created':
        description = 'Job created';
        break;
      case 'job.updated':
        description =
          count > 1 ? `Job details updated (${count} times)` : 'Job details updated';
        break;
      case 'document.uploaded':
        if (count === 1) {
          description = `Document uploaded: ${truncateText(
            firstLog.metadata?.name || 'a file',
            40
          )}`;
        } else {
          description = `${count} documents uploaded`;
        }
        break;
      case 'mitigation.completed':
        description =
          count > 1 ? `Mitigations completed (${count} items)` : 'Mitigation completed';
        break;
      case 'mitigation.reopened':
        description =
          count > 1 ? `Mitigations reopened (${count} items)` : 'Mitigation reopened';
        break;
      case 'report.generated':
        description =
          count > 1 ? `${count} report versions generated` : 'Report generated';
        break;
      default:
        description = count > 1 ? `${eventType} (${count} times)` : eventType;
    }

    result.push({
      time: timeStr,
      timeEnd: timeEndStr,
      description,
      actorName,
      count: count > 1 ? count : undefined,
    });
  });

  return result.sort((a, b) => {
    const aTime =
      auditLogs.find((l) => formatTime(l.created_at) === a.time)?.created_at || '';
    const bTime =
      auditLogs.find((l) => formatTime(l.created_at) === b.time)?.created_at || '';
    return new Date(aTime).getTime() - new Date(bTime).getTime();
  });
}

// Legacy functions - DEPRECATED, use drawHeaderFooterAndWatermark instead
// Keeping for backward compatibility but they should not be used in post-pass
export function addWatermark(doc: PDFKit.PDFDocument) {
  // This should not be used in post-pass
  console.warn('addWatermark is deprecated, use drawHeaderFooterAndWatermark instead');
}

export function addDraftWatermark(doc: PDFKit.PDFDocument) {
  // This should not be used in post-pass
  console.warn('addDraftWatermark is deprecated, use drawHeaderFooterAndWatermark instead');
}

export function addFooterInline(
  doc: PDFKit.PDFDocument,
  organization: OrganizationData,
  jobId: string,
  reportGeneratedAt: Date,
  pageNumber: number,
  totalPages: number
) {
  // This should not be used in post-pass
  console.warn('addFooterInline is deprecated, use drawHeaderFooterAndWatermark instead');
  drawHeaderFooterAndWatermark(doc, organization, jobId, reportGeneratedAt, pageNumber, totalPages, false);
}
