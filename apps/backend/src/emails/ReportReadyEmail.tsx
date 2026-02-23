import React from "react";
import { Text, Link } from "@react-email/components";
import { render, toPlainText } from "@react-email/render";
import { EmailLayout } from "./EmailLayout";

export interface ReportReadyEmailInput {
  userName: string;
  jobTitle: string;
  downloadUrl: string;
  viewUrl: string;
  managePreferencesUrl?: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

function ReportReadyEmailComponent({ input }: { input: ReportReadyEmailInput }) {
  return (
    <EmailLayout
      title="Your report is ready"
      intro={`Hi ${input.userName}, your report for ${input.jobTitle} is now available.`}
      ctaLabel="Download Report →"
      ctaUrl={input.downloadUrl}
      managePreferencesUrl={input.managePreferencesUrl}
    >
      <Text style={{ margin: "0 0 8px" }}>
        You can download the PDF now or view it online.
      </Text>
      <Text style={{ margin: 0 }}>
        <Link href={input.viewUrl} style={{ color: "#007aff", textDecoration: "none" }}>
          View Online
        </Link>
      </Text>
    </EmailLayout>
  );
}

export async function ReportReadyEmail(
  input: ReportReadyEmailInput
): Promise<EmailTemplate> {
  const html = await render(
    React.createElement(ReportReadyEmailComponent, { input })
  );
  const text = toPlainText(html);
  return {
    subject: `Report ready: ${input.jobTitle}`,
    html,
    text:
      text ||
      `Hi ${input.userName}, the report for ${input.jobTitle} is ready. Download: ${input.downloadUrl}`,
  };
}
