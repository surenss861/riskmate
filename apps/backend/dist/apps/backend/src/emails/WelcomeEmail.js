"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WelcomeEmail = WelcomeEmail;
const react_1 = __importDefault(require("react"));
const components_1 = require("@react-email/components");
const render_1 = require("@react-email/render");
const EmailLayout_1 = require("./EmailLayout");
function WelcomeEmailComponent({ input }) {
    const frontendUrl = process.env.FRONTEND_URL || "https://www.riskmate.dev";
    return (react_1.default.createElement(EmailLayout_1.EmailLayout, { title: "Welcome to RiskMate", intro: `Hi ${input.userName}, welcome aboard.`, ctaLabel: "Create Your First Job \u2192", ctaUrl: `${frontendUrl}/jobs/new`, managePreferencesUrl: input.managePreferencesUrl },
        react_1.default.createElement(components_1.Text, { style: { margin: "0 0 12px 18px", padding: 0, color: "#374151" } },
            react_1.default.createElement("ol", { style: { margin: 0, padding: 0 } },
                react_1.default.createElement("li", null, "Create your first job"),
                react_1.default.createElement("li", null, "Add hazards and controls"),
                react_1.default.createElement("li", null, "Generate and sign reports"))),
        react_1.default.createElement(components_1.Text, { style: { margin: 0 } },
            react_1.default.createElement(components_1.Link, { href: `${frontendUrl}/docs`, style: { color: "#007aff", textDecoration: "none" } }, "Read the docs"))));
}
async function WelcomeEmail(input) {
    const html = await (0, render_1.render)(react_1.default.createElement(WelcomeEmailComponent, { input }));
    const text = (0, render_1.toPlainText)(html);
    return {
        subject: "Welcome to RiskMate",
        html,
        text: text || `Hi ${input.userName}, welcome to RiskMate.`,
    };
}
//# sourceMappingURL=WelcomeEmail.js.map