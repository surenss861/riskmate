"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignatureRequestEmail = SignatureRequestEmail;
const base_1 = require("./base");
function SignatureRequestEmail(input) {
    const frontendUrl = process.env.FRONTEND_URL || "https://www.riskmate.dev";
    const html = (0, base_1.layout)({
        title: "Signature requested",
        intro: `Hi ${input.userName}, your signature is needed for a report.`,
        bodyHtml: `
      <p style="margin:0 0 8px;"><strong>Report:</strong> ${(0, base_1.e)(input.reportName)}</p>
      <p style="margin:0 0 8px;"><strong>Job:</strong> ${(0, base_1.e)(input.jobTitle)}</p>
      ${input.deadline ? `<p style="margin:0 0 8px;color:#b45309;"><strong>Deadline:</strong> ${(0, base_1.e)(input.deadline)}</p>` : ""}
      <p style="margin:0;color:#6b7280;font-size:13px;">Verification hash: ${(0, base_1.e)(input.reportRunId)}</p>
    `,
        ctaLabel: "Sign Now →",
        ctaUrl: `${frontendUrl}/reports/${input.reportRunId}`,
    });
    return {
        subject: `Signature requested: ${input.reportName}`,
        html,
        text: `Hi ${input.userName}, sign ${input.reportName} for ${input.jobTitle}.`,
    };
}
//# sourceMappingURL=SignatureRequestEmail.js.map