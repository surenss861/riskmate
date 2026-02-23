import React from "react";
import { Section, Text } from "@react-email/components";
import { render, toPlainText } from "@react-email/render";
import { EmailLayout } from "./EmailLayout";
import { formatDate } from "./base";

export interface JobAssignedEmailInput {
  userName: string;
  assignedByName: string;
  job: {
    id?: string;
    title?: string | null;
    client_name?: string | null;
    location?: string | null;
    due_date?: string | null;
    risk_level?: string | null;
  };
  managePreferencesUrl?: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

function JobAssignedEmailComponent({ input }: { input: JobAssignedEmailInput }) {
  const frontendUrl = process.env.FRONTEND_URL || "https://www.riskmate.dev";
  const jobTitle = input.job.title || input.job.client_name || "Untitled job";
  const risk = input.job.risk_level || "unknown";

  return (
    <EmailLayout
      title="You were assigned to a job"
      intro={`Hi ${input.userName}, ${input.assignedByName} assigned a job to you.`}
      ctaLabel="View Job Details →"
      ctaUrl={`${frontendUrl}/jobs/${input.job.id || ""}`}
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
          <strong>Title:</strong> {jobTitle}
        </Text>
        <Text style={{ margin: "0 0 8px" }}>
          <strong>Client:</strong> {input.job.client_name || "Not set"}
        </Text>
        <Text style={{ margin: "0 0 8px" }}>
          <strong>Location:</strong> {input.job.location || "Not set"}
        </Text>
        <Text style={{ margin: "0 0 8px" }}>
          <strong>Due date:</strong> {formatDate(input.job.due_date)}
        </Text>
        <Text style={{ margin: 0 }}>
          <strong>Risk:</strong>{" "}
          <span
            style={{
              display: "inline-block",
              padding: "2px 8px",
              borderRadius: "999px",
              backgroundColor: "#e0f2fe",
              color: "#0c4a6e",
            }}
          >
            {risk}
          </span>
        </Text>
      </Section>
    </EmailLayout>
  );
}

export async function JobAssignedEmail(input: JobAssignedEmailInput): Promise<EmailTemplate> {
  const jobTitle = input.job.title || input.job.client_name || "Untitled job";
  const html = await render(React.createElement(JobAssignedEmailComponent, { input }));
  const text = toPlainText(html);
  return {
    subject: `Job assigned: ${jobTitle}`,
    html,
    text: text || `Hi ${input.userName}, ${input.assignedByName} assigned you to ${jobTitle}.`,
  };
}
