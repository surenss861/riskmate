import React from "react";
import { Text, Link } from "@react-email/components";
import { render, toPlainText } from "@react-email/render";
import { EmailLayout } from "./EmailLayout";

export interface WelcomeEmailInput {
  userName: string;
  managePreferencesUrl?: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

function WelcomeEmailComponent({ input }: { input: WelcomeEmailInput }) {
  const frontendUrl = process.env.FRONTEND_URL || "https://www.riskmate.dev";

  return (
    <EmailLayout
      title="Welcome to RiskMate"
      intro={`Hi ${input.userName}, welcome aboard.`}
      ctaLabel="Create Your First Job →"
      ctaUrl={`${frontendUrl}/jobs/new`}
      managePreferencesUrl={input.managePreferencesUrl}
    >
      <Text style={{ margin: "0 0 12px 18px", padding: 0, color: "#374151" } as React.CSSProperties}>
        <ol style={{ margin: 0, padding: 0 }}>
          <li>Create your first job</li>
          <li>Add hazards and controls</li>
          <li>Generate and sign reports</li>
        </ol>
      </Text>
      <Text style={{ margin: 0 }}>
        <Link
          href={`${frontendUrl}/docs`}
          style={{ color: "#007aff", textDecoration: "none" }}
        >
          Read the docs
        </Link>
      </Text>
    </EmailLayout>
  );
}

export async function WelcomeEmail(
  input: WelcomeEmailInput
): Promise<EmailTemplate> {
  const html = await render(
    React.createElement(WelcomeEmailComponent, { input })
  );
  const text = toPlainText(html);
  return {
    subject: "Welcome to RiskMate",
    html,
    text: text || `Hi ${input.userName}, welcome to RiskMate.`,
  };
}
