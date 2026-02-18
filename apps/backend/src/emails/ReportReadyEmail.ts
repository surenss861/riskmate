import { type EmailTemplate, e, layout } from "./base";

export interface ReportReadyEmailInput {
  userName: string;
  jobTitle: string;
  downloadUrl: string;
  viewUrl: string;
}

export function ReportReadyEmail(input: ReportReadyEmailInput): EmailTemplate {
  const html = layout({
    title: "Your report is ready",
    intro: `Hi ${input.userName}, your report for ${input.jobTitle} is now available.`,
    bodyHtml: `<p style="margin:0 0 8px;">You can download the PDF now or view it online.</p>
      <p style="margin:0;"><a href="${e(input.viewUrl)}" style="color:#007aff;text-decoration:none;">View Online</a></p>`,
    ctaLabel: "Download Report →",
    ctaUrl: input.downloadUrl,
  });

  return {
    subject: `Report ready: ${input.jobTitle}`,
    html,
    text: `Hi ${input.userName}, the report for ${input.jobTitle} is ready. Download: ${input.downloadUrl}`,
  };
}
