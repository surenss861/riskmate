export interface ReportReadyEmailInput {
    userName: string;
    jobTitle: string;
    downloadUrl: string;
    viewUrl: string;
    managePreferencesUrl?: string;
}
export interface EmailTemplate {
    subject: string;
    html: string;
    text: string;
}
export declare function ReportReadyEmail(input: ReportReadyEmailInput): Promise<EmailTemplate>;
//# sourceMappingURL=ReportReadyEmail.d.ts.map