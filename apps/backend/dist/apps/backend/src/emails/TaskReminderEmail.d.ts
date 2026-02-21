import { type EmailTemplate } from "./base";
export interface TaskReminderEmailInput {
    userName: string;
    taskTitle: string;
    jobTitle: string;
    dueDate: string | null;
    isOverdue: boolean;
    hoursRemaining?: number;
    jobId?: string;
    taskId?: string;
}
export declare function TaskReminderEmail(input: TaskReminderEmailInput): EmailTemplate;
//# sourceMappingURL=TaskReminderEmail.d.ts.map