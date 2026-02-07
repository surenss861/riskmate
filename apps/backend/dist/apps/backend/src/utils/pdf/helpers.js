"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addWatermark = addWatermark;
exports.addSectionHeader = addSectionHeader;
exports.groupTimelineEvents = groupTimelineEvents;
exports.addFooterInline = addFooterInline;
const styles_1 = require("./styles");
const utils_1 = require("./utils");
// Watermark
function addWatermark(doc) {
    doc
        .fillColor(styles_1.STYLES.colors.watermark)
        .fontSize(72)
        .font(styles_1.STYLES.fonts.light);
    doc
        .opacity(0.05)
        .text('Riskmate', doc.page.width / 2, doc.page.height / 2, {
        align: 'center',
        width: 200,
        lineBreak: false,
    })
        .opacity(1.0);
}
// Section header
function addSectionHeader(doc, title, prefix) {
    const margin = styles_1.STYLES.spacing.pageMargin;
    // Move to section top (normalized spacing)
    doc.y = styles_1.STYLES.spacing.sectionTop;
    const titleText = prefix ? `${prefix} ${title}` : title;
    doc
        .fillColor(styles_1.STYLES.colors.primaryText)
        .fontSize(styles_1.STYLES.sizes.h2)
        .font(styles_1.STYLES.fonts.header)
        .text(titleText, { align: 'left' });
    const underlineY = doc.y - 4;
    doc
        .strokeColor(styles_1.STYLES.colors.accent)
        .lineWidth(2)
        .moveTo(margin, underlineY)
        .lineTo(margin + 100, underlineY)
        .stroke();
    doc
        .strokeColor(styles_1.STYLES.colors.divider)
        .lineWidth(0.5)
        .moveTo(margin, underlineY + 8)
        .lineTo(doc.page.width - margin, underlineY + 8)
        .stroke();
    doc.moveDown(1.5);
}
// Timeline grouping
function groupTimelineEvents(auditLogs) {
    const meaningfulEvents = new Set([
        'job.created',
        'job.updated',
        'document.uploaded',
        'mitigation.completed',
        'mitigation.reopened',
        'report.generated',
    ]);
    const filtered = auditLogs.filter((log) => meaningfulEvents.has(log.event_name));
    const eventGroups = new Map();
    filtered.forEach((log) => {
        const eventType = log.event_name;
        const time = new Date(log.created_at).getTime();
        let key;
        if (eventType === 'document.uploaded') {
            const window = Math.floor(time / (5 * 60 * 1000)); // 5 min
            key = `upload-${window}`;
        }
        else if (eventType === 'report.generated') {
            key = 'report-generated';
        }
        else {
            const window = Math.floor(time / (10 * 60 * 1000)); // 10 min
            key = `${eventType}-${window}`;
        }
        if (!eventGroups.has(key)) {
            eventGroups.set(key, []);
        }
        eventGroups.get(key).push(log);
    });
    const result = [];
    const sortedGroups = Array.from(eventGroups.entries()).sort((a, b) => {
        const aTime = Math.min(...a[1].map((l) => new Date(l.created_at).getTime()));
        const bTime = Math.min(...b[1].map((l) => new Date(l.created_at).getTime()));
        return aTime - bTime;
    });
    sortedGroups.forEach(([, logs]) => {
        if (!logs.length)
            return;
        logs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const firstLog = logs[0];
        const count = logs.length;
        const eventType = firstLog.event_name;
        const actorName = firstLog.actor_name || firstLog.actor_email || 'System';
        let description = '';
        let timeStr = (0, utils_1.formatTime)(firstLog.created_at);
        let timeEndStr;
        if (count > 1) {
            const times = logs
                .map((l) => new Date(l.created_at).getTime())
                .sort((a, b) => a - b);
            const earliestTime = new Date(times[0]);
            const latestTime = new Date(times[times.length - 1]);
            if (earliestTime.getTime() < latestTime.getTime()) {
                timeStr = (0, utils_1.formatTime)(earliestTime.toISOString());
                timeEndStr = (0, utils_1.formatTime)(latestTime.toISOString());
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
                    description = `Document uploaded: ${(0, utils_1.truncateText)(firstLog.metadata?.name || 'a file', 40)}`;
                }
                else {
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
        const aTime = auditLogs.find((l) => (0, utils_1.formatTime)(l.created_at) === a.time)?.created_at || '';
        const bTime = auditLogs.find((l) => (0, utils_1.formatTime)(l.created_at) === b.time)?.created_at || '';
        return new Date(aTime).getTime() - new Date(bTime).getTime();
    });
}
// Footer
function addFooterInline(doc, organization, jobId, reportGeneratedAt, pageNumber, totalPages) {
    const margin = styles_1.STYLES.spacing.pageMargin;
    const footerY = doc.page.height - 40;
    doc.y = footerY;
    doc
        .strokeColor(styles_1.STYLES.colors.divider)
        .lineWidth(0.5)
        .moveTo(margin, footerY)
        .lineTo(doc.page.width - margin, footerY)
        .stroke();
    doc
        .fillColor(styles_1.STYLES.colors.accent)
        .fontSize(10)
        .font(styles_1.STYLES.fonts.header)
        .text('Riskmate', margin, footerY + 8, {
        width: 100,
        lineBreak: false,
    });
    doc
        .fillColor(styles_1.STYLES.colors.secondaryText)
        .fontSize(styles_1.STYLES.sizes.caption)
        .font(styles_1.STYLES.fonts.light)
        .text('CONFIDENTIAL - For Internal Use Only', doc.page.width / 2, footerY + 8, {
        align: 'center',
    });
    const safeTotalPages = Math.max(totalPages, 1);
    const safePageNum = Math.max(pageNumber, 1);
    doc
        .fillColor(styles_1.STYLES.colors.secondaryText)
        .fontSize(styles_1.STYLES.sizes.caption)
        .font(styles_1.STYLES.fonts.body)
        .text(`Page ${safePageNum} of ${safeTotalPages}`, doc.page.width - margin, footerY + 8, {
        align: 'right',
        width: 100,
    });
}
//# sourceMappingURL=helpers.js.map