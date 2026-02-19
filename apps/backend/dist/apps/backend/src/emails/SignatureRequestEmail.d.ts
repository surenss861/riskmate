import { type EmailTemplate } from "./base";
export interface SignatureRequestEmailInput {
    userName: string;
    reportName: string;
    jobTitle: string;
    reportRunId: string;
    deadline?: string;
}
export declare function SignatureRequestEmail(input: SignatureRequestEmailInput): EmailTemplate;
//# sourceMappingURL=SignatureRequestEmail.d.ts.map