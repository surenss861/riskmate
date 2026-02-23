"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeadlineReminderEmail = DeadlineReminderEmail;
const react_1 = __importDefault(require("react"));
const components_1 = require("@react-email/components");
const render_1 = require("@react-email/render");
const EmailLayout_1 = require("./EmailLayout");
const base_1 = require("./base");
function DeadlineReminderEmailComponent({ input, }) {
    const frontendUrl = process.env.FRONTEND_URL || "https://www.riskmate.dev";
    const jobTitle = input.job.title || input.job.client_name || "Untitled job";
    return (react_1.default.createElement(EmailLayout_1.EmailLayout, { title: "Deadline reminder", intro: `Hi ${input.userName}, a due date is approaching.`, ctaLabel: "View Job \u2192", ctaUrl: `${frontendUrl}/jobs/${input.job.id || ""}`, managePreferencesUrl: input.managePreferencesUrl },
        react_1.default.createElement(components_1.Text, { style: { margin: "0 0 8px" } },
            react_1.default.createElement("strong", null, "Job:"),
            " ",
            jobTitle),
        react_1.default.createElement(components_1.Text, { style: { margin: "0 0 8px" } },
            react_1.default.createElement("strong", null, "Client:"),
            " ",
            input.job.client_name || "Not set"),
        react_1.default.createElement(components_1.Text, { style: { margin: "0 0 8px" } },
            react_1.default.createElement("strong", null, "Due:"),
            " ",
            (0, base_1.formatDate)(input.job.due_date)),
        react_1.default.createElement(components_1.Text, { style: {
                margin: 0,
                color: "#b45309",
            } },
            react_1.default.createElement("strong", null,
                Math.max(0, Math.round(input.hoursRemaining)),
                " hours remaining"))));
}
async function DeadlineReminderEmail(input) {
    const jobTitle = input.job.title || input.job.client_name || "Untitled job";
    const html = await (0, render_1.render)(react_1.default.createElement(DeadlineReminderEmailComponent, { input }));
    const text = (0, render_1.toPlainText)(html);
    return {
        subject: `Deadline reminder: ${jobTitle}`,
        html,
        text: text ||
            `${jobTitle} is due soon (${Math.round(input.hoursRemaining)}h remaining).`,
    };
}
//# sourceMappingURL=DeadlineReminderEmail.js.map