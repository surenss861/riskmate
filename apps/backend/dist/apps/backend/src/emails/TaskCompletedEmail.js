"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskCompletedEmail = TaskCompletedEmail;
const base_1 = require("./base");
function TaskCompletedEmail(input) {
    const frontendUrl = process.env.FRONTEND_URL || "https://www.riskmate.dev";
    const jobTitle = input.jobTitle || "Job";
    const html = (0, base_1.layout)({
        title: "Task completed",
        intro: `Hi ${input.userName}, a task you created has been completed.`,
        bodyHtml: `
      <p style="margin:0 0 8px;"><strong>Task:</strong> ${(0, base_1.e)(input.taskTitle)}</p>
      <p style="margin:0;"><strong>Job:</strong> ${(0, base_1.e)(jobTitle)}</p>
    `,
        ctaLabel: "View Task →",
        ctaUrl: `${frontendUrl}/tasks/${input.taskId}`,
    });
    return {
        subject: `Task completed: ${input.taskTitle}`,
        html,
        text: `'${input.taskTitle}' has been completed.`,
    };
}
//# sourceMappingURL=TaskCompletedEmail.js.map