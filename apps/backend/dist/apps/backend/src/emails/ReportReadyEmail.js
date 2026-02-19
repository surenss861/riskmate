"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportReadyEmail = ReportReadyEmail;
const base_1 = require("./base");
function ReportReadyEmail(input) {
    const html = (0, base_1.layout)({
        title: "Your report is ready",
        intro: `Hi ${input.userName}, your report for ${input.jobTitle} is now available.`,
        bodyHtml: `<p style="margin:0 0 8px;">You can download the PDF now or view it online.</p>
      <p style="margin:0;"><a href="${(0, base_1.e)(input.viewUrl)}" style="color:#007aff;text-decoration:none;">View Online</a></p>`,
        ctaLabel: "Download Report →",
        ctaUrl: input.downloadUrl,
    });
    return {
        subject: `Report ready: ${input.jobTitle}`,
        html,
        text: `Hi ${input.userName}, the report for ${input.jobTitle} is ready. Download: ${input.downloadUrl}`,
    };
}
//# sourceMappingURL=ReportReadyEmail.js.map