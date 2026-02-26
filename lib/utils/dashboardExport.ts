/**
 * Dashboard export: CSV (data) and PDF (summary).
 * Filenames include the selected period.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export type ExportKpi = { title: string; value: string };
export type ExportInsight = { title: string; description: string; severity: string };
export type ExportTeamRow = { name: string; assigned: number; completed: number; rate: number; avgDays: number; overdue: number };
export type ExportHazardRow = { category: string; count: number; avgRisk: number };

/** One data point for a trend series (e.g. jobs created, completion %, risk). */
export type ExportTrendPoint = { period: string; value: number };

/** Status-by-period row: period plus dynamic status columns. */
export type ExportStatusByPeriodRow = { period: string; [status: string]: string | number };

export function buildDashboardCsv(options: {
  periodLabel: string;
  kpis: ExportKpi[];
  insights: ExportInsight[];
  team: ExportTeamRow[];
  hazards: ExportHazardRow[];
  /** Trend: jobs created per period (chart data). */
  trendJobsCreated?: ExportTrendPoint[];
  /** Trend: jobs completed per period (chart data). */
  trendJobsCompleted?: ExportTrendPoint[];
  /** Trend: completion % per period (chart data). */
  trendCompletionPct?: ExportTrendPoint[];
  /** Trend: risk values per period (chart data). */
  trendRisk?: ExportTrendPoint[];
  /** Status-by-period counts powering the Jobs-by-status chart. */
  statusByPeriod?: ExportStatusByPeriodRow[];
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

  // Trend series (chart underlying data)
  if (options.trendJobsCreated && options.trendJobsCreated.length > 0) {
    rows.push([]);
    rows.push(['Trend: Jobs created (by period)', 'Period', 'Value']);
    options.trendJobsCreated.forEach((p) => rows.push([p.period, String(p.value)]));
  }
  if (options.trendJobsCompleted && options.trendJobsCompleted.length > 0) {
    rows.push([]);
    rows.push(['Trend: Jobs completed (by period)', 'Period', 'Value']);
    options.trendJobsCompleted.forEach((p) => rows.push([p.period, String(p.value)]));
  }
  if (options.trendCompletionPct && options.trendCompletionPct.length > 0) {
    rows.push([]);
    rows.push(['Trend: Completion % (by period)', 'Period', 'Value']);
    options.trendCompletionPct.forEach((p) => rows.push([p.period, String(p.value)]));
  }
  if (options.trendRisk && options.trendRisk.length > 0) {
    rows.push([]);
    rows.push(['Trend: Risk (by period)', 'Period', 'Value']);
    options.trendRisk.forEach((p) => rows.push([p.period, String(p.value)]));
  }

  // Status-by-period (Jobs-by-status chart)
  if (options.statusByPeriod && options.statusByPeriod.length > 0) {
    rows.push([]);
    const statusCols = new Set<string>();
    options.statusByPeriod.forEach((row) => {
      Object.keys(row).forEach((k) => { if (k !== 'period') statusCols.add(k); });
    });
    const headers = ['Status by period', 'Period', ...Array.from(statusCols).sort()];
    rows.push(headers);
    options.statusByPeriod.forEach((row) => {
      const r = [row.period];
      headers.slice(2).forEach((col) => r.push(String(row[col] ?? '')));
      rows.push(r);
    });
  }

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

export type ExportTrendSummary = { label: string; value: string };

export async function buildDashboardPdf(options: {
  periodLabel: string;
  kpis: ExportKpi[];
  insights: ExportInsight[];
  /** Condensed trend summaries (e.g. "Jobs created", "Avg risk") for the period. */
  trendSummaries?: ExportTrendSummary[];
  /** Top hazards by frequency (e.g. top 10). */
  hazards?: ExportHazardRow[];
  /** Team performance rows. */
  team?: ExportTeamRow[];
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  let currentPage = doc.addPage([595, 842]);
  const margin = 50;
  const minY = margin + 40;
  let y = currentPage.getHeight() - margin;

  const draw = (text: string, size: number, bold = false) => {
    const f = bold ? fontBold : font;
    currentPage.drawText(text, { x: margin, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
    y -= size + 4;
  };

  draw('Analytics Dashboard', 18, true);
  draw(`Period: ${options.periodLabel}`, 10);
  y -= 12;

  draw('Summary KPIs', 14, true);
  options.kpis.forEach((k) => draw(`${k.title}: ${k.value}`, 10));
  y -= 12;

  if (options.trendSummaries && options.trendSummaries.length > 0) {
    if (y < minY) {
      currentPage = doc.addPage([595, 842]);
      y = currentPage.getHeight() - margin;
    }
    draw('Trend summary', 14, true);
    options.trendSummaries.slice(0, 8).forEach((t) => draw(`${t.label}: ${t.value}`, 10));
    y -= 12;
  }

  draw('Insights', 14, true);
  options.insights.slice(0, 10).forEach((i) => {
    if (y < minY) {
      currentPage = doc.addPage([595, 842]);
      y = currentPage.getHeight() - margin;
    }
    draw(`${i.title} (${i.severity})`, 10);
    const desc = i.description.slice(0, 80) + (i.description.length > 80 ? '…' : '');
    currentPage.drawText(desc, { x: margin + 10, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
    y -= 20;
  });
  y -= 12;

  if (options.hazards && options.hazards.length > 0) {
    if (y < minY) {
      currentPage = doc.addPage([595, 842]);
      y = currentPage.getHeight() - margin;
    }
    draw('Top hazards', 14, true);
    options.hazards.slice(0, 10).forEach((h) => draw(`${h.category}: ${h.count} (avg risk ${h.avgRisk})`, 9));
    y -= 12;
  }

  if (options.team && options.team.length > 0) {
    if (y < minY) {
      currentPage = doc.addPage([595, 842]);
      y = currentPage.getHeight() - margin;
    }
    draw('Team performance', 14, true);
    options.team.slice(0, 15).forEach((t) => {
      draw(`${t.name}: ${t.completed}/${t.assigned} (${t.rate}%), avg ${t.avgDays}d, overdue ${t.overdue}`, 9);
    });
  }

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
