export interface MentionEmailInput {
    userName: string;
    mentionedByName: string;
    jobName: string;
    commentPreview: string;
    commentUrl: string;
    managePreferencesUrl?: string;
}
export interface EmailTemplate {
    subject: string;
    html: string;
    text: string;
}
export declare function MentionEmail(input: MentionEmailInput): Promise<EmailTemplate>;
//# sourceMappingURL=MentionEmail.d.ts.map