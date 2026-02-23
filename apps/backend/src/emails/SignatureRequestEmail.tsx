import React from "react";
import { Text } from "@react-email/components";
import { render, toPlainText } from "@react-email/render";
import { EmailLayout } from "./EmailLayout";

export interface SignatureRequestEmailInput {
  userName: string;
  reportName: string;
  jobTitle: string;
  reportRunId: string;
  deadline?: string;
  managePreferencesUrl?: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

function SignatureRequestEmailComponent({
  input,
}: {
  input: SignatureRequestEmailInput;
}) {
  const frontendUrl = process.env.FRONTEND_URL || "https://www.riskmate.dev";

  return (
    <EmailLayout
      title="Signature requested"
      intro={`Hi ${input.userName}, your signature is needed for a report.`}
      ctaLabel="Sign Now →"
      ctaUrl={`${frontendUrl}/reports/${input.reportRunId}`}
      managePreferencesUrl={input.managePreferencesUrl}
    >
      <Text style={{ margin: "0 0 8px" }}>
        <strong>Report:</strong> {input.reportName}
      </Text>
      <Text style={{ margin: "0 0 8px" }}>
        <strong>Job:</strong> {input.jobTitle}
      </Text>
      {input.deadline && (
        <Text style={{ margin: "0 0 8px", color: "#b45309" }}>
          <strong>Deadline:</strong> {input.deadline}
        </Text>
      )}
      <Text style={{ margin: 0, color: "#6b7280", fontSize: "13px" }}>
        Verification hash: {input.reportRunId}
      </Text>
    </EmailLayout>
  );
}

export async function SignatureRequestEmail(
  input: SignatureRequestEmailInput
): Promise<EmailTemplate> {
  const html = await render(
    React.createElement(SignatureRequestEmailComponent, { input })
  );
  const text = toPlainText(html);
  return {
    subject: `Signature requested: ${input.reportName}`,
    html,
    text:
      text ||
      `Hi ${input.userName}, sign ${input.reportName} for ${input.jobTitle}.`,
  };
}
