import React from "react";
import { Section, Text } from "@react-email/components";
import { render, toPlainText } from "@react-email/render";
import { EmailLayout } from "./EmailLayout";
import { formatDate } from "./base";

export interface WeeklyDigestData {
  activeJobs: number;
  completedJobs: number;
  overdueJobs: number;
  needsAttention: Array<{ title: string; status: "overdue" | "due_soon" }>;
  completedThisWeek: Array<{ title: string; completedAt: string }>;
}

export interface WeeklyDigestEmailInput {
  userName: string;
  digest: WeeklyDigestData;
  managePreferencesUrl?: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

function WeeklyDigestEmailComponent({
  input,
}: {
  input: WeeklyDigestEmailInput;
}) {
  const frontendUrl = process.env.FRONTEND_URL || "https://www.riskmate.dev";
  const { digest } = input;

  return (
    <EmailLayout
      title="Weekly digest"
      intro={`Hi ${input.userName}, here is your weekly compliance summary.`}
      ctaLabel="View Full Dashboard →"
      ctaUrl={`${frontendUrl}/dashboard`}
      managePreferencesUrl={input.managePreferencesUrl}
    >
      <Section
        style={{
          margin: "0 0 14px",
          borderCollapse: "collapse",
        } as React.CSSProperties}
      >
        <table
          role="presentation"
          width="100%"
          cellSpacing={0}
          cellPadding={0}
          style={{ borderCollapse: "collapse", margin: "0 0 14px" }}
        >
          <tbody>
            <tr>
              <td
                style={{
                  border: "1px solid #e5e7eb",
                  padding: "10px",
                }}
              >
                <strong>Active</strong>
                <br />
                {digest.activeJobs}
              </td>
              <td
                style={{
                  border: "1px solid #e5e7eb",
                  padding: "10px",
                }}
              >
                <strong>Completed</strong>
                <br />
                {digest.completedJobs}
              </td>
              <td
                style={{
                  border: "1px solid #e5e7eb",
                  padding: "10px",
                }}
              >
                <strong>Overdue</strong>
                <br />
                {digest.overdueJobs}
              </td>
            </tr>
          </tbody>
        </table>
      </Section>
      <Text style={{ margin: "0 0 6px" }}>
        <strong>Needs Attention</strong>
      </Text>
      <ul style={{ margin: "0 0 14px 18px", padding: 0 }}>
        {digest.needsAttention.length === 0
          ? "None"
          : digest.needsAttention.map((item, i) => (
              <li key={i}>
                {item.title}{" "}
                <span
                  style={{
                    color:
                      item.status === "overdue" ? "#b91c1c" : "#92400e",
                  }}
                >
                  ({item.status === "overdue" ? "overdue" : "due soon"})
                </span>
              </li>
            ))}
      </ul>
      <Text style={{ margin: "0 0 6px" }}>
        <strong>Completed This Week</strong>
      </Text>
      <ul style={{ margin: "0 0 6px 18px", padding: 0 }}>
        {digest.completedThisWeek.length === 0
          ? "None"
          : digest.completedThisWeek.map((item, i) => (
              <li key={i}>
                {item.title} ({formatDate(item.completedAt)})
              </li>
            ))}
      </ul>
    </EmailLayout>
  );
}

export async function WeeklyDigestEmail(
  input: WeeklyDigestEmailInput
): Promise<EmailTemplate> {
  const html = await render(
    React.createElement(WeeklyDigestEmailComponent, { input })
  );
  const text = toPlainText(html);
  return {
    subject: "Your weekly RiskMate digest",
    html,
    text:
      text ||
      `Active: ${input.digest.activeJobs}, completed: ${input.digest.completedJobs}, overdue: ${input.digest.overdueJobs}`,
  };
}
