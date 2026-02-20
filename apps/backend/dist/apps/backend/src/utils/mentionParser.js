"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractMentionUserIds = extractMentionUserIds;
/**
 * Extract user IDs from text containing @[Display Name](userId) markers.
 * Matches frontend lib/utils/mentionParser.ts contract for notifications.
 */
const MENTION_REGEX = /@\[([^\]]+)\]\(([a-f0-9-]+)\)/g;
function extractMentionUserIds(body) {
    if (!body || typeof body !== "string")
        return [];
    const ids = [];
    let m;
    const re = new RegExp(MENTION_REGEX.source, "g");
    while ((m = re.exec(body)) !== null) {
        if (m[2] && !ids.includes(m[2]))
            ids.push(m[2]);
    }
    return ids;
}
//# sourceMappingURL=mentionParser.js.map