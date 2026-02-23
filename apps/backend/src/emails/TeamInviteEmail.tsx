import React from "react";
import { Text } from "@react-email/components";
import { render, toPlainText } from "@react-email/render";
import { EmailLayout } from "./EmailLayout";

export interface TeamInviteEmailInput {
  orgName: string;
  inviterName: string;
  tempPassword: string;
  loginUrl: string;
  managePreferencesUrl?: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

function TeamInviteEmailComponent({ input }: { input: TeamInviteEmailInput }) {
  return (
    <EmailLayout
      title="You were invited to RiskMate"
      intro={`${input.inviterName} invited you to join ${input.orgName}.`}
      ctaLabel="Accept Invitation →"
      ctaUrl={input.loginUrl}
      managePreferencesUrl={input.managePreferencesUrl}
    >
      <Text style={{ margin: "0 0 10px" }}>
        <strong>Temporary password:</strong>
      </Text>
      <Text
        style={{
          margin: "0 0 12px",
          padding: "12px",
          borderRadius: "8px",
          backgroundColor: "#f3f4f6",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      >
        {input.tempPassword}
      </Text>
      <Text style={{ margin: 0, color: "#b45309" }}>
        This invite expires in 7 days.
      </Text>
    </EmailLayout>
  );
}

export async function TeamInviteEmail(
  input: TeamInviteEmailInput
): Promise<EmailTemplate> {
  const html = await render(
    React.createElement(TeamInviteEmailComponent, { input })
  );
  const text = toPlainText(html);
  return {
    subject: `Invitation to join ${input.orgName}`,
    html,
    text:
      text ||
      `You were invited to ${input.orgName}. Temporary password: ${input.tempPassword}`,
  };
}
