export interface SignatureRequestEmailInput {
    userName: string;
    reportName: string;
    jobTitle: string;
    reportRunId: string;
    deadline?: string;
    managePreferencesUrl?: string;
}
export interface EmailTemplate {
    subject: string;
    html: string;
    text: string;
}
export declare function SignatureRequestEmail(input: SignatureRequestEmailInput): Promise<EmailTemplate>;
//# sourceMappingURL=SignatureRequestEmail.d.ts.map