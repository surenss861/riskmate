"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskCompletedEmail = TaskCompletedEmail;
const react_1 = __importDefault(require("react"));
const components_1 = require("@react-email/components");
const render_1 = require("@react-email/render");
const EmailLayout_1 = require("./EmailLayout");
function TaskCompletedEmailComponent({ input, }) {
    const frontendUrl = process.env.FRONTEND_URL || "https://www.riskmate.dev";
    const jobTitle = input.jobTitle || "Job";
    const ctaUrl = input.jobId
        ? `${frontendUrl}/jobs/${input.jobId}/tasks?highlight=${input.taskId}`
        : `${frontendUrl}/tasks/${input.taskId}`;
    return (react_1.default.createElement(EmailLayout_1.EmailLayout, { title: "Task completed", intro: `Hi ${input.userName}, a task you created has been completed.`, ctaLabel: "View Task \u2192", ctaUrl: ctaUrl, managePreferencesUrl: input.managePreferencesUrl },
        react_1.default.createElement(components_1.Text, { style: { margin: "0 0 8px" } },
            react_1.default.createElement("strong", null, "Task:"),
            " ",
            input.taskTitle),
        react_1.default.createElement(components_1.Text, { style: { margin: 0 } },
            react_1.default.createElement("strong", null, "Job:"),
            " ",
            jobTitle)));
}
async function TaskCompletedEmail(input) {
    const html = await (0, render_1.render)(react_1.default.createElement(TaskCompletedEmailComponent, { input }));
    const text = (0, render_1.toPlainText)(html);
    return {
        subject: `Task completed: ${input.taskTitle}`,
        html,
        text: text || `'${input.taskTitle}' has been completed.`,
    };
}
//# sourceMappingURL=TaskCompletedEmail.js.map