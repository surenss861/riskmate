"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateControlsPDF = generateControlsPDF;
exports.generateAttestationsPDF = generateAttestationsPDF;
exports.generateEvidenceIndexPDF = generateEvidenceIndexPDF;
const pdfkit_1 = __importDefault(require("pdfkit"));
const styles_1 = require("./styles");
const proofPackTheme_1 = require("./proofPackTheme");
const normalize_1 = require("./normalize");
/**
 * Generate Controls PDF from controls data
 */
async function generateControlsPDF(controls, meta) {
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
            title: 'Controls Report',
            packId: meta.packId,
            organizationName: meta.organizationName,
            generatedBy: meta.generatedBy,
            generatedByRole: meta.generatedByRole,
            generatedAt: meta.generatedAt,
            timeRange: meta.timeRange,
        });
        // KPI row with enhanced metrics (using normalization layer)
        const kpis = (0, normalize_1.calculateControlKPIs)(controls);
        const sortedControls = (0, normalize_1.sortControls)(controls);
        (0, proofPackTheme_1.drawKpiRow)(doc, [
            { label: 'Total Controls', value: kpis.total, highlight: true },
            { label: 'Completed', value: kpis.completed },
            { label: 'Pending', value: kpis.pending },
            { label: 'Overdue', value: kpis.overdue },
            { label: 'High Severity', value: kpis.highSeverity },
        ]);
        // Empty state or table
        if (controls.length === 0) {
            (0, proofPackTheme_1.drawEmptyState)(doc, {
                title: 'No Controls Found',
                message: 'No controls were found for this proof pack with the applied filters.',
                filters: {
                    time_range: meta.timeRange,
                    job_id: meta.packId.includes('JOB') ? 'filtered' : undefined,
                    site_id: meta.packId.includes('SITE') ? 'filtered' : undefined,
                },
                actionHint: 'Try adjusting the time range or filters, or add controls to jobs in the system.',
            });
        }
        else {
            (0, proofPackTheme_1.drawSectionTitle)(doc, 'Controls Data');
            // Prepare table data (using normalized/sorted controls from above)
            const tableRows = sortedControls.map((control) => [
                (0, normalize_1.truncateText)(control.control_id, 16),
                (0, normalize_1.truncateText)(control.title || 'Untitled', 40),
                control.status_at_export || 'unknown',
                control.severity || 'info',
                (0, normalize_1.truncateText)(control.owner_email || 'Unassigned', 30),
                (0, normalize_1.formatDate)(control.due_date, 'short'),
                (0, normalize_1.formatDate)(control.updated_at, 'short'),
            ]);
            (0, proofPackTheme_1.drawTable)(doc, {
                columns: [
                    { header: 'Control ID', width: 70 },
                    { header: 'Title', width: 110 },
                    { header: 'Status', width: 60 },
                    { header: 'Severity', width: 60 },
                    { header: 'Owner', width: 90 },
                    { header: 'Due Date', width: 80 },
                    { header: 'Last Updated', width: 80 },
                ],
                rows: tableRows,
                zebraStriping: true,
                rowHeight: 18,
                fontSize: 8,
            });
        }
        // Finalize PDF (adds footers to all pages)
        (0, proofPackTheme_1.finalizePdf)(doc, { packId: meta.packId });
        doc.end();
    });
}
/**
 * Generate Attestations PDF from attestations data
 */
async function generateAttestationsPDF(attestations, meta) {
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
            title: 'Attestations Report',
            packId: meta.packId,
            organizationName: meta.organizationName,
            generatedBy: meta.generatedBy,
            generatedByRole: meta.generatedByRole,
            generatedAt: meta.generatedAt,
            timeRange: meta.timeRange,
        });
        // KPI row (using normalization layer)
        const kpis = (0, normalize_1.calculateAttestationKPIs)(attestations);
        const sortedAttestations = (0, normalize_1.sortAttestations)(attestations);
        (0, proofPackTheme_1.drawKpiRow)(doc, [
            { label: 'Total Attestations', value: kpis.total, highlight: true },
            { label: 'Completed', value: kpis.completed },
            { label: 'Pending', value: kpis.pending },
        ]);
        // Empty state or table
        if (attestations.length === 0) {
            (0, proofPackTheme_1.drawEmptyState)(doc, {
                title: 'No Attestations Found',
                message: 'No attestations were found for this proof pack with the applied filters.',
                filters: {
                    time_range: meta.timeRange,
                    job_id: meta.packId.includes('JOB') ? 'filtered' : undefined,
                    site_id: meta.packId.includes('SITE') ? 'filtered' : undefined,
                },
                actionHint: 'Try adjusting the time range or filters, or generate attestations in the system.',
            });
        }
        else {
            (0, proofPackTheme_1.drawSectionTitle)(doc, 'Attestations Data');
            // Prepare table data (using normalized/sorted attestations from above)
            const tableRows = sortedAttestations.map((attestation) => [
                (0, normalize_1.truncateText)(attestation.attestation_id, 16),
                (0, normalize_1.truncateText)(attestation.title || 'Untitled', 40),
                attestation.status_at_export || 'unknown',
                (0, normalize_1.truncateText)(attestation.attested_by_email || 'Unknown', 30),
                (0, normalize_1.formatDateTime)(attestation.attested_at),
            ]);
            (0, proofPackTheme_1.drawTable)(doc, {
                columns: [
                    { header: 'Attestation ID', width: 80 },
                    { header: 'Title', width: 140 },
                    { header: 'Status', width: 70 },
                    { header: 'Attested By', width: 120 },
                    { header: 'Attested At', width: 120 },
                ],
                rows: tableRows,
                zebraStriping: true,
                rowHeight: 18,
                fontSize: 8,
            });
        }
        // Finalize PDF (adds footers to all pages)
        (0, proofPackTheme_1.finalizePdf)(doc, { packId: meta.packId });
        doc.end();
    });
}
/**
 * Generate Evidence Index PDF from manifest data
 */
async function generateEvidenceIndexPDF(manifest, meta) {
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
            title: 'Proof Pack Index',
            packId: meta.packId,
            organizationName: meta.organizationName,
            generatedBy: meta.generatedBy,
            generatedByRole: meta.generatedByRole,
            generatedAt: meta.generatedAt,
            timeRange: meta.timeRange,
        });
        // KPI row
        const payloadFileCount = manifest.files?.length || 0;
        const totalFileCount = payloadFileCount + 1; // +1 for this index PDF
        (0, proofPackTheme_1.drawKpiRow)(doc, [
            { label: 'Ledger Events', value: manifest.counts?.ledger_events || 0 },
            { label: 'Controls', value: manifest.counts?.controls || 0 },
            { label: 'Attestations', value: manifest.counts?.attestations || 0 },
            { label: 'Total PDFs', value: totalFileCount, highlight: true },
        ]);
        // Contents Summary
        (0, proofPackTheme_1.drawSectionTitle)(doc, 'Contents Summary');
        doc
            .fillColor(styles_1.STYLES.colors.secondaryText)
            .fontSize(styles_1.STYLES.sizes.body)
            .font(styles_1.STYLES.fonts.body)
            .text(`This proof pack contains ${totalFileCount} PDF file(s):`, { align: 'left' });
        doc.moveDown(0.3);
        doc
            .fontSize(styles_1.STYLES.sizes.body)
            .font(styles_1.STYLES.fonts.body)
            .text(`• ${payloadFileCount} payload PDF(s) with integrity verification hashes`, { align: 'left', indent: 20 });
        doc
            .fontSize(styles_1.STYLES.sizes.body)
            .font(styles_1.STYLES.fonts.body)
            .text(`• 1 index PDF (this file)`, { align: 'left', indent: 20 });
        doc.moveDown(1);
        // Files in Pack (short hashes in table)
        (0, proofPackTheme_1.drawSectionTitle)(doc, 'Payload PDFs (Integrity Verified)');
        if (manifest.files && Array.isArray(manifest.files) && manifest.files.length > 0) {
            const tableRows = manifest.files.map((file) => [
                file.name || 'Unknown',
                file.bytes ? file.bytes.toLocaleString() : '0',
                file.sha256 ? (0, proofPackTheme_1.formatHashShort)(file.sha256, 16) : 'N/A',
            ]);
            (0, proofPackTheme_1.drawTable)(doc, {
                columns: [
                    { header: 'File Name', width: 200 },
                    { header: 'Size (bytes)', width: 100, align: 'right' },
                    { header: 'SHA-256 Hash (short)', width: 150 },
                ],
                rows: tableRows,
                zebraStriping: true,
                rowHeight: 18,
                fontSize: 8,
            });
            // Add index PDF entry (not self-hashed)
            doc.moveDown(0.5);
            doc
                .fillColor(styles_1.STYLES.colors.secondaryText)
                .fontSize(styles_1.STYLES.sizes.body)
                .font(styles_1.STYLES.fonts.body)
                .text('Index PDF:', { align: 'left' });
            doc
                .fontSize(styles_1.STYLES.sizes.body)
                .font(styles_1.STYLES.fonts.body)
                .text(`  • evidence_index_${meta.packId}.pdf (included, not self-hashed)`, { align: 'left', indent: 20 });
            // Full Hashes Appendix (on new page if needed)
            if (doc.y > doc.page.height - 200) {
                doc.addPage();
                (0, proofPackTheme_1.initPage)(doc);
            }
            (0, proofPackTheme_1.drawSectionTitle)(doc, 'Full SHA-256 Hashes (Payload Integrity Verification)');
            doc
                .fillColor(styles_1.STYLES.colors.secondaryText)
                .fontSize(styles_1.STYLES.sizes.caption)
                .font('Courier') // Monospace for hashes
                .text('Use these full hashes to verify payload PDF integrity:', { align: 'left' });
            doc.moveDown(0.3);
            doc
                .fontSize(styles_1.STYLES.sizes.caption)
                .font(styles_1.STYLES.fonts.body)
                .text('Note: The index PDF is included in the ZIP but not self-hashed (to avoid infinite loop).', { align: 'left' });
            doc.moveDown(0.5);
            manifest.files.forEach((file) => {
                if (file.sha256) {
                    doc
                        .fontSize(styles_1.STYLES.sizes.caption)
                        .font('Courier')
                        .fillColor(styles_1.STYLES.colors.primaryText)
                        .text(`${file.name || 'Unknown'}:`, { align: 'left' });
                    doc
                        .fontSize(styles_1.STYLES.sizes.caption)
                        .font('Courier')
                        .fillColor(styles_1.STYLES.colors.secondaryText)
                        .text(file.sha256, { align: 'left', indent: 20 });
                    doc.moveDown(0.3);
                }
            });
        }
        else {
            (0, proofPackTheme_1.drawEmptyState)(doc, {
                title: 'No Payload Files in Pack',
                message: 'This proof pack contains no payload PDFs.',
            });
        }
        // Filters - use formatFilterContext() for consistent display
        if (manifest.filters) {
            const filterCount = (0, normalize_1.countActiveFilters)(manifest.filters);
            if (filterCount > 0) {
                doc.moveDown(1);
                (0, proofPackTheme_1.drawSectionTitle)(doc, 'Applied Filters');
                doc
                    .fillColor(styles_1.STYLES.colors.secondaryText)
                    .fontSize(styles_1.STYLES.sizes.body)
                    .font(styles_1.STYLES.fonts.body);
                // Use formatFilterContext() for consistent formatting (shows all active filters)
                const filterText = (0, normalize_1.formatFilterContext)(manifest.filters);
                doc.text((0, normalize_1.safeTextForPdf)(filterText, 'Evidence Index filters'), { align: 'left' });
            }
        }
        // Finalize PDF (adds footers to all pages)
        (0, proofPackTheme_1.finalizePdf)(doc, { packId: meta.packId });
        doc.end();
    });
}
//# sourceMappingURL=proofPack.js.map