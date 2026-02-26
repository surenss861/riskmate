/**
 * Dashboard export: CSV (data) and PDF (summary).
 * Filenames include the selected period.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export type ExportKpi = { title: string; value: string };
export type ExportInsight = { title: string; description: string; severity: string };
export type ExportTeamRow = { name: string; assigned: number; completed: number; rate: number; avgDays: number; overdue: number };
export type ExportHazardRow = { category: string; count: number; avgRisk: number };

export function buildDashboardCsv(options: {
  periodLabel: string;
  kpis: ExportKpi[];
  insights: ExportInsight[];
  team: ExportTeamRow[];
  hazards: ExportHazardRow[];
}): string {
  const rows: string[][] = [];
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

  rows.push(['Analytics Dashboard Export', options.periodLabel]);
  rows.push([]);
  rows.push(['KPIs']);
  options.kpis.forEach((k) => rows.push([k.title, k.value]));
  rows.push([]);
  rows.push(['Insights', 'Description', 'Severity']);
  options.insights.forEach((i) => rows.push([i.title, i.description, i.severity]));
  rows.push([]);
  rows.push(['Team', 'Assigned', 'Completed', 'Completion %', 'Avg days', 'Overdue']);
  options.team.forEach((t) => rows.push([t.name, String(t.assigned), String(t.completed), String(t.rate), String(t.avgDays), String(t.overdue)]));
  rows.push([]);
  rows.push(['Hazard type', 'Count', 'Avg risk']);
  options.hazards.forEach((h) => rows.push([h.category, String(h.count), String(h.avgRisk)]));

  return rows.map((r) => r.map(escape).join(',')).join('\r\n');
}

export function downloadCsv(csv: string, periodLabel: string): void {
  const safe = periodLabel.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
  const filename = `analytics-dashboard-${safe}-${new Date().toISOString().slice(0, 10)}.csv`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function buildDashboardPdf(options: {
  periodLabel: string;
  kpis: ExportKpi[];
  insights: ExportInsight[];
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595, 842]);
  const margin = 50;
  let y = page.getHeight() - margin;

  const draw = (text: string, size: number, bold = false) => {
    const f = bold ? fontBold : font;
    page.drawText(text, { x: margin, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
    y -= size + 4;
  };

  draw('Analytics Dashboard', 18, true);
  draw(`Period: ${options.periodLabel}`, 10);
  y -= 12;

  draw('Summary KPIs', 14, true);
  options.kpis.forEach((k) => draw(`${k.title}: ${k.value}`, 10));
  y -= 12;

  draw('Insights', 14, true);
  options.insights.slice(0, 10).forEach((i) => {
    draw(`${i.title} (${i.severity})`, 10);
    const desc = i.description.slice(0, 80) + (i.description.length > 80 ? '…' : '');
    page.drawText(desc, { x: margin + 10, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
    y -= 20;
  });

  const pdfBytes = await doc.save();
  return pdfBytes;
}

export function downloadPdf(pdfBytes: Uint8Array, periodLabel: string): void {
  const safe = periodLabel.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
  const filename = `analytics-dashboard-${safe}-${new Date().toISOString().slice(0, 10)}.pdf`;
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
