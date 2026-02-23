"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeeklyDigestEmail = WeeklyDigestEmail;
const react_1 = __importDefault(require("react"));
const components_1 = require("@react-email/components");
const render_1 = require("@react-email/render");
const EmailLayout_1 = require("./EmailLayout");
const base_1 = require("./base");
function WeeklyDigestEmailComponent({ input, }) {
    const frontendUrl = process.env.FRONTEND_URL || "https://www.riskmate.dev";
    const { digest } = input;
    return (react_1.default.createElement(EmailLayout_1.EmailLayout, { title: "Weekly digest", intro: `Hi ${input.userName}, here is your weekly compliance summary.`, ctaLabel: "View Full Dashboard \u2192", ctaUrl: `${frontendUrl}/dashboard`, managePreferencesUrl: input.managePreferencesUrl },
        react_1.default.createElement(components_1.Section, { style: {
                margin: "0 0 14px",
                borderCollapse: "collapse",
            } },
            react_1.default.createElement("table", { role: "presentation", width: "100%", cellSpacing: 0, cellPadding: 0, style: { borderCollapse: "collapse", margin: "0 0 14px" } },
                react_1.default.createElement("tbody", null,
                    react_1.default.createElement("tr", null,
                        react_1.default.createElement("td", { style: {
                                border: "1px solid #e5e7eb",
                                padding: "10px",
                            } },
                            react_1.default.createElement("strong", null, "Active"),
                            react_1.default.createElement("br", null),
                            digest.activeJobs),
                        react_1.default.createElement("td", { style: {
                                border: "1px solid #e5e7eb",
                                padding: "10px",
                            } },
                            react_1.default.createElement("strong", null, "Completed"),
                            react_1.default.createElement("br", null),
                            digest.completedJobs),
                        react_1.default.createElement("td", { style: {
                                border: "1px solid #e5e7eb",
                                padding: "10px",
                            } },
                            react_1.default.createElement("strong", null, "Overdue"),
                            react_1.default.createElement("br", null),
                            digest.overdueJobs))))),
        react_1.default.createElement(components_1.Text, { style: { margin: "0 0 6px" } },
            react_1.default.createElement("strong", null, "Needs Attention")),
        react_1.default.createElement("ul", { style: { margin: "0 0 14px 18px", padding: 0 } }, digest.needsAttention.length === 0
            ? "None"
            : digest.needsAttention.map((item, i) => (react_1.default.createElement("li", { key: i },
                item.title,
                " ",
                react_1.default.createElement("span", { style: {
                        color: item.status === "overdue" ? "#b91c1c" : "#92400e",
                    } },
                    "(",
                    item.status === "overdue" ? "overdue" : "due soon",
                    ")"))))),
        react_1.default.createElement(components_1.Text, { style: { margin: "0 0 6px" } },
            react_1.default.createElement("strong", null, "Completed This Week")),
        react_1.default.createElement("ul", { style: { margin: "0 0 6px 18px", padding: 0 } }, digest.completedThisWeek.length === 0
            ? "None"
            : digest.completedThisWeek.map((item, i) => (react_1.default.createElement("li", { key: i },
                item.title,
                " (",
                (0, base_1.formatDate)(item.completedAt),
                ")"))))));
}
async function WeeklyDigestEmail(input) {
    const html = await (0, render_1.render)(react_1.default.createElement(WeeklyDigestEmailComponent, { input }));
    const text = (0, render_1.toPlainText)(html);
    return {
        subject: "Your weekly RiskMate digest",
        html,
        text: text ||
            `Active: ${input.digest.activeJobs}, completed: ${input.digest.completedJobs}, overdue: ${input.digest.overdueJobs}`,
    };
}
//# sourceMappingURL=WeeklyDigestEmail.js.map