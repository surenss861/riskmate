import PDFDocument from 'pdfkit';
import { STYLES } from './styles';
import type { OrganizationData, AuditLogEntry } from './types';
import { formatTime, truncateText } from './utils';

// Watermark
export function addWatermark(doc: PDFKit.PDFDocument) {
  doc
    .fillColor(STYLES.colors.watermark)
    .fontSize(72)
    .font(STYLES.fonts.light);

  doc
    .opacity(0.05)
    .text('RiskMate', doc.page.width / 2, doc.page.height / 2, {
      align: 'center',
      width: 200,
      lineBreak: false,
    })
    .opacity(1.0);
}

// DRAFT Watermark (diagonal, consistent across pages) - Draw-only function (never calls addPage)
export function addDraftWatermark(doc: PDFKit.PDFDocument) {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  
  // Save current state
  const savedY = doc.y;
  
  doc.save();
  doc.opacity(0.15);
  doc.fillColor('#FF6B35'); // Orange for draft
  doc.fontSize(72);
  doc.font(STYLES.fonts.header);
  
  // Rotate 45 degrees and center
  doc.translate(pageWidth / 2, pageHeight / 2);
  doc.rotate(-45);
  doc.text('DRAFT', 0, 0, {
    align: 'center',
    width: 400,
    lineBreak: false, // Prevent wrapping
  });
  
  doc.restore(); // restore() handles opacity restoration
  
  // Restore original y position
  doc.y = savedY;
}

// Section header
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

// Footer - Draw-only function (never calls addPage)
export function addFooterInline(
  doc: PDFKit.PDFDocument,
  organization: OrganizationData,
  jobId: string,
  reportGeneratedAt: Date,
  pageNumber: number,
  totalPages: number
) {
  const margin = STYLES.spacing.pageMargin;
  const footerY = doc.page.height - 40;

  // Save current y position to restore after drawing footer
  const savedY = doc.y;

  // Draw footer divider line
  doc
    .strokeColor(STYLES.colors.divider)
    .lineWidth(0.5)
    .moveTo(margin, footerY)
    .lineTo(doc.page.width - margin, footerY)
    .stroke();

  // Draw "RiskMate" text - use wider width and lineBreak: false to prevent wrapping
  doc
    .fillColor(STYLES.colors.accent)
    .fontSize(10)
    .font(STYLES.fonts.header)
    .text('RiskMate', margin, footerY + 8, {
      width: 200, // Wider width to prevent wrapping
      lineBreak: false, // Prevent line breaks
    });

  // Draw "CONFIDENTIAL" text
  doc
    .fillColor(STYLES.colors.secondaryText)
    .fontSize(STYLES.sizes.caption)
    .font(STYLES.fonts.light)
    .text('CONFIDENTIAL - For Internal Use Only', doc.page.width / 2, footerY + 8, {
      align: 'center',
      width: doc.page.width - margin * 2, // Full width minus margins
    });

  const safeTotalPages = Math.max(totalPages, 1);
  const safePageNum = Math.max(pageNumber, 1);

  // Draw page number
  doc
    .fillColor(STYLES.colors.secondaryText)
    .fontSize(STYLES.sizes.caption)
    .font(STYLES.fonts.body)
    .text(`Page ${safePageNum} of ${safeTotalPages}`, doc.page.width - margin - 100, footerY + 8, {
      align: 'right',
      width: 100, // Fixed width for right alignment
      lineBreak: false,
    });

  // Restore original y position (footer should not affect content position)
  doc.y = savedY;
}

