export interface TeamInviteEmailInput {
    orgName: string;
    inviterName: string;
    tempPassword: string;
    loginUrl: string;
    managePreferencesUrl?: string;
}
export interface EmailTemplate {
    subject: string;
    html: string;
    text: string;
}
export declare function TeamInviteEmail(input: TeamInviteEmailInput): Promise<EmailTemplate>;
//# sourceMappingURL=TeamInviteEmail.d.ts.map