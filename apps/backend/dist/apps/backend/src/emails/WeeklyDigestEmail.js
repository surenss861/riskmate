"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeeklyDigestEmail = WeeklyDigestEmail;
const base_1 = require("./base");
function WeeklyDigestEmail(input) {
    const attention = input.digest.needsAttention.length === 0
        ? "<li>None</li>"
        : input.digest.needsAttention
            .map((item) => `<li>${(0, base_1.e)(item.title)} <span style="color:${item.status === "overdue" ? "#b91c1c" : "#92400e"}">(${item.status === "overdue" ? "overdue" : "due soon"})</span></li>`)
            .join("");
    const completed = input.digest.completedThisWeek.length === 0
        ? "<li>None</li>"
        : input.digest.completedThisWeek
            .map((item) => `<li>${(0, base_1.e)(item.title)} (${(0, base_1.e)((0, base_1.formatDate)(item.completedAt))})</li>`)
            .join("");
    const frontendUrl = process.env.FRONTEND_URL || "https://www.riskmate.dev";
    const html = (0, base_1.layout)({
        title: "Weekly digest",
        intro: `Hi ${input.userName}, here is your weekly compliance summary.`,
        bodyHtml: `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 14px;border-collapse:collapse;">
        <tr>
          <td style="border:1px solid #e5e7eb;padding:10px;"><strong>Active</strong><br/>${input.digest.activeJobs}</td>
          <td style="border:1px solid #e5e7eb;padding:10px;"><strong>Completed</strong><br/>${input.digest.completedJobs}</td>
          <td style="border:1px solid #e5e7eb;padding:10px;"><strong>Overdue</strong><br/>${input.digest.overdueJobs}</td>
        </tr>
      </table>
      <p style="margin:0 0 6px;"><strong>Needs Attention</strong></p>
      <ul style="margin:0 0 14px 18px;padding:0;">${attention}</ul>
      <p style="margin:0 0 6px;"><strong>Completed This Week</strong></p>
      <ul style="margin:0 0 6px 18px;padding:0;">${completed}</ul>
    `,
        ctaLabel: "View Full Dashboard →",
        ctaUrl: `${frontendUrl}/dashboard`,
    });
    return {
        subject: "Your weekly RiskMate digest",
        html,
        text: `Active: ${input.digest.activeJobs}, completed: ${input.digest.completedJobs}, overdue: ${input.digest.overdueJobs}`,
    };
}
//# sourceMappingURL=WeeklyDigestEmail.js.map