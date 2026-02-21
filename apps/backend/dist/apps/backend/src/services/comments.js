"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMMENT_ENTITY_TYPES = void 0;
exports.listComments = listComments;
exports.getCommentCount = getCommentCount;
exports.getUnreadCommentCount = getUnreadCommentCount;
exports.getParentComment = getParentComment;
exports.createComment = createComment;
exports.updateComment = updateComment;
exports.deleteComment = deleteComment;
exports.getComment = getComment;
exports.listCommentsWhereMentioned = listCommentsWhereMentioned;
exports.resolveComment = resolveComment;
exports.unresolveComment = unresolveComment;
exports.listReplies = listReplies;
const supabaseClient_1 = require("../lib/supabaseClient");
const notifications_1 = require("./notifications");
const mentionParser_1 = require("../utils/mentionParser");
exports.COMMENT_ENTITY_TYPES = [
    "job",
    "hazard",
    "control",
    "photo",
];
/** List comments for an entity. Excludes soft-deleted by default. Returns author info and reply counts. Excludes replies by default (top-level list + reply_count contract). */
async function listComments(organizationId, entityType, entityId, options = {}) {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
    const offset = Math.max(options.offset ?? 0, 0);
    let query = supabaseClient_1.supabase
        .from("comments")
        .select("id, organization_id, entity_type, entity_id, parent_id, author_id, content, mentions, is_resolved, resolved_by, resolved_at, edited_at, deleted_at, created_at, updated_at", { count: "exact" })
        .eq("organization_id", organizationId)
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: true });
    if (options.includeReplies !== true) {
        query = query.is("parent_id", null);
    }
    if (options.includeDeleted !== true) {
        query = query.is("deleted_at", null);
    }
    const { data: rows, error, count } = await query.range(offset, offset + limit - 1);
    if (error) {
        console.error("[Comments] listComments error:", error);
        return { data: [], count: 0, has_more: false };
    }
    const total = count ?? 0;
    const has_more = total > offset + (rows?.length ?? 0);
    const comments = (rows || []);
    if (comments.length === 0) {
        return { data: [], count: total, has_more: false };
    }
    const authorIds = [...new Set(comments.map((c) => c.author_id))];
    const { data: users } = await supabaseClient_1.supabase
        .from("users")
        .select("id, full_name, email")
        .in("id", authorIds);
    const commentIds = comments.map((c) => c.id);
    const { data: replyRows } = await supabaseClient_1.supabase
        .from("comments")
        .select("parent_id")
        .eq("organization_id", organizationId)
        .in("parent_id", commentIds)
        .is("deleted_at", null);
    const replyCountByParent = new Map();
    for (const r of replyRows || []) {
        const pid = r.parent_id;
        if (pid)
            replyCountByParent.set(pid, (replyCountByParent.get(pid) ?? 0) + 1);
    }
    const userMap = new Map((users || []).map((u) => [u.id, u]));
    const data = comments.map((c) => ({
        ...c,
        author: userMap.get(c.author_id)
            ? {
                id: c.author_id,
                full_name: userMap.get(c.author_id)?.full_name ?? null,
                email: userMap.get(c.author_id)?.email ?? null,
            }
            : undefined,
        mentions: (c.mentions ?? []).map((user_id) => ({ user_id })),
        reply_count: replyCountByParent.get(c.id) ?? 0,
    }));
    return { data, count: total, has_more };
}
/** Get total comment count for an entity, optionally including replies. Excludes soft-deleted. */
async function getCommentCount(organizationId, entityType, entityId, options = {}) {
    let query = supabaseClient_1.supabase
        .from("comments")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .is("deleted_at", null);
    if (options.includeReplies !== true) {
        query = query.is("parent_id", null);
    }
    const { count, error } = await query;
    if (error) {
        console.error("[Comments] getCommentCount error:", error);
        return 0;
    }
    return typeof count === "number" ? count : 0;
}
/** Get unread comment count for an entity (comments + replies created after since, excluding those by currentUser). Excludes soft-deleted. */
async function getUnreadCommentCount(organizationId, entityType, entityId, sinceIso, currentUserId) {
    const { count, error } = await supabaseClient_1.supabase
        .from("comments")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .is("deleted_at", null)
        .neq("author_id", currentUserId)
        .gt("created_at", sinceIso);
    if (error) {
        console.error("[Comments] getUnreadCommentCount error:", error);
        return 0;
    }
    return typeof count === "number" ? count : 0;
}
/** Get a parent comment by id scoped to org and optional entity_type/entity_id; excludes deleted. Returns null if not found. */
async function getParentComment(organizationId, parentId, entityType, entityId) {
    let query = supabaseClient_1.supabase
        .from("comments")
        .select()
        .eq("id", parentId)
        .eq("organization_id", organizationId)
        .is("deleted_at", null);
    if (entityType != null && entityType !== "") {
        query = query.eq("entity_type", entityType);
    }
    if (entityId != null && entityId !== "") {
        query = query.eq("entity_id", entityId);
    }
    const { data, error } = await query.maybeSingle();
    if (error || !data)
        return null;
    return data;
}
/** Create a comment with optional mentions (stored in comments.mentions; sends notifications). Parses body for @[Name](id) as fallback. */
async function createComment(organizationId, authorId, params) {
    const { entity_type, entity_id, body, parent_id, mention_user_ids } = params;
    if (!body || typeof body !== "string" || body.trim().length === 0) {
        return { data: null, error: "Body is required" };
    }
    if (!exports.COMMENT_ENTITY_TYPES.includes(entity_type)) {
        return { data: null, error: "Invalid entity_type" };
    }
    // When parent_id is provided, validate parent exists, is not deleted, and belongs to same org + entity
    if (parent_id != null && parent_id !== "") {
        const parent = await getParentComment(organizationId, parent_id, entity_type, entity_id);
        if (!parent) {
            return {
                data: null,
                error: "Parent comment not found or not valid for this entity",
            };
        }
    }
    const fromText = await (0, mentionParser_1.extractMentionUserIds)(body, organizationId);
    const explicitIds = Array.isArray(mention_user_ids) ? mention_user_ids : [];
    const rawMentionIds = [...new Set([...explicitIds, ...fromText])].filter((id) => id && id !== authorId);
    // Only send mention notifications to users in the same organization; fetch id/full_name/email for token formatting
    let toMention = [];
    let mentionUsersForFormat = [];
    if (rawMentionIds.length > 0) {
        const { data: orgUsers } = await supabaseClient_1.supabase
            .from("users")
            .select("id, full_name, email")
            .eq("organization_id", organizationId)
            .in("id", rawMentionIds);
        toMention = (orgUsers ?? []).map((u) => u.id);
        mentionUsersForFormat = orgUsers ?? [];
    }
    const contentToPersist = (0, mentionParser_1.contentToMentionTokenFormat)(body.trim(), mentionUsersForFormat);
    const { data: comment, error: insertError } = await supabaseClient_1.supabase
        .from("comments")
        .insert({
        organization_id: organizationId,
        entity_type,
        entity_id,
        parent_id: parent_id ?? null,
        author_id: authorId,
        content: contentToPersist,
        mentions: toMention.length > 0 ? toMention : [],
    })
        .select()
        .single();
    if (insertError) {
        console.error("[Comments] createComment insert error:", insertError);
        return { data: null, error: insertError.message };
    }
    if (!comment) {
        return { data: null, error: "Failed to create comment" };
    }
    if (toMention.length > 0) {
        const contextLabel = "You were mentioned in a comment.";
        for (const userId of toMention) {
            (0, notifications_1.sendMentionNotification)(userId, organizationId, comment.id, contextLabel).catch((err) => console.error("[Comments] Mention notification failed:", err));
        }
    }
    return { data: comment, error: null };
}
/** Update comment content (sets edited_at). Re-parses mentions, sends notifications for newly added mentions. Author only. */
async function updateComment(organizationId, commentId, body, userId, explicitMentionUserIds) {
    if (!body || typeof body !== "string" || body.trim().length === 0) {
        return { data: null, error: "Body is required" };
    }
    const { data: existing } = await supabaseClient_1.supabase
        .from("comments")
        .select("id, author_id, organization_id, deleted_at, mentions")
        .eq("id", commentId)
        .eq("organization_id", organizationId)
        .single();
    if (!existing) {
        return { data: null, error: "Comment not found" };
    }
    if (existing.deleted_at) {
        return { data: null, error: "Comment is deleted" };
    }
    const isAuthor = existing.author_id === userId;
    if (!isAuthor) {
        return { data: null, error: "Only the author can update this comment" };
    }
    const fromText = await (0, mentionParser_1.extractMentionUserIds)(body.trim(), organizationId);
    const explicitMentions = Array.isArray(explicitMentionUserIds) ? explicitMentionUserIds : [];
    const rawMentionIds = [...new Set([...fromText, ...explicitMentions])].filter((id) => id && id !== userId);
    let mentionUserIds = [];
    let mentionUsersForFormat = [];
    if (rawMentionIds.length > 0) {
        const { data: orgUsers } = await supabaseClient_1.supabase
            .from("users")
            .select("id, full_name, email")
            .eq("organization_id", organizationId)
            .in("id", rawMentionIds);
        mentionUserIds = (orgUsers ?? []).map((u) => u.id);
        mentionUsersForFormat = orgUsers ?? [];
    }
    const contentToPersist = (0, mentionParser_1.contentToMentionTokenFormat)(body.trim(), mentionUsersForFormat);
    const existingMentions = existing.mentions ?? [];
    const existingSet = new Set(existingMentions);
    const addedMentionIds = mentionUserIds.filter((id) => !existingSet.has(id));
    const now = new Date().toISOString();
    const { data: comment, error } = await supabaseClient_1.supabase
        .from("comments")
        .update({
        content: contentToPersist,
        mentions: mentionUserIds,
        edited_at: now,
        updated_at: now,
    })
        .eq("id", commentId)
        .eq("organization_id", organizationId)
        .select()
        .single();
    if (error) {
        console.error("[Comments] updateComment error:", error);
        return { data: null, error: error.message };
    }
    const contextLabel = "You were mentioned in a comment.";
    for (const mentionedUserId of addedMentionIds) {
        (0, notifications_1.sendMentionNotification)(mentionedUserId, organizationId, commentId, contextLabel).catch((err) => console.error("[Comments] Mention notification (edit) failed:", err));
    }
    return { data: comment, error: null };
}
/** Soft-delete a comment (sets deleted_at and updated_at). No cascade on replies. Caller must ensure author or org admin. */
async function deleteComment(organizationId, commentId) {
    const now = new Date().toISOString();
    const { error } = await supabaseClient_1.supabase
        .from("comments")
        .update({ deleted_at: now, updated_at: now })
        .eq("id", commentId)
        .eq("organization_id", organizationId);
    if (error) {
        console.error("[Comments] deleteComment error:", error);
        return { ok: false, error: error.message };
    }
    return { ok: true, error: null };
}
/** Get a single comment by id (for permission checks). Includes deleted. */
async function getComment(organizationId, commentId) {
    const { data, error } = await supabaseClient_1.supabase
        .from("comments")
        .select()
        .eq("id", commentId)
        .eq("organization_id", organizationId)
        .single();
    if (error || !data)
        return null;
    return data;
}
/** List comments where the given user is in mentions array. Excludes soft-deleted. Returns count and has_more for pagination. */
async function listCommentsWhereMentioned(organizationId, userId, options = {}) {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
    const offset = Math.max(options.offset ?? 0, 0);
    const { data: comments, error, count } = await supabaseClient_1.supabase
        .from("comments")
        .select("id, organization_id, entity_type, entity_id, parent_id, author_id, content, mentions, is_resolved, resolved_by, resolved_at, edited_at, deleted_at, created_at, updated_at", { count: "exact" })
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .contains("mentions", [userId])
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
    if (error) {
        console.error("[Comments] listCommentsWhereMentioned error:", error);
        return { data: [], count: 0, has_more: false };
    }
    const total = count ?? 0;
    const rows = (comments || []);
    const has_more = total > offset + rows.length;
    if (rows.length === 0) {
        return { data: [], count: total, has_more: false };
    }
    const authorIds = [...new Set(rows.map((c) => c.author_id))];
    const { data: users } = await supabaseClient_1.supabase
        .from("users")
        .select("id, full_name, email")
        .in("id", authorIds);
    const userMap = new Map((users || []).map((u) => [u.id, u]));
    const withAuthors = rows.map((c) => ({
        ...c,
        author: userMap.get(c.author_id)
            ? {
                id: c.author_id,
                full_name: userMap.get(c.author_id)?.full_name ?? null,
                email: userMap.get(c.author_id)?.email ?? null,
            }
            : undefined,
        mentions: (c.mentions ?? []).map((user_id) => ({ user_id })),
    }));
    // Resolve job_id for hazard, control, photo by joining parent entity (job comments already have entity_id = job_id).
    const hazardControlIds = withAuthors
        .filter((c) => c.entity_type === "hazard" || c.entity_type === "control")
        .map((c) => c.entity_id);
    const photoIds = withAuthors.filter((c) => c.entity_type === "photo").map((c) => c.entity_id);
    const jobIdByEntityId = new Map();
    if (hazardControlIds.length > 0) {
        const { data: mitigationRows } = await supabaseClient_1.supabase
            .from("mitigation_items")
            .select("id, job_id")
            .eq("organization_id", organizationId)
            .in("id", hazardControlIds);
        for (const r of mitigationRows || []) {
            const row = r;
            if (row.job_id)
                jobIdByEntityId.set(row.id, row.job_id);
        }
    }
    if (photoIds.length > 0) {
        const { data: photoRows } = await supabaseClient_1.supabase
            .from("job_photos")
            .select("id, job_id")
            .eq("organization_id", organizationId)
            .in("id", photoIds);
        for (const r of photoRows || []) {
            const row = r;
            if (row.job_id)
                jobIdByEntityId.set(row.id, row.job_id);
        }
    }
    const data = withAuthors.map((c) => {
        const job_id = c.entity_type === "job"
            ? c.entity_id
            : c.entity_type === "hazard" || c.entity_type === "control" || c.entity_type === "photo"
                ? jobIdByEntityId.get(c.entity_id) ?? null
                : null;
        return { ...c, job_id: job_id ?? undefined };
    });
    return { data, count: total, has_more };
}
/** Resolve a comment (sets is_resolved, resolved_by, resolved_at). */
async function resolveComment(organizationId, commentId, userId) {
    const { data: existing } = await supabaseClient_1.supabase
        .from("comments")
        .select("id, deleted_at")
        .eq("id", commentId)
        .eq("organization_id", organizationId)
        .single();
    if (!existing || existing.deleted_at) {
        return { data: null, error: "Comment not found" };
    }
    const now = new Date().toISOString();
    const { data: comment, error } = await supabaseClient_1.supabase
        .from("comments")
        .update({
        is_resolved: true,
        resolved_by: userId,
        resolved_at: now,
        updated_at: now,
    })
        .eq("id", commentId)
        .eq("organization_id", organizationId)
        .select()
        .single();
    if (error) {
        console.error("[Comments] resolveComment error:", error);
        return { data: null, error: error.message };
    }
    return { data: comment, error: null };
}
/** Unresolve a comment (clears is_resolved, resolved_by, resolved_at). */
async function unresolveComment(organizationId, commentId) {
    const { data: existing } = await supabaseClient_1.supabase
        .from("comments")
        .select("id, deleted_at")
        .eq("id", commentId)
        .eq("organization_id", organizationId)
        .single();
    if (!existing || existing.deleted_at) {
        return { data: null, error: "Comment not found" };
    }
    const now = new Date().toISOString();
    const { data: comment, error } = await supabaseClient_1.supabase
        .from("comments")
        .update({
        is_resolved: false,
        resolved_by: null,
        resolved_at: null,
        updated_at: now,
    })
        .eq("id", commentId)
        .eq("organization_id", organizationId)
        .select()
        .single();
    if (error) {
        console.error("[Comments] unresolveComment error:", error);
        return { data: null, error: error.message };
    }
    return { data: comment, error: null };
}
/** List replies for a comment. Excludes soft-deleted by default. Returns has_more when there are additional pages. */
async function listReplies(organizationId, parentId, options = {}) {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
    const offset = Math.max(options.offset ?? 0, 0);
    let query = supabaseClient_1.supabase
        .from("comments")
        .select("id, organization_id, entity_type, entity_id, parent_id, author_id, content, mentions, is_resolved, resolved_by, resolved_at, edited_at, deleted_at, created_at, updated_at")
        .eq("organization_id", organizationId)
        .eq("parent_id", parentId)
        .order("created_at", { ascending: true });
    if (options.includeDeleted !== true) {
        query = query.is("deleted_at", null);
    }
    // Fetch limit+1 to determine has_more
    const { data: rows, error } = await query.range(offset, offset + limit);
    if (error) {
        console.error("[Comments] listReplies error:", error);
        return { data: [], has_more: false };
    }
    const raw = (rows || []);
    const has_more = raw.length > limit;
    const comments = has_more ? raw.slice(0, limit) : raw;
    if (comments.length === 0) {
        return { data: [], has_more: false };
    }
    const authorIds = [...new Set(comments.map((c) => c.author_id))];
    const { data: users } = await supabaseClient_1.supabase
        .from("users")
        .select("id, full_name, email")
        .in("id", authorIds);
    const userMap = new Map((users || []).map((u) => [u.id, u]));
    const data = comments.map((c) => ({
        ...c,
        author: userMap.get(c.author_id)
            ? {
                id: c.author_id,
                full_name: userMap.get(c.author_id)?.full_name ?? null,
                email: userMap.get(c.author_id)?.email ?? null,
            }
            : undefined,
        mentions: (c.mentions ?? []).map((user_id) => ({ user_id })),
    }));
    return { data, has_more };
}
//# sourceMappingURL=comments.js.map