"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MentionEmail = MentionEmail;
const base_1 = require("./base");
function MentionEmail(input) {
    const preview = (0, base_1.truncate)(input.commentPreview || "", 150);
    const html = (0, base_1.layout)({
        title: "You were mentioned",
        intro: `${input.mentionedByName} mentioned you on ${input.jobName}.`,
        bodyHtml: `
      <blockquote style="margin:0;padding:12px 14px;background:#f9fafb;border-left:4px solid #007aff;color:#374151;">${(0, base_1.e)(preview)}</blockquote>
    `,
        ctaLabel: "View Comment →",
        ctaUrl: input.commentUrl,
    });
    return {
        subject: `Mention from ${input.mentionedByName}`,
        html,
        text: `${input.mentionedByName} mentioned you: ${preview}`,
    };
}
//# sourceMappingURL=MentionEmail.js.map