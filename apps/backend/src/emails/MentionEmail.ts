import { type EmailTemplate, e, layout, truncate } from "./base";

export interface MentionEmailInput {
  userName: string;
  mentionedByName: string;
  jobName: string;
  commentPreview: string;
  commentUrl: string;
}

export function MentionEmail(input: MentionEmailInput): EmailTemplate {
  const preview = truncate(input.commentPreview || "", 150);
  const html = layout({
    title: "You were mentioned",
    intro: `${input.mentionedByName} mentioned you on ${input.jobName}.`,
    bodyHtml: `
      <blockquote style="margin:0;padding:12px 14px;background:#f9fafb;border-left:4px solid #007aff;color:#374151;">${e(preview)}</blockquote>
    `,
    ctaLabel: "View Comment →",
    ctaUrl: input.commentUrl,
  });

  return {
    subject: `Mention from ${input.mentionedByName}`,
    html,
    text: `${input.mentionedByName} mentioned you: ${preview}`,
  };
}
