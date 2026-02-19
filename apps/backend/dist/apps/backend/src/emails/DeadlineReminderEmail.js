"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeadlineReminderEmail = DeadlineReminderEmail;
const base_1 = require("./base");
function DeadlineReminderEmail(input) {
    const frontendUrl = process.env.FRONTEND_URL || "https://www.riskmate.dev";
    const jobTitle = input.job.title || input.job.client_name || "Untitled job";
    const html = (0, base_1.layout)({
        title: "Deadline reminder",
        intro: `Hi ${input.userName}, a due date is approaching.`,
        bodyHtml: `
      <p style="margin:0 0 8px;"><strong>Job:</strong> ${(0, base_1.e)(jobTitle)}</p>
      <p style="margin:0 0 8px;"><strong>Client:</strong> ${(0, base_1.e)(input.job.client_name || "Not set")}</p>
      <p style="margin:0 0 8px;"><strong>Due:</strong> ${(0, base_1.e)((0, base_1.formatDate)(input.job.due_date))}</p>
      <p style="margin:0;color:#b45309;"><strong>${Math.max(0, Math.round(input.hoursRemaining))} hours remaining</strong></p>
    `,
        ctaLabel: "View Job →",
        ctaUrl: `${frontendUrl}/jobs/${input.job.id || ""}`,
    });
    return {
        subject: `Deadline reminder: ${jobTitle}`,
        html,
        text: `${jobTitle} is due soon (${Math.round(input.hoursRemaining)}h remaining).`,
    };
}
//# sourceMappingURL=DeadlineReminderEmail.js.map