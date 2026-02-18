import { type EmailTemplate, e, layout } from "./base";

export interface SignatureRequestEmailInput {
  userName: string;
  reportName: string;
  jobTitle: string;
  reportRunId: string;
  deadline?: string;
}

export function SignatureRequestEmail(input: SignatureRequestEmailInput): EmailTemplate {
  const frontendUrl = process.env.FRONTEND_URL || "https://www.riskmate.dev";
  const html = layout({
    title: "Signature requested",
    intro: `Hi ${input.userName}, your signature is needed for a report.`,
    bodyHtml: `
      <p style="margin:0 0 8px;"><strong>Report:</strong> ${e(input.reportName)}</p>
      <p style="margin:0 0 8px;"><strong>Job:</strong> ${e(input.jobTitle)}</p>
      ${input.deadline ? `<p style="margin:0 0 8px;color:#b45309;"><strong>Deadline:</strong> ${e(input.deadline)}</p>` : ""}
      <p style="margin:0;color:#6b7280;font-size:13px;">Verification hash: ${e(input.reportRunId)}</p>
    `,
    ctaLabel: "Sign Now →",
    ctaUrl: `${frontendUrl}/reports/${input.reportRunId}`,
  });

  return {
    subject: `Signature requested: ${input.reportName}`,
    html,
    text: `Hi ${input.userName}, sign ${input.reportName} for ${input.jobTitle}.`,
  };
}
