"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMMENT_ENTITY_TYPES = void 0;
exports.listComments = listComments;
exports.createComment = createComment;
exports.updateComment = updateComment;
exports.deleteComment = deleteComment;
exports.getComment = getComment;
exports.listCommentsWhereMentioned = listCommentsWhereMentioned;
const supabaseClient_1 = require("../lib/supabaseClient");
const notifications_1 = require("./notifications");
exports.COMMENT_ENTITY_TYPES = [
    "job",
    "hazard",
    "control",
    "task",
    "document",
    "signoff",
];
/** List comments for an entity. Returns flat list (replies have parent_id set). */
async function listComments(organizationId, entityType, entityId, options = {}) {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
    const offset = Math.max(options.offset ?? 0, 0);
    let query = supabaseClient_1.supabase
        .from("comments")
        .select("id, organization_id, entity_type, entity_id, parent_id, author_id, body, created_at, updated_at")
        .eq("organization_id", organizationId)
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: true });
    if (options.includeReplies === false) {
        query = query.is("parent_id", null);
    }
    const { data: rows, error } = await query.range(offset, offset + limit - 1);
    if (error) {
        console.error("[Comments] listComments error:", error);
        return { data: [] };
    }
    const comments = (rows || []);
    if (comments.length === 0) {
        return { data: [] };
    }
    const authorIds = [...new Set(comments.map((c) => c.author_id))];
    const { data: users } = await supabaseClient_1.supabase
        .from("users")
        .select("id, full_name, email")
        .in("id", authorIds);
    const commentIds = comments.map((c) => c.id);
    const { data: mentionRows } = await supabaseClient_1.supabase
        .from("comment_mentions")
        .select("comment_id, user_id")
        .in("comment_id", commentIds);
    const userMap = new Map((users || []).map((u) => [u.id, u]));
    const mentionsByComment = new Map();
    for (const m of mentionRows || []) {
        const list = mentionsByComment.get(m.comment_id) ?? [];
        list.push({ user_id: m.user_id });
        mentionsByComment.set(m.comment_id, list);
    }
    const data = comments.map((c) => ({
        ...c,
        author: userMap.get(c.author_id)
            ? {
                id: c.author_id,
                full_name: userMap.get(c.author_id)?.full_name ?? null,
                email: userMap.get(c.author_id)?.email ?? null,
            }
            : undefined,
        mentions: mentionsByComment.get(c.id) ?? [],
    }));
    return { data };
}
/** Create a comment and optionally mention users (sends notifications). */
async function createComment(organizationId, authorId, params) {
    const { entity_type, entity_id, body, parent_id, mention_user_ids } = params;
    if (!body || typeof body !== "string" || body.trim().length === 0) {
        return { data: null, error: "Body is required" };
    }
    if (!exports.COMMENT_ENTITY_TYPES.includes(entity_type)) {
        return { data: null, error: "Invalid entity_type" };
    }
    const { data: comment, error: insertError } = await supabaseClient_1.supabase
        .from("comments")
        .insert({
        organization_id: organizationId,
        entity_type,
        entity_id,
        parent_id: parent_id ?? null,
        author_id: authorId,
        body: body.trim(),
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
    const toMention = (mention_user_ids ?? []).filter((id) => id && id !== authorId);
    if (toMention.length > 0) {
        await supabaseClient_1.supabase.from("comment_mentions").insert(toMention.map((user_id) => ({
            comment_id: comment.id,
            user_id,
        })));
        const contextLabel = "You were mentioned in a comment.";
        for (const userId of toMention) {
            (0, notifications_1.sendMentionNotification)(userId, organizationId, comment.id, contextLabel).catch((err) => console.error("[Comments] Mention notification failed:", err));
        }
    }
    return { data: comment, error: null };
}
/** Update comment body (caller must ensure author or admin). */
async function updateComment(organizationId, commentId, body, userId) {
    if (!body || typeof body !== "string" || body.trim().length === 0) {
        return { data: null, error: "Body is required" };
    }
    const { data: existing } = await supabaseClient_1.supabase
        .from("comments")
        .select("id, author_id, organization_id")
        .eq("id", commentId)
        .eq("organization_id", organizationId)
        .single();
    if (!existing) {
        return { data: null, error: "Comment not found" };
    }
    if (existing.author_id !== userId) {
        return { data: null, error: "Only the author can update this comment" };
    }
    const { data: comment, error } = await supabaseClient_1.supabase
        .from("comments")
        .update({ body: body.trim(), updated_at: new Date().toISOString() })
        .eq("id", commentId)
        .eq("organization_id", organizationId)
        .select()
        .single();
    if (error) {
        console.error("[Comments] updateComment error:", error);
        return { data: null, error: error.message };
    }
    return { data: comment, error: null };
}
/** Delete a comment (caller must ensure author or org admin). */
async function deleteComment(organizationId, commentId) {
    const { error } = await supabaseClient_1.supabase
        .from("comments")
        .delete()
        .eq("id", commentId)
        .eq("organization_id", organizationId);
    if (error) {
        console.error("[Comments] deleteComment error:", error);
        return { ok: false, error: error.message };
    }
    return { ok: true, error: null };
}
/** Get a single comment by id (for permission checks). */
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
/** List comments where the given user is mentioned (for notification center). */
async function listCommentsWhereMentioned(organizationId, userId, options = {}) {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
    const offset = Math.max(options.offset ?? 0, 0);
    const { data: mentionRows, error: mentionError } = await supabaseClient_1.supabase
        .from("comment_mentions")
        .select("comment_id")
        .eq("user_id", userId);
    if (mentionError || !mentionRows?.length) {
        return { data: [] };
    }
    const commentIds = [...new Set(mentionRows.map((r) => r.comment_id))];
    const { data: comments, error } = await supabaseClient_1.supabase
        .from("comments")
        .select("id, organization_id, entity_type, entity_id, parent_id, author_id, body, created_at, updated_at")
        .eq("organization_id", organizationId)
        .in("id", commentIds)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
    if (error || !comments?.length) {
        return { data: [] };
    }
    const authorIds = [...new Set(comments.map((c) => c.author_id))];
    const { data: users } = await supabaseClient_1.supabase
        .from("users")
        .select("id, full_name, email")
        .in("id", authorIds);
    const { data: mentionRows2 } = await supabaseClient_1.supabase
        .from("comment_mentions")
        .select("comment_id, user_id")
        .in("comment_id", comments.map((c) => c.id));
    const userMap = new Map((users || []).map((u) => [u.id, u]));
    const mentionsByComment = new Map();
    for (const m of mentionRows2 || []) {
        const list = mentionsByComment.get(m.comment_id) ?? [];
        list.push({ user_id: m.user_id });
        mentionsByComment.set(m.comment_id, list);
    }
    const data = comments.map((c) => ({
        ...c,
        author: userMap.get(c.author_id)
            ? {
                id: c.author_id,
                full_name: userMap.get(c.author_id)?.full_name ?? null,
                email: userMap.get(c.author_id)?.email ?? null,
            }
            : undefined,
        mentions: mentionsByComment.get(c.id) ?? [],
    }));
    return { data };
}
//# sourceMappingURL=comments.js.map