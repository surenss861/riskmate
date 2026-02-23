import React from "react";
import { Section, Text } from "@react-email/components";
import { render, toPlainText } from "@react-email/render";
import { EmailLayout } from "./EmailLayout";

export interface TaskAssignedEmailInput {
  userName: string;
  taskTitle: string;
  jobTitle: string;
  jobId: string;
  taskId: string;
  managePreferencesUrl?: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

function TaskAssignedEmailComponent({
  input,
}: {
  input: TaskAssignedEmailInput;
}) {
  const frontendUrl = process.env.FRONTEND_URL || "https://www.riskmate.dev";
  const jobTitle = input.jobTitle || "Job";

  return (
    <EmailLayout
      title="Task assigned"
      intro={`Hi ${input.userName}, you've been assigned a task.`}
      ctaLabel="View Task →"
      ctaUrl={`${frontendUrl}/jobs/${input.jobId}/tasks?highlight=${input.taskId}`}
      managePreferencesUrl={input.managePreferencesUrl}
    >
      <Section
        style={{
          padding: "16px",
          border: "1px solid #dbeafe",
          backgroundColor: "#f8fbff",
          borderRadius: "10px",
        }}
      >
        <Text style={{ margin: "0 0 8px" }}>
          <strong>Task:</strong> {input.taskTitle}
        </Text>
        <Text style={{ margin: 0 }}>
          <strong>Job:</strong> {jobTitle}
        </Text>
      </Section>
    </EmailLayout>
  );
}

export async function TaskAssignedEmail(
  input: TaskAssignedEmailInput
): Promise<EmailTemplate> {
  const jobTitle = input.jobTitle || "Job";
  const html = await render(
    React.createElement(TaskAssignedEmailComponent, { input })
  );
  const text = toPlainText(html);
  return {
    subject: `Task assigned: ${input.taskTitle}`,
    html,
    text:
      text ||
      `Hi ${input.userName}, you've been assigned '${input.taskTitle}' on '${jobTitle}'.`,
  };
}
