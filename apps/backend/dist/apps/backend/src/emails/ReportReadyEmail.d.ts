import { type EmailTemplate } from "./base";
export interface ReportReadyEmailInput {
    userName: string;
    jobTitle: string;
    downloadUrl: string;
    viewUrl: string;
}
export declare function ReportReadyEmail(input: ReportReadyEmailInput): EmailTemplate;
//# sourceMappingURL=ReportReadyEmail.d.ts.map