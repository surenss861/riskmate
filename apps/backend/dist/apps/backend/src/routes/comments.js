"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.commentsRouter = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const comments_1 = require("../services/comments");
const notifications_1 = require("../services/notifications");
const supabaseClient_1 = require("../lib/supabaseClient");
const mentionParser_1 = require("../utils/mentionParser");
/** Table names for entity_type ownership checks (entity_id must exist in table with organization_id). */
const ENTITY_TYPE_TO_TABLE = {
    job: "jobs",
    hazard: "hazards",
    control: "controls",
    task: "tasks",
    document: "job_documents",
    signoff: "job_signoffs",
    photo: "job_photos",
};
async function assertEntityExistsInOrg(entityType, entityId, organizationId) {
    const table = ENTITY_TYPE_TO_TABLE[entityType];
    if (!table) {
        return { ok: false, status: 400, code: "INVALID_ENTITY_TYPE", message: "Invalid entity_type" };
    }
    const { data, error } = await supabaseClient_1.supabase
        .from(table)
        .select("id, organization_id")
        .eq("id", entityId)
        .eq("organization_id", organizationId)
        .maybeSingle();
    if (error || !data) {
        return { ok: false, status: 404, code: "NOT_FOUND", message: "Target entity not found" };
    }
    return { ok: true };
}
exports.commentsRouter = express_1.default.Router();
/** GET /api/comments?entity_type=job&entity_id=uuid — list comments for an entity. */
exports.commentsRouter.get("/", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    const entityType = typeof req.query.entity_type === "string" ? req.query.entity_type : undefined;
    const entityId = typeof req.query.entity_id === "string" ? req.query.entity_id : undefined;
    if (!entityType || !entityId) {
        return res.status(400).json({
            message: "Query params entity_type and entity_id are required",
            code: "MISSING_PARAMS",
        });
    }
    if (!comments_1.COMMENT_ENTITY_TYPES.includes(entityType)) {
        return res.status(400).json({
            message: `entity_type must be one of: ${comments_1.COMMENT_ENTITY_TYPES.join(", ")}`,
            code: "INVALID_ENTITY_TYPE",
        });
    }
    try {
        const limit = req.query.limit != null ? parseInt(String(req.query.limit), 10) : 50;
        const offset = req.query.offset != null ? parseInt(String(req.query.offset), 10) : 0;
        const includeReplies = req.query.include_replies !== "false";
        const result = await (0, comments_1.listComments)(authReq.user.organization_id, entityType, entityId, { limit, offset, includeReplies });
        const data = (result.data || []).map((c) => ({ ...c, content: c.content }));
        res.json({ data });
    }
    catch (err) {
        console.error("List comments failed:", err);
        res.status(500).json({ message: "Failed to list comments" });
    }
});
/** GET /api/comments/mentions/me — list comments where current user is mentioned. */
exports.commentsRouter.get("/mentions/me", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    try {
        const limit = req.query.limit != null ? parseInt(String(req.query.limit), 10) : 20;
        const offset = req.query.offset != null ? parseInt(String(req.query.offset), 10) : 0;
        const result = await (0, comments_1.listCommentsWhereMentioned)(authReq.user.organization_id, authReq.user.id, { limit, offset });
        const data = (result.data || []).map((c) => ({ ...c, content: c.content }));
        res.json({ data });
    }
    catch (err) {
        console.error("List mentions failed:", err);
        res.status(500).json({ message: "Failed to list comments where mentioned" });
    }
});
/** POST /api/comments — create a comment. Body: entity_type, entity_id, content (or body), parent_id?, mention_user_ids? */
exports.commentsRouter.post("/", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    const body = (req.body || {});
    const entityType = body.entity_type;
    const entityId = body.entity_id;
    const commentBody = body.content ?? body.body ?? "";
    if (!entityType || !entityId) {
        return res.status(400).json({
            message: "body must include entity_type and entity_id",
            code: "MISSING_PARAMS",
        });
    }
    if (!comments_1.COMMENT_ENTITY_TYPES.includes(entityType)) {
        return res.status(400).json({
            message: `entity_type must be one of: ${comments_1.COMMENT_ENTITY_TYPES.join(", ")}`,
            code: "INVALID_ENTITY_TYPE",
        });
    }
    // When parent_id is provided, ensure parent comment exists in this org and entity, and is not deleted
    if (body.parent_id != null && body.parent_id !== "") {
        const parent = await (0, comments_1.getParentComment)(authReq.user.organization_id, body.parent_id, entityType, entityId);
        if (!parent) {
            return res.status(404).json({
                message: "Parent comment not found or not valid for this entity",
                code: "NOT_FOUND",
            });
        }
    }
    // Validate target entity exists and belongs to caller's organization
    const entityCheck = await assertEntityExistsInOrg(entityType, entityId, authReq.user.organization_id);
    if (!entityCheck.ok) {
        return res.status(entityCheck.status).json({
            message: entityCheck.message,
            code: entityCheck.code,
        });
    }
    const fromText = (0, mentionParser_1.extractMentionUserIds)(commentBody);
    const explicitMentions = Array.isArray(body.mention_user_ids) ? body.mention_user_ids : [];
    const mentionUserIds = [...new Set([...explicitMentions, ...fromText])].filter((id) => id && id !== authReq.user.id);
    try {
        const result = await (0, comments_1.createComment)(authReq.user.organization_id, authReq.user.id, {
            entity_type: entityType,
            entity_id: entityId,
            body: commentBody,
            parent_id: body.parent_id,
            mention_user_ids: mentionUserIds.length > 0 ? mentionUserIds : undefined,
        });
        if (result.error) {
            if (result.error.includes("Parent comment not found")) {
                return res.status(404).json({ message: result.error, code: "NOT_FOUND" });
            }
            return res.status(400).json({ message: result.error, code: "CREATE_FAILED" });
        }
        const data = result.data;
        // Notify job owner when someone comments on their job (skip when author is the owner)
        if (entityType === "job" && entityId && data?.id && authReq.user.id) {
            const { data: job } = await supabaseClient_1.supabase
                .from("jobs")
                .select("assigned_to_id")
                .eq("id", entityId)
                .eq("organization_id", authReq.user.organization_id)
                .maybeSingle();
            const ownerId = job?.assigned_to_id;
            if (ownerId && ownerId !== authReq.user.id) {
                (0, notifications_1.sendJobCommentNotification)(ownerId, authReq.user.organization_id, data.id, entityId, "Someone commented on a job you own.").catch((err) => console.error("[Comments] Job comment notification failed:", err));
            }
        }
        res.status(201).json({ data: data ? { ...data, content: data.content } : data });
    }
    catch (err) {
        console.error("Create comment failed:", err);
        res.status(500).json({ message: "Failed to create comment" });
    }
});
/** PATCH /api/comments/:id — update comment content (author only). */
exports.commentsRouter.patch("/:id", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    const commentId = req.params.id;
    const body = (req.body || {});
    const commentBody = body.content ?? body.body;
    if (commentBody !== undefined && (typeof commentBody !== "string" || !commentBody.trim())) {
        return res.status(400).json({
            message: "content must be a non-empty string",
            code: "INVALID_BODY",
        });
    }
    if (commentBody === undefined) {
        return res.status(400).json({ message: "content is required", code: "MISSING_BODY" });
    }
    try {
        const result = await (0, comments_1.updateComment)(authReq.user.organization_id, commentId, commentBody, authReq.user.id);
        if (result.error) {
            if (result.error === "Comment not found") {
                return res.status(404).json({ message: result.error, code: "NOT_FOUND" });
            }
            if (result.error.includes("Only the author")) {
                return res.status(403).json({ message: result.error, code: "FORBIDDEN" });
            }
            return res.status(400).json({ message: result.error, code: "UPDATE_FAILED" });
        }
        const data = result.data;
        res.json({ data: data ? { ...data, content: data.content } : data });
    }
    catch (err) {
        console.error("Update comment failed:", err);
        res.status(500).json({ message: "Failed to update comment" });
    }
});
/** DELETE /api/comments/:id — delete a comment (author or org admin). */
exports.commentsRouter.delete("/:id", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    const commentId = req.params.id;
    const comment = await (0, comments_1.getComment)(authReq.user.organization_id, commentId);
    if (!comment) {
        return res.status(404).json({ message: "Comment not found", code: "NOT_FOUND" });
    }
    const isAuthor = comment.author_id === authReq.user.id;
    const isAdmin = authReq.user.role === "owner" || authReq.user.role === "admin";
    if (!isAuthor && !isAdmin) {
        return res.status(403).json({
            message: "Only the author or an admin can delete this comment",
            code: "FORBIDDEN",
        });
    }
    try {
        const result = await (0, comments_1.deleteComment)(authReq.user.organization_id, commentId);
        if (result.error) {
            return res.status(400).json({ message: result.error, code: "DELETE_FAILED" });
        }
        res.status(204).send();
    }
    catch (err) {
        console.error("Delete comment failed:", err);
        res.status(500).json({ message: "Failed to delete comment" });
    }
});
/** POST /api/comments/:id/resolve — mark comment resolved (author or owner/admin only). */
exports.commentsRouter.post("/:id/resolve", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    const commentId = req.params.id;
    const comment = await (0, comments_1.getComment)(authReq.user.organization_id, commentId);
    if (!comment) {
        return res.status(404).json({ message: "Comment not found", code: "NOT_FOUND" });
    }
    const isAuthor = comment.author_id === authReq.user.id;
    const isAdmin = authReq.user.role === "owner" || authReq.user.role === "admin";
    if (!isAuthor && !isAdmin) {
        return res.status(403).json({
            message: "Only the author or an admin can resolve this comment",
            code: "FORBIDDEN",
        });
    }
    try {
        const result = await (0, comments_1.resolveComment)(authReq.user.organization_id, commentId, authReq.user.id);
        if (result.error) {
            return res.status(404).json({ message: result.error, code: "NOT_FOUND" });
        }
        const data = result.data;
        // Notify original author when someone else resolves their comment (gated by preferences)
        const authorId = comment.author_id;
        if (authorId && authorId !== authReq.user.id) {
            (0, notifications_1.sendCommentResolvedNotification)(authorId, authReq.user.organization_id, commentId, "Your comment was marked resolved.").catch((err) => console.error("[Comments] Comment resolved notification failed:", err));
        }
        res.json({ data: data ? { ...data, content: data.content } : data });
    }
    catch (err) {
        console.error("Resolve comment failed:", err);
        res.status(500).json({ message: "Failed to resolve comment" });
    }
});
/** DELETE /api/comments/:id/resolve — unresolve comment (author or owner/admin only). Kept for backward compatibility; prefer POST /:id/unresolve. */
exports.commentsRouter.delete("/:id/resolve", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    const commentId = req.params.id;
    const comment = await (0, comments_1.getComment)(authReq.user.organization_id, commentId);
    if (!comment) {
        return res.status(404).json({ message: "Comment not found", code: "NOT_FOUND" });
    }
    const isAuthor = comment.author_id === authReq.user.id;
    const isAdmin = authReq.user.role === "owner" || authReq.user.role === "admin";
    if (!isAuthor && !isAdmin) {
        return res.status(403).json({
            message: "Only the author or an admin can unresolve this comment",
            code: "FORBIDDEN",
        });
    }
    try {
        const result = await (0, comments_1.unresolveComment)(authReq.user.organization_id, commentId);
        if (result.error) {
            return res.status(404).json({ message: result.error, code: "NOT_FOUND" });
        }
        const data = result.data;
        res.json({ data: data ? { ...data, content: data.content } : data });
    }
    catch (err) {
        console.error("Unresolve comment failed:", err);
        res.status(500).json({ message: "Failed to unresolve comment" });
    }
});
/** POST /api/comments/:id/unresolve — clear is_resolved, resolved_by, resolved_at (spec-aligned). Prefer over DELETE /:id/resolve. */
exports.commentsRouter.post("/:id/unresolve", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    const commentId = req.params.id;
    const comment = await (0, comments_1.getComment)(authReq.user.organization_id, commentId);
    if (!comment) {
        return res.status(404).json({ message: "Comment not found", code: "NOT_FOUND" });
    }
    const isAuthor = comment.author_id === authReq.user.id;
    const isAdmin = authReq.user.role === "owner" || authReq.user.role === "admin";
    if (!isAuthor && !isAdmin) {
        return res.status(403).json({
            message: "Only the author or an admin can unresolve this comment",
            code: "FORBIDDEN",
        });
    }
    try {
        const result = await (0, comments_1.unresolveComment)(authReq.user.organization_id, commentId);
        if (result.error) {
            return res.status(404).json({ message: result.error, code: "NOT_FOUND" });
        }
        const data = result.data;
        res.json({ data: data ? { ...data, content: data.content } : data });
    }
    catch (err) {
        console.error("Unresolve comment failed:", err);
        res.status(500).json({ message: "Failed to unresolve comment" });
    }
});
/** GET /api/comments/:id/replies — list replies for a comment. */
exports.commentsRouter.get("/:id/replies", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    const parentId = req.params.id;
    try {
        const limit = req.query.limit != null ? parseInt(String(req.query.limit), 10) : 50;
        const offset = req.query.offset != null ? parseInt(String(req.query.offset), 10) : 0;
        const result = await (0, comments_1.listReplies)(authReq.user.organization_id, parentId, { limit, offset });
        const data = (result.data || []).map((c) => ({ ...c, content: c.content }));
        res.json({ data });
    }
    catch (err) {
        console.error("List replies failed:", err);
        res.status(500).json({ message: "Failed to list replies" });
    }
});
/** POST /api/comments/:id/replies — create a reply (entity_type/entity_id from parent comment). */
exports.commentsRouter.post("/:id/replies", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    const parentId = req.params.id;
    const body = (req.body || {});
    const commentBody = body.content ?? body.body ?? "";
    if (!commentBody || typeof commentBody !== "string" || !commentBody.trim()) {
        return res.status(400).json({
            message: "content is required and must be a non-empty string",
            code: "INVALID_BODY",
        });
    }
    const parent = await (0, comments_1.getComment)(authReq.user.organization_id, parentId);
    if (!parent || parent.deleted_at) {
        return res.status(404).json({ message: "Comment not found", code: "NOT_FOUND" });
    }
    const fromText = (0, mentionParser_1.extractMentionUserIds)(commentBody);
    const explicitMentions = Array.isArray(body.mention_user_ids) ? body.mention_user_ids : [];
    const mentionUserIds = [...new Set([...explicitMentions, ...fromText])].filter((id) => id && id !== authReq.user.id);
    try {
        const result = await (0, comments_1.createComment)(authReq.user.organization_id, authReq.user.id, {
            entity_type: parent.entity_type,
            entity_id: parent.entity_id,
            body: commentBody.trim(),
            parent_id: parentId,
            mention_user_ids: mentionUserIds.length > 0 ? mentionUserIds : undefined,
        });
        if (result.error) {
            return res.status(400).json({ message: result.error, code: "CREATE_FAILED" });
        }
        const parentAuthorId = parent.author_id;
        if (parentAuthorId && parentAuthorId !== authReq.user.id && result.data) {
            (0, notifications_1.sendCommentReplyNotification)(parentAuthorId, authReq.user.organization_id, result.data.id, "Someone replied to your comment.").catch((err) => console.error("[Comments] Reply notification failed:", err));
        }
        const replyData = result.data;
        res.status(201).json({ data: replyData ? { ...replyData, content: replyData.content } : replyData });
    }
    catch (err) {
        console.error("Create reply failed:", err);
        res.status(500).json({ message: "Failed to create reply" });
    }
});
//# sourceMappingURL=comments.js.map