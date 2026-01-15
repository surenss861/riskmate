interface EmailOptions {
    to: string | string[];
    subject: string;
    html: string;
    from?: string;
}
export declare function sendEmail(options: EmailOptions): Promise<void>;
export declare function hashAlertPayload(payload: Record<string, unknown>): string;
export {};
//# sourceMappingURL=email.d.ts.map