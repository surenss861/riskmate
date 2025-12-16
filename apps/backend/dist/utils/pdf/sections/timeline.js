"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderTimeline = renderTimeline;
const styles_1 = require("../styles");
const helpers_1 = require("../helpers");
function renderTimeline(doc, auditLogs, pageWidth, pageHeight, margin, safeAddPage, estimatedTotalPages) {
    const groupedTimeline = (0, helpers_1.groupTimelineEvents)(auditLogs);
    if (!groupedTimeline.length)
        return;
    safeAddPage(estimatedTotalPages);
    (0, helpers_1.addSectionHeader)(doc, 'Job Log Timeline');
    let timelineY = doc.y;
    const lineX = margin + 25;
    const textX = margin + 50;
    groupedTimeline.forEach((event, index) => {
        if (doc.y > pageHeight - 100) {
            safeAddPage(estimatedTotalPages);
            // Don't re-add header, just reset position for timeline continuation
            doc.y = styles_1.STYLES.spacing.sectionTop + 40;
        }
        timelineY = doc.y;
        if (index < groupedTimeline.length - 1) {
            doc
                .strokeColor(styles_1.STYLES.colors.accent)
                .lineWidth(1)
                .moveTo(lineX, timelineY + 8)
                .lineTo(lineX, timelineY + 45)
                .stroke();
        }
        doc
            .circle(lineX, timelineY + 8, 5)
            .fill(styles_1.STYLES.colors.accent);
        let timeText = event.time;
        if (event.timeEnd && event.time !== event.timeEnd) {
            const startTime = event.time.replace(' AM', '').replace(' PM', '');
            const endTime = event.timeEnd.replace(' AM', '').replace(' PM', '');
            const amPm = event.time.includes('AM') ? 'AM' : 'PM';
            timeText = `${startTime}-${endTime} ${amPm}`;
        }
        doc
            .fillColor(styles_1.STYLES.colors.primaryText)
            .fontSize(styles_1.STYLES.sizes.body)
            .font(styles_1.STYLES.fonts.header)
            .text(timeText, textX, timelineY);
        doc
            .fillColor(styles_1.STYLES.colors.secondaryText)
            .fontSize(styles_1.STYLES.sizes.body)
            .font(styles_1.STYLES.fonts.body)
            .text(event.description, textX, timelineY + 14, {
            width: pageWidth - textX - margin,
        });
        doc
            .fillColor(styles_1.STYLES.colors.secondaryText)
            .fontSize(styles_1.STYLES.sizes.caption)
            .font(styles_1.STYLES.fonts.light)
            .text(`by ${event.actorName}`, textX, timelineY + 26);
        timelineY += 50;
    });
}
//# sourceMappingURL=timeline.js.map