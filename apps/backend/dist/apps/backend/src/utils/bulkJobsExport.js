"use strict";
/**
 * Server-side bulk jobs export: build CSV string and PDF buffer from job rows.
 * Used by the export worker for export_type 'bulk_jobs'.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCsvString = buildCsvString;
exports.buildPdfBuffer = buildPdfBuffer;
const pdf_lib_1 = require("pdf-lib");
const CSV_HEADERS = [
    'Job Name',
    'Client',
    'Status',
    'Assigned To',
    'Due Date',
    'Created At',
];
function escapeCsvCell(value) {
    if (value == null)
        return '';
    const s = String(value);
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}
function formatAssignedTo(job) {
    if (job.assigned_to_name)
        return job.assigned_to_name;
    if (job.assigned_to_email)
        return job.assigned_to_email;
    return '';
}
function buildCsvString(jobs) {
    const headerRow = CSV_HEADERS.join(',');
    const rows = jobs.map((job) => [
        escapeCsvCell(job.job_name),
        escapeCsvCell(job.client_name),
        escapeCsvCell(job.status),
        escapeCsvCell(formatAssignedTo(job)),
        escapeCsvCell(job.due_date ? new Date(job.due_date).toISOString().slice(0, 10) : null),
        escapeCsvCell(job.created_at ? new Date(job.created_at).toISOString() : null),
    ].join(','));
    return [headerRow, ...rows].join('\r\n');
}
async function buildPdfBuffer(jobs) {
    const doc = await pdf_lib_1.PDFDocument.create();
    const font = await doc.embedFont(pdf_lib_1.StandardFonts.Helvetica);
    const boldFont = await doc.embedFont(pdf_lib_1.StandardFonts.HelveticaBold);
    const fontSize = 9;
    const lineHeight = fontSize * 1.4;
    const margin = 50;
    const pageWidth = 595;
    const pageHeight = 842;
    const colWidths = [100, 80, 60, 80, 70, 90];
    let page = doc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;
    const addHeader = () => {
        let x = margin;
        CSV_HEADERS.forEach((h, i) => {
            page.drawText(h, { x, y, size: fontSize, font: boldFont });
            x += colWidths[i] ?? 60;
        });
        y -= lineHeight;
    };
    const addRow = (row) => {
        if (y < margin + lineHeight * 2) {
            page = doc.addPage([pageWidth, pageHeight]);
            y = pageHeight - margin;
            addHeader();
        }
        let x = margin;
        row.forEach((cell, i) => {
            const w = colWidths[i] ?? 60;
            const text = String(cell ?? '').slice(0, 25);
            page.drawText(text, { x, y, size: fontSize, font });
            x += w;
        });
        y -= lineHeight;
    };
    addHeader();
    for (const job of jobs) {
        const dueStr = job.due_date ? new Date(job.due_date).toISOString().slice(0, 10) : '';
        const createdStr = job.created_at ? new Date(job.created_at).toISOString() : '';
        addRow([
            String(job.job_name ?? ''),
            String(job.client_name ?? ''),
            String(job.status ?? ''),
            String(formatAssignedTo(job)),
            dueStr,
            createdStr,
        ]);
    }
    return doc.save();
}
//# sourceMappingURL=bulkJobsExport.js.map