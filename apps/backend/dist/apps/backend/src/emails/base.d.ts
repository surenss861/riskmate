export interface EmailTemplate {
    subject: string;
    html: string;
    text: string;
}
export declare function e(value: unknown): string;
export declare function truncate(value: string, max?: number): string;
export declare function formatDate(value?: string | null): string;
export declare function layout(params: {
    title: string;
    intro: string;
    bodyHtml: string;
    ctaLabel?: string;
    ctaUrl?: string;
}): string;
//# sourceMappingURL=base.d.ts.map