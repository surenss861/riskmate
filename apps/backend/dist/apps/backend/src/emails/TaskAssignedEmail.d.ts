import { type EmailTemplate } from "./base";
export interface TaskAssignedEmailInput {
    userName: string;
    taskTitle: string;
    jobTitle: string;
    jobId: string;
    taskId: string;
}
export declare function TaskAssignedEmail(input: TaskAssignedEmailInput): EmailTemplate;
//# sourceMappingURL=TaskAssignedEmail.d.ts.map