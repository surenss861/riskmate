"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobAssignedEmail = JobAssignedEmail;
const base_1 = require("./base");
function JobAssignedEmail(input) {
    const frontendUrl = process.env.FRONTEND_URL || "https://www.riskmate.dev";
    const jobTitle = input.job.title || input.job.client_name || "Untitled job";
    const risk = input.job.risk_level || "unknown";
    const html = (0, base_1.layout)({
        title: "You were assigned to a job",
        intro: `Hi ${input.userName}, ${input.assignedByName} assigned a job to you.`,
        bodyHtml: `
      <div style="padding:16px;border:1px solid #dbeafe;background:#f8fbff;border-radius:10px;">
        <p style="margin:0 0 8px;"><strong>Title:</strong> ${(0, base_1.e)(jobTitle)}</p>
        <p style="margin:0 0 8px;"><strong>Client:</strong> ${(0, base_1.e)(input.job.client_name || "Not set")}</p>
        <p style="margin:0 0 8px;"><strong>Location:</strong> ${(0, base_1.e)(input.job.location || "Not set")}</p>
        <p style="margin:0 0 8px;"><strong>Due date:</strong> ${(0, base_1.e)((0, base_1.formatDate)(input.job.due_date))}</p>
        <p style="margin:0;"><strong>Risk:</strong> <span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#e0f2fe;color:#0c4a6e;">${(0, base_1.e)(risk)}</span></p>
      </div>
    `,
        ctaLabel: "View Job Details →",
        ctaUrl: `${frontendUrl}/jobs/${input.job.id || ""}`,
    });
    return {
        subject: `Job assigned: ${jobTitle}`,
        html,
        text: `Hi ${input.userName}, ${input.assignedByName} assigned you to ${jobTitle}.`,
    };
}
//# sourceMappingURL=JobAssignedEmail.js.map