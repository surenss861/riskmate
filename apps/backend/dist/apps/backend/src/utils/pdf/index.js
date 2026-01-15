"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRiskSnapshotPDF = generateRiskSnapshotPDF;
const pdfkit_1 = __importDefault(require("pdfkit"));
const styles_1 = require("./styles");
const utils_1 = require("./utils");
const helpers_1 = require("./helpers");
const cover_1 = require("./sections/cover");
const executiveSummary_1 = require("./sections/executiveSummary");
const hazardChecklist_1 = require("./sections/hazardChecklist");
const controlsApplied_1 = require("./sections/controlsApplied");
const timeline_1 = require("./sections/timeline");
const photos_1 = require("./sections/photos");
const signatures_1 = require("./sections/signatures");
// ============================================
// MAIN GENERATOR
// ============================================
async function generateRiskSnapshotPDF(job, riskScore, mitigationItems, organization, photos = [], auditLogs = []) {
    const accent = organization.accent_color || '#F97316';
    const logoBuffer = await (0, utils_1.fetchLogoBuffer)(organization.logo_url);
    const reportGeneratedAt = new Date();
    const jobStartDate = job.start_date ? new Date(job.start_date) : null;
    const jobEndDate = job.end_date ? new Date(job.end_date) : null;
    return new Promise((resolve, reject) => {
        const doc = new pdfkit_1.default({
            size: 'LETTER',
            margins: {
                top: styles_1.STYLES.spacing.pageMargin,
                bottom: 60,
                left: styles_1.STYLES.spacing.pageMargin,
                right: styles_1.STYLES.spacing.pageMargin,
            },
        });
        const chunks = [];
        let pageCount = 1;
        let currentPage = 1;
        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;
        const margin = styles_1.STYLES.spacing.pageMargin;
        const groupedTimeline = (0, helpers_1.groupTimelineEvents)(auditLogs);
        const { before, during, after } = (0, utils_1.categorizePhotos)(photos, job.start_date);
        // Rough estimate for footer page numbers
        const estimatedTotalPages = 1 + // cover
            1 + // executive
            (riskScore?.factors?.length ? 1 : 0) +
            (mitigationItems.length ? 1 : 0) +
            (groupedTimeline.length ? 1 : 0) +
            (photos.length ? Math.ceil(photos.length / 9) : 0) +
            1; // signatures
        const safeAddPage = (estimatedPages) => {
            // Add footer to current page before switching (skip first page)
            if (pageCount > 1) {
                (0, helpers_1.addFooterInline)(doc, organization, job.id, reportGeneratedAt, currentPage, estimatedPages || pageCount);
            }
            // Create new page
            doc.addPage();
            pageCount++;
            currentPage = pageCount;
            // Add watermark to new page
            (0, helpers_1.addWatermark)(doc);
            // Reset cursor to top of content area (below header/watermark)
            // This ensures content starts at the right position
            doc.y = styles_1.STYLES.spacing.sectionTop;
        };
        // ============================================
        // WIRING IT ALL TOGETHER
        // ============================================
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err) => reject(err));
        // First page (cover) is created by PDFKit constructor
        (0, helpers_1.addWatermark)(doc);
        (0, cover_1.renderCoverPage)(doc, job, organization, logoBuffer, reportGeneratedAt, pageWidth, pageHeight, margin);
        (0, executiveSummary_1.renderExecutiveSummary)(doc, job, riskScore, mitigationItems, photos, pageWidth, margin, safeAddPage, estimatedTotalPages);
        (0, hazardChecklist_1.renderHazardChecklist)(doc, job, riskScore, pageWidth, pageHeight, margin, safeAddPage, estimatedTotalPages);
        (0, controlsApplied_1.renderControlsApplied)(doc, mitigationItems, accent, pageWidth, pageHeight, margin, safeAddPage, estimatedTotalPages);
        (0, timeline_1.renderTimeline)(doc, auditLogs, pageWidth, pageHeight, margin, safeAddPage, estimatedTotalPages);
        (0, photos_1.renderPhotosSection)(doc, photos, job.start_date, pageWidth, pageHeight, margin, safeAddPage, estimatedTotalPages);
        (0, signatures_1.renderSignaturesAndCompliance)(doc, pageWidth, pageHeight, margin, safeAddPage, estimatedTotalPages);
        // Final footer for last page
        (0, helpers_1.addFooterInline)(doc, organization, job.id, reportGeneratedAt, pageCount, pageCount);
        doc.end();
    });
}
//# sourceMappingURL=index.js.map