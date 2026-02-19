"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.e = e;
exports.truncate = truncate;
exports.formatDate = formatDate;
exports.layout = layout;
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function e(value) {
    if (value == null)
        return "";
    return escapeHtml(String(value));
}
function truncate(value, max = 150) {
    if (value.length <= max)
        return value;
    return `${value.slice(0, max - 1)}…`;
}
function formatDate(value) {
    if (!value)
        return "Not set";
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return value;
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}
function layout(params) {
    const frontendUrl = process.env.FRONTEND_URL || "https://www.riskmate.dev";
    const preferencesUrl = `${frontendUrl}/settings/notifications`;
    const cta = params.ctaLabel && params.ctaUrl
        ? `<p style="margin:24px 0 0;"><a href="${e(params.ctaUrl)}" style="display:inline-block;background:#007aff;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 16px;border-radius:8px;">${e(params.ctaLabel)}</a></p>`
        : "";
    return `
  <div style="background:#f3f7fb;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      <tr>
        <td style="background:#007aff;padding:16px 20px;color:#ffffff;font-size:20px;font-weight:700;">RiskMate</td>
      </tr>
      <tr>
        <td style="padding:24px;">
          <h1 style="font-size:22px;line-height:1.3;margin:0 0 12px;color:#111827;">${e(params.title)}</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">${e(params.intro)}</p>
          ${params.bodyHtml}
          ${cta}
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;">
          Manage email preferences: <a href="${e(preferencesUrl)}" style="color:#007aff;text-decoration:none;">Notification settings</a>
        </td>
      </tr>
    </table>
  </div>`;
}
//# sourceMappingURL=base.js.map