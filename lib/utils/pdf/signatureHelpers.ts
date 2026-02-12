/**
 * Shared signature SVG parsing and rendering helpers
 * Used by both production PDF generation and tests
 */

/** Collect all path d attributes and polyline points (as path d) from SVG string */
export function extractAllPathDs(svg: string): string[] {
  if (!svg || typeof svg !== 'string') return [];
  const result: string[] = [];
  const pathRegex = /d\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = pathRegex.exec(svg)) !== null) {
    const d = match[1].trim();
    if (d) result.push(d);
  }
  const polylineRegex = /<polyline[^>]*points\s*=\s*["']([^"']+)["']/gi;
  while ((match = polylineRegex.exec(svg)) !== null) {
    const pointsStr = match[1].trim();
    const points = pointsStr.split(/\s+/).map((p) => {
      const [x, y] = p.split(',').map(Number);
      return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 };
    });
    if (points.length >= 2) {
      const d = 'M ' + points.map((pt, i) => (i === 0 ? `${pt.x} ${pt.y}` : `L ${pt.x} ${pt.y}`)).join(' ');
      result.push(d);
    }
  }
  return result;
}

/** Parse viewBox from SVG to get width/height for scaling (e.g. viewBox="0 0 400 100") */
export function getViewBox(svg: string): { w: number; h: number } | null {
  const match = svg.match(/viewBox\s*=\s*["']?\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)["']?/i);
  if (!match) return null;
  const w = parseFloat(match[1]);
  const h = parseFloat(match[2]);
  return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? { w, h } : null;
}

/**
 * Draw signature SVG path(s) into the given box. All path/polyline strokes are collected,
 * scaled to fit the box (viewBox-based), and drawn so multi-stroke signatures render fully.
 * PDFKit accepts SVG path syntax in .path().
 */
export function drawSignatureSvgPath(
  doc: PDFKit.PDFDocument,
  signatureSvg: string,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  strokeColor: string = '#000000',
  lineWidth: number = 1
): void {
  const pathDs = extractAllPathDs(signatureSvg);
  if (pathDs.length === 0) return;

  const viewBox = getViewBox(signatureSvg);
  const srcW = viewBox?.w ?? 400;
  const srcH = viewBox?.h ?? 100;
  const pad = 2;
  const scaleX = (boxW - pad * 2) / srcW;
  const scaleY = (boxH - pad * 2) / srcH;
  const scale = Math.min(scaleX, scaleY, 1.2);
  const offsetX = boxX + pad + (boxW - pad * 2 - srcW * scale) / 2;
  const offsetY = boxY + pad + (boxH - pad * 2 - srcH * scale) / 2;

  doc.save();
  doc.translate(offsetX, offsetY);
  doc.scale(scale);
  doc
    .strokeColor(strokeColor)
    .lineWidth(lineWidth);
  for (const pathD of pathDs) {
    try {
      doc.path(pathD).stroke();
    } catch {
      // If path() throws (malformed d), skip this stroke
    }
  }
  doc.restore();
}
