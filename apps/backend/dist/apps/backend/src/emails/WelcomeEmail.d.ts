export interface WelcomeEmailInput {
    userName: string;
    managePreferencesUrl?: string;
}
export interface EmailTemplate {
    subject: string;
    html: string;
    text: string;
}
export declare function WelcomeEmail(input: WelcomeEmailInput): Promise<EmailTemplate>;
//# sourceMappingURL=WelcomeEmail.d.ts.map