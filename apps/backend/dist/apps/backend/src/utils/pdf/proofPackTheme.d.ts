interface HeaderOptions {
    title: string;
    packId?: string;
    organizationName?: string;
    generatedBy?: string;
    generatedByRole?: string;
    generatedAt?: string;
    timeRange?: string;
}
interface FooterOptions {
    pageNumber: number;
    totalPages?: number;
    packId?: string;
}
interface KPIRow {
    label: string;
    value: string | number;
    highlight?: boolean;
}
interface TableColumn {
    header: string;
    width: number;
    align?: 'left' | 'center' | 'right';
}
interface TableOptions {
    columns: TableColumn[];
    rows: any[][];
    zebraStriping?: boolean;
    rowHeight?: number;
    fontSize?: number;
}
/**
 * Shared PDF theme for all proof pack PDFs
 */
export declare function drawHeader(doc: PDFKit.PDFDocument, options: HeaderOptions): void;
export declare function drawFooter(doc: PDFKit.PDFDocument, options: FooterOptions): void;
export declare function drawSectionTitle(doc: PDFKit.PDFDocument, text: string): void;
export declare function drawKpiRow(doc: PDFKit.PDFDocument, stats: KPIRow[]): void;
export declare function drawTable(doc: PDFKit.PDFDocument, options: TableOptions): void;
export declare function drawEmptyState(doc: PDFKit.PDFDocument, options: {
    title: string;
    message: string;
    filters?: Record<string, any>;
    actionHint?: string;
}): void;
export declare function formatHashShort(hash: string, length?: number): string;
export declare function initPage(doc: PDFKit.PDFDocument): void;
/**
 * Finalize PDF with proper page buffering and footers
 * PDFDocument must be created with bufferPages: true option
 */
export declare function finalizePdf(doc: PDFKit.PDFDocument, meta: {
    packId: string;
}): void;
export {};
//# sourceMappingURL=proofPackTheme.d.ts.map