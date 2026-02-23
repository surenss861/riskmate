"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobAssignedEmail = JobAssignedEmail;
const react_1 = __importDefault(require("react"));
const components_1 = require("@react-email/components");
const render_1 = require("@react-email/render");
const EmailLayout_1 = require("./EmailLayout");
const base_1 = require("./base");
function JobAssignedEmailComponent({ input }) {
    const frontendUrl = process.env.FRONTEND_URL || "https://www.riskmate.dev";
    const jobTitle = input.job.title || input.job.client_name || "Untitled job";
    const risk = input.job.risk_level || "unknown";
    return (react_1.default.createElement(EmailLayout_1.EmailLayout, { title: "You were assigned to a job", intro: `Hi ${input.userName}, ${input.assignedByName} assigned a job to you.`, ctaLabel: "View Job Details \u2192", ctaUrl: `${frontendUrl}/jobs/${input.job.id || ""}`, managePreferencesUrl: input.managePreferencesUrl },
        react_1.default.createElement(components_1.Section, { style: {
                padding: "16px",
                border: "1px solid #dbeafe",
                backgroundColor: "#f8fbff",
                borderRadius: "10px",
            } },
            react_1.default.createElement(components_1.Text, { style: { margin: "0 0 8px" } },
                react_1.default.createElement("strong", null, "Title:"),
                " ",
                jobTitle),
            react_1.default.createElement(components_1.Text, { style: { margin: "0 0 8px" } },
                react_1.default.createElement("strong", null, "Client:"),
                " ",
                input.job.client_name || "Not set"),
            react_1.default.createElement(components_1.Text, { style: { margin: "0 0 8px" } },
                react_1.default.createElement("strong", null, "Location:"),
                " ",
                input.job.location || "Not set"),
            react_1.default.createElement(components_1.Text, { style: { margin: "0 0 8px" } },
                react_1.default.createElement("strong", null, "Due date:"),
                " ",
                (0, base_1.formatDate)(input.job.due_date)),
            react_1.default.createElement(components_1.Text, { style: { margin: 0 } },
                react_1.default.createElement("strong", null, "Risk:"),
                " ",
                react_1.default.createElement("span", { style: {
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: "999px",
                        backgroundColor: "#e0f2fe",
                        color: "#0c4a6e",
                    } }, risk)))));
}
async function JobAssignedEmail(input) {
    const jobTitle = input.job.title || input.job.client_name || "Untitled job";
    const html = await (0, render_1.render)(react_1.default.createElement(JobAssignedEmailComponent, { input }));
    const text = (0, render_1.toPlainText)(html);
    return {
        subject: `Job assigned: ${jobTitle}`,
        html,
        text: text || `Hi ${input.userName}, ${input.assignedByName} assigned you to ${jobTitle}.`,
    };
}
//# sourceMappingURL=JobAssignedEmail.js.map