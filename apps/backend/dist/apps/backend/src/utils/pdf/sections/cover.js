"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderCoverPage = renderCoverPage;
const styles_1 = require("../styles");
const helpers_1 = require("../helpers");
const utils_1 = require("../utils");
function renderCoverPage(doc, job, organization, logoBuffer, reportGeneratedAt, pageWidth, pageHeight, margin) {
    // Background
    doc.rect(0, 0, pageWidth, pageHeight).fill('#FFFFFF');
    (0, helpers_1.addWatermark)(doc);
    doc
        .save()
        .opacity(0.03)
        .rect(0, 0, pageWidth, 200)
        .fill(styles_1.STYLES.colors.accent)
        .restore();
    const headerY = 60;
    if (logoBuffer) {
        try {
            doc.image(logoBuffer, pageWidth - margin - 120, headerY, { fit: [100, 50] });
        }
        catch (error) {
            console.warn('Unable to render logo in PDF:', error);
        }
    }
    doc
        .fillColor(styles_1.STYLES.colors.accent)
        .fontSize(20)
        .font(styles_1.STYLES.fonts.header)
        .text('Riskmate', margin, headerY, {
        width: 120,
        lineBreak: false,
    });
    const titleY = 180;
    doc
        .fillColor(styles_1.STYLES.colors.primaryText)
        .fontSize(40)
        .font(styles_1.STYLES.fonts.header)
        .text('Risk Snapshot Report', margin, titleY);
    doc
        .strokeColor(styles_1.STYLES.colors.accent)
        .lineWidth(3)
        .moveTo(margin, titleY + 50)
        .lineTo(margin + 250, titleY + 50)
        .stroke();
    const dividerY = titleY + 80;
    doc
        .strokeColor(styles_1.STYLES.colors.divider)
        .lineWidth(1)
        .moveTo(margin, dividerY)
        .lineTo(pageWidth - margin, dividerY)
        .stroke();
    const cardY = dividerY + 40;
    const cardHeight = 280;
    const cardWidth = pageWidth - margin * 2;
    doc
        .rect(margin, cardY, cardWidth, cardHeight)
        .fill(styles_1.STYLES.colors.sectionBg)
        .stroke(styles_1.STYLES.colors.borderGray)
        .lineWidth(1.5);
    doc
        .fillColor(styles_1.STYLES.colors.accent)
        .fontSize(styles_1.STYLES.sizes.h3)
        .font(styles_1.STYLES.fonts.header)
        .text('Job Information', margin + 24, cardY + 28);
    const col1X = margin + 24;
    const col2X = margin + cardWidth / 2 + 24;
    const colWidth = cardWidth / 2 - 48;
    const infoY = cardY + 60;
    const jobStartDate = job.start_date ? new Date(job.start_date) : null;
    const jobEndDate = job.end_date ? new Date(job.end_date) : null;
    doc
        .fillColor(styles_1.STYLES.colors.secondaryText)
        .fontSize(styles_1.STYLES.sizes.body)
        .font(styles_1.STYLES.fonts.body)
        .text(`Job Name: ${job.job_type || 'N/A'}`, col1X, infoY)
        .text(`Client: ${job.client_name}`, col1X, infoY + 20)
        .text(`Client Type: ${job.client_type}`, col1X, infoY + 40)
        .text(`Property Address: ${job.location}`, col1X, infoY + 60, {
        width: colWidth,
    });
    if (jobStartDate) {
        doc.text(`Start Date: ${(0, utils_1.formatDate)(job.start_date)}`, col2X, infoY);
    }
    if (jobEndDate) {
        doc.text(`End Date: ${(0, utils_1.formatDate)(job.end_date)}`, col2X, infoY + 20);
    }
    doc
        .text(`Job ID: ${job.id.substring(0, 8).toUpperCase()}`, col2X, infoY + 40)
        .text(`Generated On: ${(0, utils_1.formatDate)(reportGeneratedAt.toISOString())}`, col2X, infoY + 60);
}
//# sourceMappingURL=cover.js.map