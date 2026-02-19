import { type EmailTemplate } from "./base";
export interface TeamInviteEmailInput {
    orgName: string;
    inviterName: string;
    tempPassword: string;
    loginUrl: string;
}
export declare function TeamInviteEmail(input: TeamInviteEmailInput): EmailTemplate;
//# sourceMappingURL=TeamInviteEmail.d.ts.map