import { type EmailTemplate } from "./base";
export interface MentionEmailInput {
    userName: string;
    mentionedByName: string;
    jobName: string;
    commentPreview: string;
    commentUrl: string;
}
export declare function MentionEmail(input: MentionEmailInput): EmailTemplate;
//# sourceMappingURL=MentionEmail.d.ts.map