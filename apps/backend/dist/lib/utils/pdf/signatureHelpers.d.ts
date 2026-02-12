/**
 * Shared signature SVG parsing and rendering helpers
 * Used by both production PDF generation and tests
 */
/** Collect all path d attributes and polyline points (as path d) from SVG string */
export declare function extractAllPathDs(svg: string): string[];
/** Parse viewBox from SVG to get dimensions (returns only width and height for backward compatibility) */
export declare function getViewBox(svg: string): {
    w: number;
    h: number;
} | null;
/**
 * Draw signature SVG path(s) into the given box. All path/polyline strokes are collected,
 * scaled to fit the box (viewBox-based), and drawn so multi-stroke signatures render fully.
 * PDFKit accepts SVG path syntax in .path().
 * Handles non-zero viewBox origins by translating paths before scaling.
 */
export declare function drawSignatureSvgPath(doc: PDFKit.PDFDocument, signatureSvg: string, boxX: number, boxY: number, boxW: number, boxH: number, strokeColor?: string, lineWidth?: number): void;
//# sourceMappingURL=signatureHelpers.d.ts.map