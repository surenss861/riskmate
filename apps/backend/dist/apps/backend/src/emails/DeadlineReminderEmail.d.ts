import { type EmailTemplate } from "./base";
export interface DeadlineReminderEmailInput {
    userName: string;
    job: {
        id?: string;
        title?: string | null;
        client_name?: string | null;
        due_date?: string | null;
    };
    hoursRemaining: number;
}
export declare function DeadlineReminderEmail(input: DeadlineReminderEmailInput): EmailTemplate;
//# sourceMappingURL=DeadlineReminderEmail.d.ts.map