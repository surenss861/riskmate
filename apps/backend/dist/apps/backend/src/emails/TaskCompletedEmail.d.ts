import { type EmailTemplate } from "./base";
export interface TaskCompletedEmailInput {
    userName: string;
    taskTitle: string;
    jobTitle: string;
    taskId: string;
    jobId: string;
}
export declare function TaskCompletedEmail(input: TaskCompletedEmailInput): EmailTemplate;
//# sourceMappingURL=TaskCompletedEmail.d.ts.map