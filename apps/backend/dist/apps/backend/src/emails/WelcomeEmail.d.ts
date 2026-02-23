import { type EmailTemplate } from "./base";
export interface WelcomeEmailInput {
    userName: string;
    managePreferencesUrl?: string;
}
export declare function WelcomeEmail(input: WelcomeEmailInput): EmailTemplate;
//# sourceMappingURL=WelcomeEmail.d.ts.map