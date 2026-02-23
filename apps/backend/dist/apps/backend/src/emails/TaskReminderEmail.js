"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskReminderEmail = TaskReminderEmail;
const react_1 = __importDefault(require("react"));
const components_1 = require("@react-email/components");
const render_1 = require("@react-email/render");
const EmailLayout_1 = require("./EmailLayout");
const base_1 = require("./base");
function TaskReminderEmailComponent({ input, }) {
    const frontendUrl = process.env.FRONTEND_URL || "https://www.riskmate.dev";
    const jobTitle = input.jobTitle || "Job";
    const title = input.isOverdue ? "Task overdue" : "Task due soon";
    const intro = input.isOverdue
        ? `Hi ${input.userName}, a task is overdue.`
        : `Hi ${input.userName}, a task is due within 24 hours.`;
    const dueText = input.isOverdue
        ? "This task is past its due date."
        : input.hoursRemaining != null
            ? `${Math.max(0, Math.round(input.hoursRemaining))} hours remaining`
            : (0, base_1.formatDate)(input.dueDate);
    const ctaUrl = input.jobId && input.taskId
        ? `${frontendUrl}/jobs/${input.jobId}/tasks?highlight=${input.taskId}`
        : frontendUrl;
    return (react_1.default.createElement(EmailLayout_1.EmailLayout, { title: title, intro: intro, ctaLabel: "View Task \u2192", ctaUrl: ctaUrl, managePreferencesUrl: input.managePreferencesUrl },
        react_1.default.createElement(components_1.Text, { style: { margin: "0 0 8px" } },
            react_1.default.createElement("strong", null, "Task:"),
            " ",
            input.taskTitle),
        react_1.default.createElement(components_1.Text, { style: { margin: "0 0 8px" } },
            react_1.default.createElement("strong", null, "Job:"),
            " ",
            jobTitle),
        react_1.default.createElement(components_1.Text, { style: { margin: "0 0 8px" } },
            react_1.default.createElement("strong", null, "Due:"),
            " ",
            (0, base_1.formatDate)(input.dueDate)),
        react_1.default.createElement(components_1.Text, { style: { margin: 0, color: "#b45309" } },
            react_1.default.createElement("strong", null, dueText))));
}
async function TaskReminderEmail(input) {
    const jobTitle = input.jobTitle || "Job";
    const html = await (0, render_1.render)(react_1.default.createElement(TaskReminderEmailComponent, { input }));
    const text = (0, render_1.toPlainText)(html);
    return {
        subject: input.isOverdue
            ? `Overdue: ${input.taskTitle}`
            : `Due soon: ${input.taskTitle}`,
        html,
        text: text ||
            (input.isOverdue
                ? `'${input.taskTitle}' on '${jobTitle}' is overdue.`
                : `'${input.taskTitle}' on '${jobTitle}' is due soon.`),
    };
}
//# sourceMappingURL=TaskReminderEmail.js.map