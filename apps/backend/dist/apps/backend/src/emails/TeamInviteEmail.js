"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamInviteEmail = TeamInviteEmail;
const base_1 = require("./base");
function TeamInviteEmail(input) {
    const html = (0, base_1.layout)({
        title: "You were invited to RiskMate",
        intro: `${input.inviterName} invited you to join ${input.orgName}.`,
        bodyHtml: `
      <p style="margin:0 0 10px;"><strong>Temporary password:</strong></p>
      <p style="margin:0 0 12px;padding:12px;border-radius:8px;background:#f3f4f6;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${(0, base_1.e)(input.tempPassword)}</p>
      <p style="margin:0;color:#b45309;">This invite expires in 7 days.</p>
    `,
        ctaLabel: "Log In to Accept →",
        ctaUrl: input.loginUrl,
    });
    return {
        subject: `Invitation to join ${input.orgName}`,
        html,
        text: `You were invited to ${input.orgName}. Temporary password: ${input.tempPassword}`,
    };
}
//# sourceMappingURL=TeamInviteEmail.js.map