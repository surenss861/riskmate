"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MentionEmail = MentionEmail;
const react_1 = __importDefault(require("react"));
const components_1 = require("@react-email/components");
const render_1 = require("@react-email/render");
const EmailLayout_1 = require("./EmailLayout");
const base_1 = require("./base");
function MentionEmailComponent({ input }) {
    const preview = (0, base_1.truncate)(input.commentPreview || "", 150);
    return (react_1.default.createElement(EmailLayout_1.EmailLayout, { title: "You were mentioned", intro: `${input.mentionedByName} mentioned you on ${input.jobName}.`, ctaLabel: "View Comment \u2192", ctaUrl: input.commentUrl, managePreferencesUrl: input.managePreferencesUrl },
        react_1.default.createElement(components_1.Text, { style: {
                margin: 0,
                padding: "12px 14px",
                backgroundColor: "#f9fafb",
                borderLeft: "4px solid #007aff",
                color: "#374151",
            } }, preview)));
}
async function MentionEmail(input) {
    const preview = (0, base_1.truncate)(input.commentPreview || "", 150);
    const html = await (0, render_1.render)(react_1.default.createElement(MentionEmailComponent, { input }));
    const text = (0, render_1.toPlainText)(html);
    return {
        subject: `Mention from ${input.mentionedByName}`,
        html,
        text: text || `${input.mentionedByName} mentioned you: ${preview}`,
    };
}
//# sourceMappingURL=MentionEmail.js.map