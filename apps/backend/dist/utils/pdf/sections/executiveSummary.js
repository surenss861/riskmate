"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderExecutiveSummary = renderExecutiveSummary;
const styles_1 = require("../styles");
const helpers_1 = require("../helpers");
const utils_1 = require("../utils");
function renderExecutiveSummary(doc, job, riskScore, mitigationItems, photos, pageWidth, margin, safeAddPage, estimatedTotalPages) {
    safeAddPage(estimatedTotalPages);
    (0, helpers_1.addSectionHeader)(doc, 'Executive Summary');
    // Calculate stats
    const hazardsCount = riskScore?.factors?.length || 0;
    const controlsCount = mitigationItems.length;
    const completedControls = mitigationItems.filter((m) => m.done || m.is_completed).length;
    const photosCount = photos.length;
    const riskLevel = riskScore?.risk_level || 'unknown';
    // ============================================
    // 1. OVERVIEW PARAGRAPH
    // ============================================
    const overviewText = job.description ||
        `This safety report summarizes the ${job.job_type} job performed at ${job.location} for ${job.client_name}. ` +
            `A total of ${hazardsCount} hazard${hazardsCount !== 1 ? 's' : ''} ${hazardsCount === 1 ? 'was' : 'were'} identified, ` +
            `with ${completedControls} of ${controlsCount} control measure${controlsCount !== 1 ? 's' : ''} applied by the assigned crew. ` +
            `The overall risk level for this job is classified as ${riskLevel.toUpperCase()}.`;
    doc
        .fillColor(styles_1.STYLES.colors.primaryText)
        .fontSize(styles_1.STYLES.sizes.body)
        .font(styles_1.STYLES.fonts.body)
        .text(overviewText, {
        width: pageWidth - margin * 2,
        lineGap: 6,
        align: 'left',
    });
    doc.moveDown(1.5);
    // Separator line
    doc
        .strokeColor(styles_1.STYLES.colors.divider)
        .lineWidth(0.5)
        .moveTo(margin, doc.y)
        .lineTo(pageWidth - margin, doc.y)
        .stroke();
    doc.moveDown(1.5);
    // ============================================
    // 2. JOB SUMMARY CARD
    // ============================================
    const jobSummaryY = doc.y;
    const jobSummaryHeight = 100;
    const jobSummaryWidth = pageWidth - margin * 2;
    // Card background
    doc
        .roundedRect(margin, jobSummaryY, jobSummaryWidth, jobSummaryHeight, 6)
        .fill(styles_1.STYLES.colors.sectionBg)
        .stroke(styles_1.STYLES.colors.borderGray)
        .lineWidth(1);
    // Card title
    doc
        .fillColor(styles_1.STYLES.colors.primaryText)
        .fontSize(styles_1.STYLES.sizes.h3)
        .font(styles_1.STYLES.fonts.header)
        .text('Job Summary', margin + 20, jobSummaryY + 15);
    // Job details in two columns
    const detailCol1X = margin + 20;
    const detailCol2X = margin + jobSummaryWidth / 2 + 10;
    const detailStartY = jobSummaryY + 40;
    const detailLineHeight = 18;
    // Left column
    doc
        .fillColor(styles_1.STYLES.colors.secondaryText)
        .fontSize(styles_1.STYLES.sizes.body)
        .font(styles_1.STYLES.fonts.body)
        .text(`Client: ${job.client_name}`, detailCol1X, detailStartY)
        .text(`Location: ${job.location}`, detailCol1X, detailStartY + detailLineHeight)
        .text(`Job Type: ${job.job_type}`, detailCol1X, detailStartY + detailLineHeight * 2);
    // Right column
    const jobDuration = job.start_date && job.end_date
        ? `${(0, utils_1.formatDate)(job.start_date)} - ${(0, utils_1.formatDate)(job.end_date)}`
        : job.start_date
            ? `Started: ${(0, utils_1.formatDate)(job.start_date)}`
            : 'Duration: N/A';
    doc
        .fillColor(styles_1.STYLES.colors.secondaryText)
        .fontSize(styles_1.STYLES.sizes.body)
        .font(styles_1.STYLES.fonts.body)
        .text(`Status: ${job.status}`, detailCol2X, detailStartY)
        .text(jobDuration, detailCol2X, detailStartY + detailLineHeight)
        .text(`Hazards Found: ${hazardsCount}`, detailCol2X, detailStartY + detailLineHeight * 2);
    // DRAFT badge (upper-right corner of card)
    if (job.status.toLowerCase() === 'draft') {
        const badgeX = margin + jobSummaryWidth - 80;
        const badgeY = jobSummaryY + 15;
        const badgeWidth = 60;
        const badgeHeight = 20;
        doc
            .roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 10)
            .fill('#F5F5F5')
            .stroke('#D0D0D0')
            .lineWidth(1);
        doc
            .fillColor(styles_1.STYLES.colors.secondaryText)
            .fontSize(9)
            .font(styles_1.STYLES.fonts.header)
            .text('DRAFT', badgeX + badgeWidth / 2, badgeY + 5, {
            align: 'center',
        });
    }
    doc.y = jobSummaryY + jobSummaryHeight + 20;
    // Separator line
    doc
        .strokeColor(styles_1.STYLES.colors.divider)
        .lineWidth(0.5)
        .moveTo(margin, doc.y)
        .lineTo(pageWidth - margin, doc.y)
        .stroke();
    doc.moveDown(1.5);
    // ============================================
    // 3. QUICK STATS - 4-COLUMN GRID CARD
    // ============================================
    const statsY = doc.y;
    const statsBoxHeight = 90;
    const statsBoxWidth = pageWidth - margin * 2;
    // Card background
    doc
        .roundedRect(margin, statsY, statsBoxWidth, statsBoxHeight, 6)
        .fill(styles_1.STYLES.colors.sectionBg)
        .stroke(styles_1.STYLES.colors.borderGray)
        .lineWidth(1);
    // 4-column grid
    const colWidth = statsBoxWidth / 4;
    const statsContentY = statsY + 25;
    const statsNumberY = statsContentY;
    const statsLabelY = statsContentY + 28;
    // Column 1: Hazards
    const col1X = margin + colWidth / 2;
    doc
        .fillColor(styles_1.STYLES.colors.primaryText)
        .fontSize(24)
        .font(styles_1.STYLES.fonts.header)
        .text(hazardsCount.toString(), col1X, statsNumberY, { align: 'center' });
    doc
        .fillColor(styles_1.STYLES.colors.secondaryText)
        .fontSize(styles_1.STYLES.sizes.body)
        .font(styles_1.STYLES.fonts.body)
        .text('Hazards', col1X, statsLabelY, { align: 'center' });
    // Column 2: Controls
    const col2X = margin + colWidth + colWidth / 2;
    doc
        .fillColor(styles_1.STYLES.colors.primaryText)
        .fontSize(24)
        .font(styles_1.STYLES.fonts.header)
        .text(`${completedControls}/${controlsCount}`, col2X, statsNumberY, { align: 'center' });
    doc
        .fillColor(styles_1.STYLES.colors.secondaryText)
        .fontSize(styles_1.STYLES.sizes.body)
        .font(styles_1.STYLES.fonts.body)
        .text('Controls', col2X, statsLabelY, { align: 'center' });
    // Column 3: Photos
    const col3X = margin + colWidth * 2 + colWidth / 2;
    doc
        .fillColor(styles_1.STYLES.colors.primaryText)
        .fontSize(24)
        .font(styles_1.STYLES.fonts.header)
        .text(photosCount.toString(), col3X, statsNumberY, { align: 'center' });
    doc
        .fillColor(styles_1.STYLES.colors.secondaryText)
        .fontSize(styles_1.STYLES.sizes.body)
        .font(styles_1.STYLES.fonts.body)
        .text('Photos', col3X, statsLabelY, { align: 'center' });
    // Column 4: Status
    const col4X = margin + colWidth * 3 + colWidth / 2;
    doc
        .fillColor(styles_1.STYLES.colors.primaryText)
        .fontSize(24)
        .font(styles_1.STYLES.fonts.header)
        .text(job.status.toUpperCase(), col4X, statsNumberY, { align: 'center' });
    doc
        .fillColor(styles_1.STYLES.colors.secondaryText)
        .fontSize(styles_1.STYLES.sizes.body)
        .font(styles_1.STYLES.fonts.body)
        .text('Status', col4X, statsLabelY, { align: 'center' });
    // Vertical dividers between columns
    for (let i = 1; i < 4; i++) {
        const dividerX = margin + colWidth * i;
        doc
            .strokeColor(styles_1.STYLES.colors.divider)
            .lineWidth(0.5)
            .moveTo(dividerX, statsY + 10)
            .lineTo(dividerX, statsY + statsBoxHeight - 10)
            .stroke();
    }
    doc.y = statsY + statsBoxHeight + 20;
    // Separator line
    doc
        .strokeColor(styles_1.STYLES.colors.divider)
        .lineWidth(0.5)
        .moveTo(margin, doc.y)
        .lineTo(pageWidth - margin, doc.y)
        .stroke();
    doc.moveDown(1.5);
    // ============================================
    // 4. RISK SCORE CARD (Integrated)
    // ============================================
    if (riskScore) {
        const riskY = doc.y;
        const riskBoxHeight = 120;
        const riskBoxWidth = pageWidth - margin * 2;
        const riskColor = (0, utils_1.getRiskColor)(riskScore.risk_level);
        const riskLevelText = (0, utils_1.truncateText)((riskScore.risk_level || 'unknown').toUpperCase(), 12);
        // Card background with left accent border
        doc
            .roundedRect(margin, riskY, riskBoxWidth, riskBoxHeight, 6)
            .fill(styles_1.STYLES.colors.sectionBg)
            .stroke(styles_1.STYLES.colors.borderGray)
            .lineWidth(1);
        // Left accent border
        doc
            .rect(margin, riskY, 4, riskBoxHeight)
            .fill(riskColor);
        // Risk Score label
        doc
            .fillColor(styles_1.STYLES.colors.primaryText)
            .fontSize(styles_1.STYLES.sizes.h3)
            .font(styles_1.STYLES.fonts.header)
            .text('Risk Score', margin + 20, riskY + 15);
        // Score and level (centered horizontally)
        const scoreX = margin + riskBoxWidth / 2;
        const scoreY = riskY + 45;
        doc
            .fillColor(riskColor)
            .fontSize(48)
            .font(styles_1.STYLES.fonts.header)
            .text(riskScore.overall_score.toString(), scoreX, scoreY, {
            align: 'center',
        });
        // Risk level badge
        const badgeY = scoreY + 40;
        const badgeWidth = 100;
        const badgeHeight = 24;
        const badgeX = margin + riskBoxWidth / 2 - badgeWidth / 2;
        doc
            .roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 12)
            .fill(riskColor + '20')
            .stroke(riskColor)
            .lineWidth(1.5);
        doc
            .fillColor(riskColor)
            .fontSize(12)
            .font(styles_1.STYLES.fonts.header)
            .text(riskLevelText, scoreX, badgeY + 5, {
            align: 'center',
        });
        // Progress bar (below badge, centered)
        const barY = badgeY + badgeHeight + 10;
        const barWidth = riskBoxWidth - 80;
        const barHeight = 8;
        const barX = margin + riskBoxWidth / 2 - barWidth / 2;
        doc
            .roundedRect(barX, barY, barWidth, barHeight, 4)
            .fill(styles_1.STYLES.colors.lightGrayBg)
            .stroke(styles_1.STYLES.colors.borderGray)
            .lineWidth(0.5);
        if (riskScore.overall_score > 0) {
            const progressWidth = (riskScore.overall_score / 100) * barWidth;
            doc
                .roundedRect(barX, barY, progressWidth, barHeight, 4)
                .fill(riskColor);
        }
        doc.y = riskY + riskBoxHeight + 20;
    }
}
//# sourceMappingURL=executiveSummary.js.map