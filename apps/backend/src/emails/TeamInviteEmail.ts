import { type EmailTemplate, e, layout } from "./base";

export interface TeamInviteEmailInput {
  orgName: string;
  inviterName: string;
  tempPassword: string;
  loginUrl: string;
}

export function TeamInviteEmail(input: TeamInviteEmailInput): EmailTemplate {
  const html = layout({
    title: "You were invited to RiskMate",
    intro: `${input.inviterName} invited you to join ${input.orgName}.`,
    bodyHtml: `
      <p style="margin:0 0 10px;"><strong>Temporary password:</strong></p>
      <p style="margin:0 0 12px;padding:12px;border-radius:8px;background:#f3f4f6;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${e(input.tempPassword)}</p>
      <p style="margin:0;color:#b45309;">This invite expires in 7 days.</p>
    `,
    ctaLabel: "Log In to Accept →",
    ctaUrl: input.loginUrl,
  });

  return {
    subject: `Invitation to join ${input.orgName}`,
    html,
    text: `You were invited to ${input.orgName}. Temporary password: ${input.tempPassword}`,
  };
}
