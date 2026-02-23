"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailLayout = EmailLayout;
const react_1 = __importDefault(require("react"));
const components_1 = require("@react-email/components");
const FRONTEND_URL = process.env.FRONTEND_URL || "https://www.riskmate.dev";
function EmailLayout({ title, intro, children, ctaLabel, ctaUrl, managePreferencesUrl, }) {
    const preferencesUrl = managePreferencesUrl ?? `${FRONTEND_URL}/settings/notifications`;
    return (react_1.default.createElement(components_1.Html, null,
        react_1.default.createElement(components_1.Head, null),
        react_1.default.createElement(components_1.Body, { style: bodyStyle },
            react_1.default.createElement(components_1.Container, { style: containerStyle },
                react_1.default.createElement(components_1.Section, { style: headerStyle },
                    react_1.default.createElement(components_1.Text, { style: headerTextStyle }, "RiskMate")),
                react_1.default.createElement(components_1.Section, { style: contentStyle },
                    react_1.default.createElement(components_1.Text, { style: h1Style }, title),
                    react_1.default.createElement(components_1.Text, { style: introStyle }, intro),
                    children,
                    ctaLabel && ctaUrl && (react_1.default.createElement(components_1.Button, { href: ctaUrl, style: buttonStyle }, ctaLabel))),
                react_1.default.createElement(components_1.Hr, { style: hrStyle }),
                react_1.default.createElement(components_1.Section, { style: footerStyle },
                    react_1.default.createElement(components_1.Text, { style: footerTextStyle },
                        "Manage email preferences:",
                        " ",
                        react_1.default.createElement(components_1.Link, { href: preferencesUrl, style: linkStyle }, "Notification settings")))))));
}
const bodyStyle = {
    backgroundColor: "#f3f7fb",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
    color: "#1f2937",
    padding: "24px",
};
const containerStyle = {
    maxWidth: "600px",
    margin: "0 auto",
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    overflow: "hidden",
    border: "1px solid #e5e7eb",
};
const headerStyle = {
    backgroundColor: "#007aff",
    padding: "16px 20px",
};
const headerTextStyle = {
    color: "#ffffff",
    fontSize: "20px",
    fontWeight: 700,
    margin: 0,
};
const contentStyle = {
    padding: "24px",
};
const h1Style = {
    fontSize: "22px",
    lineHeight: 1.3,
    margin: "0 0 12px",
    color: "#111827",
};
const introStyle = {
    margin: "0 0 16px",
    fontSize: "15px",
    lineHeight: 1.6,
    color: "#374151",
};
const buttonStyle = {
    display: "inline-block",
    backgroundColor: "#007aff",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 600,
    padding: "12px 16px",
    borderRadius: "8px",
    marginTop: "24px",
};
const hrStyle = {
    borderColor: "#e5e7eb",
};
const footerStyle = {
    padding: "16px 24px",
};
const footerTextStyle = {
    fontSize: "12px",
    color: "#6b7280",
    margin: 0,
};
const linkStyle = {
    color: "#007aff",
    textDecoration: "none",
};
//# sourceMappingURL=EmailLayout.js.map