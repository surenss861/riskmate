import { type EmailTemplate } from "./base";
export interface JobAssignedEmailInput {
    userName: string;
    assignedByName: string;
    job: {
        id?: string;
        title?: string | null;
        client_name?: string | null;
        location?: string | null;
        due_date?: string | null;
        risk_level?: string | null;
    };
}
export declare function JobAssignedEmail(input: JobAssignedEmailInput): EmailTemplate;
//# sourceMappingURL=JobAssignedEmail.d.ts.map