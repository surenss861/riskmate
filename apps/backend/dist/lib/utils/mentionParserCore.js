"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIN_TOKEN_LENGTH = exports.AT_EMAIL_REGEX = exports.AT_NAME_REGEX = exports.MENTION_REGEX = void 0;
exports.extractPlainMentionTokens = extractPlainMentionTokens;
exports.formatMention = formatMention;
exports.contentToMentionTokenFormat = contentToMentionTokenFormat;
exports.parseMentions = parseMentions;
exports.extractMentionUserIds = extractMentionUserIds;
exports.MENTION_REGEX = /@\[([^\]]+)\]\(([a-f0-9-]+)\)/g;
/** Plain @mention: @name or @first last. */
exports.AT_NAME_REGEX = /@(\w+(?:\s+\w+)*)/g;
/** Plain @email for addresses like user@example.com. */
exports.AT_EMAIL_REGEX = /@([^\s@]+@[^\s@]+)/g;
/** Minimum length for a name-like token to be considered (avoids @ab, @x matching). */
exports.MIN_TOKEN_LENGTH = 3;
function extractMarkedMentionIds(body) {
    if (!body || typeof body !== 'string')
        return [];
    const ids = [];
    let m;
    const re = new RegExp(exports.MENTION_REGEX.source, 'g');
    while ((m = re.exec(body)) !== null) {
        if (m[2] && !ids.includes(m[2]))
            ids.push(m[2]);
    }
    return ids;
}
/**
 * Extract plain @name / @email tokens with strict filtering (min length, not contained in emails).
 */
function extractPlainMentionTokens(body) {
    if (!body || typeof body !== 'string')
        return [];
    const nameTokens = new Set();
    const emailTokens = new Set();
    let m;
    const nameRe = new RegExp(exports.AT_NAME_REGEX.source, 'g');
    while ((m = nameRe.exec(body)) !== null) {
        const t = m[1]?.trim();
        if (t)
            nameTokens.add(t);
    }
    const emailRe = new RegExp(exports.AT_EMAIL_REGEX.source, 'g');
    while ((m = emailRe.exec(body)) !== null) {
        const t = m[1]?.trim();
        if (t)
            emailTokens.add(t);
    }
    const tokens = new Set();
    for (const t of emailTokens)
        tokens.add(t);
    for (const t of nameTokens) {
        if (t.length < exports.MIN_TOKEN_LENGTH)
            continue;
        if (t.includes('@'))
            continue;
        const isContainedInEmail = [...emailTokens].some((e) => e.includes(t));
        if (isContainedInEmail)
            continue;
        tokens.add(t);
    }
    return [...tokens];
}
async function resolvePlainMentionsToUserIds(supabase, tokens, organizationId) {
    if (tokens.length === 0)
        return [];
    let orgUserIds = [];
    const { data: memberRows } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', organizationId);
    orgUserIds = (memberRows || []).map((r) => r.user_id);
    if (orgUserIds.length === 0) {
        const { data: usersInOrg } = await supabase
            .from('users')
            .select('id')
            .eq('organization_id', organizationId);
        orgUserIds = (usersInOrg || []).map((u) => u.id);
    }
    if (orgUserIds.length === 0)
        return [];
    const { data: usersData } = await supabase
        .from('users')
        .select('id, email, full_name')
        .in('id', orgUserIds);
    const resolved = new Set();
    const normalized = (s) => (s || '').toLowerCase().trim();
    for (const token of tokens) {
        const t = normalized(token);
        if (!t)
            continue;
        for (const u of usersData || []) {
            const email = normalized(u.email || '');
            const name = normalized(u.full_name || '');
            const matched = email === t || name === t;
            if (matched) {
                resolved.add(u.id);
                break;
            }
        }
    }
    return [...resolved];
}
/** Format a mention for storage: @[Display Name](userId). */
function formatMention(displayName, userId) {
    const safe = (displayName || '').replace(/\]/g, '\\]').trim() || 'User';
    return `@[${safe}](${userId})`;
}
/**
 * Convert content to mention-token format so that every resolved mention is persisted as @[Display Name](userId).
 * Leaves existing @[Name](id) segments unchanged; replaces plain @name / @email with @[Display Name](userId).
 */
function contentToMentionTokenFormat(content, users) {
    if (!content || typeof content !== 'string')
        return content;
    if (!Array.isArray(users) || users.length === 0)
        return content;
    const normalized = (s) => (s || '').toLowerCase().trim();
    const tokenToReplacement = new Map();
    for (const u of users) {
        const displayName = (u.full_name ?? '').trim() || u.id;
        const replacement = formatMention(displayName, u.id);
        if ((u.email ?? '').trim())
            tokenToReplacement.set(normalized(u.email), replacement);
        if ((u.full_name ?? '').trim()) {
            tokenToReplacement.set(normalized(u.full_name), replacement);
            tokenToReplacement.set((u.full_name ?? '').trim(), replacement);
        }
    }
    const plainNameOrEmailRegex = /@(?!\[)(\w+(?:\s+\w+)*)|@(?!\[)([^\s@]+@[^\s@]+)/g;
    return content.replace(plainNameOrEmailRegex, (match, namePart, emailPart) => {
        const token = (namePart ?? emailPart ?? '').trim();
        if (!token)
            return match;
        const replacement = tokenToReplacement.get(token) ?? tokenToReplacement.get(normalized(token));
        return replacement ?? match;
    });
}
/**
 * Parse content for @[Display Name](userId) markers and return mentioned user IDs.
 */
function parseMentions(content) {
    return extractMarkedMentionIds(content);
}
/**
 * Extract user IDs from body: @[Name](userId) markers plus plain @name / @email when
 * organizationId and supabase are provided. When supabase is not provided, returns only marked IDs.
 */
async function extractMentionUserIds(body, organizationId, supabase) {
    if (!body || typeof body !== 'string')
        return [];
    const fromMarkers = extractMarkedMentionIds(body);
    if (!organizationId || !supabase) {
        return fromMarkers;
    }
    const plainTokens = extractPlainMentionTokens(body);
    const fromPlain = await resolvePlainMentionsToUserIds(supabase, plainTokens, organizationId);
    return [...new Set([...fromMarkers, ...fromPlain])];
}
//# sourceMappingURL=mentionParserCore.js.map