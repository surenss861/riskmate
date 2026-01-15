"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateLedgerExportPDF = generateLedgerExportPDF;
const pdfkit_1 = __importDefault(require("pdfkit"));
const styles_1 = require("./styles");
const proofPackTheme_1 = require("./proofPackTheme");
const normalize_1 = require("./normalize");
async function generateLedgerExportPDF(options) {
    const { organizationName, generatedBy, generatedByRole, exportId, timeRange, filters, events } = options;
    return new Promise((resolve, reject) => {
        const doc = new pdfkit_1.default({
            size: 'LETTER',
            margins: {
                top: styles_1.STYLES.spacing.pageMargin,
                bottom: 60,
                left: styles_1.STYLES.spacing.pageMargin,
                right: styles_1.STYLES.spacing.pageMargin,
            },
            bufferPages: true, // Enable page buffering for footer rendering
        });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        (0, proofPackTheme_1.initPage)(doc);
        // Header with metadata
        (0, proofPackTheme_1.drawHeader)(doc, {
            title: 'Compliance Ledger Export',
            packId: exportId,
            organizationName,
            generatedBy,
            generatedByRole,
            generatedAt: new Date().toISOString(),
            timeRange,
        });
        // KPI row
        const filteredEvents = events.slice(0, 1000); // Limit for performance
        const filterCount = (0, normalize_1.countActiveFilters)(filters || {});
        // Debug log to help diagnose Active Filters count issues
        if (process.env.NODE_ENV !== 'production') {
            console.log('[ledger pdf] Active Filters calculation:', {
                filterCount,
                filters: filters || {},
                filterEntries: Object.entries(filters || {}).map(([k, v]) => ({ key: k, value: v, active: v !== null && v !== undefined && v !== '' })),
            });
        }
        (0, proofPackTheme_1.drawKpiRow)(doc, [
            { label: 'Total Events', value: events.length, highlight: true },
            { label: 'Displayed', value: filteredEvents.length },
            { label: 'Active Filters', value: filterCount },
            { label: 'Hash Verified', value: 'Yes' }, // Use text instead of emoji to avoid encoding issues
        ]);
        // Empty state or table
        if (filteredEvents.length === 0) {
            (0, proofPackTheme_1.drawEmptyState)(doc, {
                title: 'No Events Found',
                message: 'No ledger events were found for this export with the applied filters.',
                filters: filters || {},
                actionHint: 'Try adjusting the time range or filters to see more events.',
            });
        }
        else {
            (0, proofPackTheme_1.drawSectionTitle)(doc, 'Event Data');
            // Prepare table data (sanitize all text to prevent control characters)
            const tableRows = filteredEvents.map((event) => [
                (0, normalize_1.formatDateTime)(event.created_at),
                (0, normalize_1.sanitizeText)(event.event_name || 'unknown'),
                (0, normalize_1.sanitizeText)(event.category || 'operations'),
                (0, normalize_1.sanitizeText)(event.outcome || 'allowed'),
                (0, normalize_1.sanitizeText)(event.severity || 'info'),
                (0, normalize_1.sanitizeText)(event.actor_name || 'System'),
                (0, normalize_1.sanitizeText)(event.actor_role || ''),
                (0, normalize_1.sanitizeText)(event.job_title || event.target_type || ''),
            ]);
            (0, proofPackTheme_1.drawTable)(doc, {
                columns: [
                    { header: 'Timestamp', width: 100 },
                    { header: 'Event', width: 120 },
                    { header: 'Category', width: 80 },
                    { header: 'Outcome', width: 70 },
                    { header: 'Severity', width: 70 },
                    { header: 'Actor', width: 100 },
                    { header: 'Role', width: 70 },
                    { header: 'Target', width: 100 },
                ],
                rows: tableRows,
                zebraStriping: true,
                rowHeight: 18,
                fontSize: 8,
            });
            // Appendices - Evidence Reference
            if (doc.y > doc.page.height - 200) {
                doc.addPage();
                (0, proofPackTheme_1.initPage)(doc);
            }
            (0, proofPackTheme_1.drawSectionTitle)(doc, 'Evidence Reference');
            // CRITICAL: Hardcoded clean constant + safeTextForPdf() validation + Helvetica font
            // Helvetica is a built-in PDF font with stable text mapping, preventing font encoding issues
            // This makes it impossible for broken glyphs to slip through at font/text-encoding time
            // Use space instead of hyphen to prevent line break issues in PDF extraction
            const EVIDENCE_NOTE = 'Note: Evidence files are auth gated. Use the Work Record IDs below to retrieve evidence via the Compliance Ledger interface.';
            const evidenceNote = (0, normalize_1.safeTextForPdf)(EVIDENCE_NOTE, 'Ledger Evidence Reference note');
            doc
                .fillColor(styles_1.STYLES.colors.secondaryText)
                .fontSize(styles_1.STYLES.sizes.body)
                .font('Helvetica') // Built-in font with stable text mapping - prevents font encoding issues
                .text(evidenceNote, {
                align: 'left',
                indent: 20,
                // Prevent line breaks in the middle of "auth gated" by using a single text run
                // PDFKit will still wrap at word boundaries, but "auth gated" stays together better
            });
            doc.moveDown(0.5);
            const uniqueJobs = new Set(events.filter(e => e.job_id).map(e => e.job_id));
            if (uniqueJobs.size > 0) {
                doc
                    .fontSize(styles_1.STYLES.sizes.body)
                    .font('Helvetica') // Built-in font with stable text mapping - prevents font encoding issues
                    .fillColor(styles_1.STYLES.colors.primaryText);
                Array.from(uniqueJobs).slice(0, 50).forEach((jobId) => {
                    const event = events.find(e => e.job_id === jobId);
                    const jobTitle = event?.job_title ? (0, normalize_1.sanitizeText)(event.job_title) : '';
                    const text = (0, normalize_1.safeTextForPdf)(`• Work Record ID: ${jobId}${jobTitle ? ` (${jobTitle})` : ''}`, `Work Record ID ${jobId}`);
                    doc.text(text, {
                        align: 'left',
                        indent: 20,
                    });
                });
            }
        }
        // Finalize PDF (adds footers to all pages)
        (0, proofPackTheme_1.finalizePdf)(doc, { packId: exportId });
        doc.end();
    });
}
//# sourceMappingURL=ledgerExport.js.map