"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignatureRequestEmail = SignatureRequestEmail;
const react_1 = __importDefault(require("react"));
const components_1 = require("@react-email/components");
const render_1 = require("@react-email/render");
const EmailLayout_1 = require("./EmailLayout");
function SignatureRequestEmailComponent({ input, }) {
    const frontendUrl = process.env.FRONTEND_URL || "https://www.riskmate.dev";
    return (react_1.default.createElement(EmailLayout_1.EmailLayout, { title: "Signature requested", intro: `Hi ${input.userName}, your signature is needed for a report.`, ctaLabel: "Sign Now \u2192", ctaUrl: `${frontendUrl}/reports/${input.reportRunId}`, managePreferencesUrl: input.managePreferencesUrl },
        react_1.default.createElement(components_1.Text, { style: { margin: "0 0 8px" } },
            react_1.default.createElement("strong", null, "Report:"),
            " ",
            input.reportName),
        react_1.default.createElement(components_1.Text, { style: { margin: "0 0 8px" } },
            react_1.default.createElement("strong", null, "Job:"),
            " ",
            input.jobTitle),
        input.deadline && (react_1.default.createElement(components_1.Text, { style: { margin: "0 0 8px", color: "#b45309" } },
            react_1.default.createElement("strong", null, "Deadline:"),
            " ",
            input.deadline)),
        react_1.default.createElement(components_1.Text, { style: { margin: 0, color: "#6b7280", fontSize: "13px" } },
            "Verification hash: ",
            input.reportRunId)));
}
async function SignatureRequestEmail(input) {
    const html = await (0, render_1.render)(react_1.default.createElement(SignatureRequestEmailComponent, { input }));
    const text = (0, render_1.toPlainText)(html);
    return {
        subject: `Signature requested: ${input.reportName}`,
        html,
        text: text ||
            `Hi ${input.userName}, sign ${input.reportName} for ${input.jobTitle}.`,
    };
}
//# sourceMappingURL=SignatureRequestEmail.js.map