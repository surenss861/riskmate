"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamInviteEmail = TeamInviteEmail;
const react_1 = __importDefault(require("react"));
const components_1 = require("@react-email/components");
const render_1 = require("@react-email/render");
const EmailLayout_1 = require("./EmailLayout");
function TeamInviteEmailComponent({ input }) {
    return (react_1.default.createElement(EmailLayout_1.EmailLayout, { title: "You were invited to RiskMate", intro: `${input.inviterName} invited you to join ${input.orgName}.`, ctaLabel: "Accept Invitation \u2192", ctaUrl: input.loginUrl, managePreferencesUrl: input.managePreferencesUrl },
        react_1.default.createElement(components_1.Text, { style: { margin: "0 0 10px" } },
            react_1.default.createElement("strong", null, "Temporary password:")),
        react_1.default.createElement(components_1.Text, { style: {
                margin: "0 0 12px",
                padding: "12px",
                borderRadius: "8px",
                backgroundColor: "#f3f4f6",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            } }, input.tempPassword),
        react_1.default.createElement(components_1.Text, { style: { margin: 0, color: "#b45309" } }, "This invite expires in 7 days.")));
}
async function TeamInviteEmail(input) {
    const html = await (0, render_1.render)(react_1.default.createElement(TeamInviteEmailComponent, { input }));
    const text = (0, render_1.toPlainText)(html);
    return {
        subject: `Invitation to join ${input.orgName}`,
        html,
        text: text ||
            `You were invited to ${input.orgName}. Temporary password: ${input.tempPassword}`,
    };
}
//# sourceMappingURL=TeamInviteEmail.js.map