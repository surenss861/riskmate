import React from "react";
import { Text } from "@react-email/components";
import { render, toPlainText } from "@react-email/render";
import { EmailLayout } from "./EmailLayout";
import { formatDate } from "./base";

export interface DeadlineReminderEmailInput {
  userName: string;
  job: {
    id?: string;
    title?: string | null;
    client_name?: string | null;
    due_date?: string | null;
  };
  hoursRemaining: number;
  managePreferencesUrl?: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

function DeadlineReminderEmailComponent({
  input,
}: {
  input: DeadlineReminderEmailInput;
}) {
  const frontendUrl = process.env.FRONTEND_URL || "https://www.riskmate.dev";
  const jobTitle =
    input.job.title || input.job.client_name || "Untitled job";

  return (
    <EmailLayout
      title="Deadline reminder"
      intro={`Hi ${input.userName}, a due date is approaching.`}
      ctaLabel="View Job →"
      ctaUrl={`${frontendUrl}/jobs/${input.job.id || ""}`}
      managePreferencesUrl={input.managePreferencesUrl}
    >
      <Text style={{ margin: "0 0 8px" }}>
        <strong>Job:</strong> {jobTitle}
      </Text>
      <Text style={{ margin: "0 0 8px" }}>
        <strong>Client:</strong> {input.job.client_name || "Not set"}
      </Text>
      <Text style={{ margin: "0 0 8px" }}>
        <strong>Due:</strong> {formatDate(input.job.due_date)}
      </Text>
      <Text
        style={{
          margin: 0,
          color: "#b45309",
        }}
      >
        <strong>
          {Math.max(0, Math.round(input.hoursRemaining))} hours remaining
        </strong>
      </Text>
    </EmailLayout>
  );
}

export async function DeadlineReminderEmail(
  input: DeadlineReminderEmailInput
): Promise<EmailTemplate> {
  const jobTitle =
    input.job.title || input.job.client_name || "Untitled job";
  const html = await render(
    React.createElement(DeadlineReminderEmailComponent, { input })
  );
  const text = toPlainText(html);
  return {
    subject: `Deadline reminder: ${jobTitle}`,
    html,
    text:
      text ||
      `${jobTitle} is due soon (${Math.round(input.hoursRemaining)}h remaining).`,
  };
}
