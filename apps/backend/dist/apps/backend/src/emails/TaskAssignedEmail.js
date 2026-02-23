"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskAssignedEmail = TaskAssignedEmail;
const react_1 = __importDefault(require("react"));
const components_1 = require("@react-email/components");
const render_1 = require("@react-email/render");
const EmailLayout_1 = require("./EmailLayout");
function TaskAssignedEmailComponent({ input, }) {
    const frontendUrl = process.env.FRONTEND_URL || "https://www.riskmate.dev";
    const jobTitle = input.jobTitle || "Job";
    return (react_1.default.createElement(EmailLayout_1.EmailLayout, { title: "Task assigned", intro: `Hi ${input.userName}, you've been assigned a task.`, ctaLabel: "View Task \u2192", ctaUrl: `${frontendUrl}/jobs/${input.jobId}/tasks?highlight=${input.taskId}`, managePreferencesUrl: input.managePreferencesUrl },
        react_1.default.createElement(components_1.Section, { style: {
                padding: "16px",
                border: "1px solid #dbeafe",
                backgroundColor: "#f8fbff",
                borderRadius: "10px",
            } },
            react_1.default.createElement(components_1.Text, { style: { margin: "0 0 8px" } },
                react_1.default.createElement("strong", null, "Task:"),
                " ",
                input.taskTitle),
            react_1.default.createElement(components_1.Text, { style: { margin: 0 } },
                react_1.default.createElement("strong", null, "Job:"),
                " ",
                jobTitle))));
}
async function TaskAssignedEmail(input) {
    const jobTitle = input.jobTitle || "Job";
    const html = await (0, render_1.render)(react_1.default.createElement(TaskAssignedEmailComponent, { input }));
    const text = (0, render_1.toPlainText)(html);
    return {
        subject: `Task assigned: ${input.taskTitle}`,
        html,
        text: text ||
            `Hi ${input.userName}, you've been assigned '${input.taskTitle}' on '${jobTitle}'.`,
    };
}
//# sourceMappingURL=TaskAssignedEmail.js.map