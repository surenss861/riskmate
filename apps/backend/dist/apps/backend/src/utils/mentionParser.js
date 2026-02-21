"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatMention = exports.contentToMentionTokenFormat = void 0;
exports.extractMentionUserIds = extractMentionUserIds;
/**
 * Re-export shared mention parsing from lib so backend and frontend use the same regexes,
 * token length rules, and email/name handling. Implementation lives in lib/utils/mentionParserCore.ts.
 */
const supabaseClient_1 = require("../lib/supabaseClient");
const mentionParserCore_1 = require("../../../../lib/utils/mentionParserCore");
var mentionParserCore_2 = require("../../../../lib/utils/mentionParserCore");
Object.defineProperty(exports, "contentToMentionTokenFormat", { enumerable: true, get: function () { return mentionParserCore_2.contentToMentionTokenFormat; } });
Object.defineProperty(exports, "formatMention", { enumerable: true, get: function () { return mentionParserCore_2.formatMention; } });
/**
 * Extract user IDs from body: @[Name](userId) markers plus plain @name / @email
 * resolved via organization lookup. Uses shared core with backend's supabase client.
 */
async function extractMentionUserIds(body, organizationId) {
    return (0, mentionParserCore_1.extractMentionUserIds)(body, organizationId, supabaseClient_1.supabase);
}
//# sourceMappingURL=mentionParser.js.map