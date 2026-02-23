import React from "react";
import { Text } from "@react-email/components";
import { render, toPlainText } from "@react-email/render";
import { EmailLayout } from "./EmailLayout";
import { truncate } from "./base";

export interface MentionEmailInput {
  userName: string;
  mentionedByName: string;
  jobName: string;
  commentPreview: string;
  commentUrl: string;
  managePreferencesUrl?: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

function MentionEmailComponent({ input }: { input: MentionEmailInput }) {
  const preview = truncate(input.commentPreview || "", 150);

  return (
    <EmailLayout
      title="You were mentioned"
      intro={`${input.mentionedByName} mentioned you on ${input.jobName}.`}
      ctaLabel="View Comment →"
      ctaUrl={input.commentUrl}
      managePreferencesUrl={input.managePreferencesUrl}
    >
      <Text
        style={{
          margin: 0,
          padding: "12px 14px",
          backgroundColor: "#f9fafb",
          borderLeft: "4px solid #007aff",
          color: "#374151",
        }}
      >
        {preview}
      </Text>
    </EmailLayout>
  );
}

export async function MentionEmail(
  input: MentionEmailInput
): Promise<EmailTemplate> {
  const preview = truncate(input.commentPreview || "", 150);
  const html = await render(
    React.createElement(MentionEmailComponent, { input })
  );
  const text = toPlainText(html);
  return {
    subject: `Mention from ${input.mentionedByName}`,
    html,
    text: text || `${input.mentionedByName} mentioned you: ${preview}`,
  };
}
