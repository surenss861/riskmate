"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskAssignedEmail = TaskAssignedEmail;
const base_1 = require("./base");
function TaskAssignedEmail(input) {
    const frontendUrl = process.env.FRONTEND_URL || "https://www.riskmate.dev";
    const jobTitle = input.jobTitle || "Job";
    const html = (0, base_1.layout)({
        title: "Task assigned",
        intro: `Hi ${input.userName}, you've been assigned a task.`,
        bodyHtml: `
      <div style="padding:16px;border:1px solid #dbeafe;background:#f8fbff;border-radius:10px;">
        <p style="margin:0 0 8px;"><strong>Task:</strong> ${(0, base_1.e)(input.taskTitle)}</p>
        <p style="margin:0;"><strong>Job:</strong> ${(0, base_1.e)(jobTitle)}</p>
      </div>
    `,
        ctaLabel: "View Task →",
        ctaUrl: `${frontendUrl}/jobs/${input.jobId}/tasks?highlight=${input.taskId}`,
    });
    return {
        subject: `Task assigned: ${input.taskTitle}`,
        html,
        text: `Hi ${input.userName}, you've been assigned '${input.taskTitle}' on '${jobTitle}'.`,
    };
}
//# sourceMappingURL=TaskAssignedEmail.js.map