"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportReadyEmail = ReportReadyEmail;
const react_1 = __importDefault(require("react"));
const components_1 = require("@react-email/components");
const render_1 = require("@react-email/render");
const EmailLayout_1 = require("./EmailLayout");
function ReportReadyEmailComponent({ input }) {
    return (react_1.default.createElement(EmailLayout_1.EmailLayout, { title: "Your report is ready", intro: `Hi ${input.userName}, your report for ${input.jobTitle} is now available.`, ctaLabel: "Download Report \u2192", ctaUrl: input.downloadUrl, managePreferencesUrl: input.managePreferencesUrl },
        react_1.default.createElement(components_1.Text, { style: { margin: "0 0 8px" } }, "You can download the PDF now or view it online."),
        react_1.default.createElement(components_1.Text, { style: { margin: 0 } },
            react_1.default.createElement(components_1.Link, { href: input.viewUrl, style: { color: "#007aff", textDecoration: "none" } }, "View Online"))));
}
async function ReportReadyEmail(input) {
    const html = await (0, render_1.render)(react_1.default.createElement(ReportReadyEmailComponent, { input }));
    const text = (0, render_1.toPlainText)(html);
    return {
        subject: `Report ready: ${input.jobTitle}`,
        html,
        text: text ||
            `Hi ${input.userName}, the report for ${input.jobTitle} is ready. Download: ${input.downloadUrl}`,
    };
}
//# sourceMappingURL=ReportReadyEmail.js.map