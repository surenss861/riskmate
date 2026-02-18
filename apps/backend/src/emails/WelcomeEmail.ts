import { type EmailTemplate, e, layout } from "./base";

export interface WelcomeEmailInput {
  userName: string;
}

export function WelcomeEmail(input: WelcomeEmailInput): EmailTemplate {
  const frontendUrl = process.env.FRONTEND_URL || "https://www.riskmate.dev";
  const html = layout({
    title: "Welcome to RiskMate",
    intro: `Hi ${input.userName}, welcome aboard.`,
    bodyHtml: `
      <ol style="margin:0 0 12px 18px;padding:0;color:#374151;">
        <li>Create your first job</li>
        <li>Add hazards and controls</li>
        <li>Generate and sign reports</li>
      </ol>
      <p style="margin:0;"><a href="${e(`${frontendUrl}/docs`)}" style="color:#007aff;text-decoration:none;">Read the docs</a></p>
    `,
    ctaLabel: "Create Your First Job →",
    ctaUrl: `${frontendUrl}/jobs/new`,
  });

  return {
    subject: "Welcome to RiskMate",
    html,
    text: `Hi ${input.userName}, welcome to RiskMate.`,
  };
}
