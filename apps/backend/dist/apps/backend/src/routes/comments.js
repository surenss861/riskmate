"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.commentsRouter = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const comments_1 = require("../services/comments");
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
        res.json(result);
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
        res.json(result);
    }
    catch (err) {
        console.error("List mentions failed:", err);
        res.status(500).json({ message: "Failed to list comments where mentioned" });
    }
});
/** POST /api/comments — create a comment. Body: entity_type, entity_id, body, parent_id?, mention_user_ids? */
exports.commentsRouter.post("/", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    const body = (req.body || {});
    const entityType = body.entity_type;
    const entityId = body.entity_id;
    const commentBody = body.body;
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
    try {
        const result = await (0, comments_1.createComment)(authReq.user.organization_id, authReq.user.id, {
            entity_type: entityType,
            entity_id: entityId,
            body: commentBody ?? "",
            parent_id: body.parent_id,
            mention_user_ids: Array.isArray(body.mention_user_ids) ? body.mention_user_ids : undefined,
        });
        if (result.error) {
            return res.status(400).json({ message: result.error, code: "CREATE_FAILED" });
        }
        res.status(201).json({ data: result.data });
    }
    catch (err) {
        console.error("Create comment failed:", err);
        res.status(500).json({ message: "Failed to create comment" });
    }
});
/** PATCH /api/comments/:id — update comment body (author only). */
exports.commentsRouter.patch("/:id", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    const commentId = req.params.id;
    const body = (req.body || {});
    const commentBody = body.body;
    if (commentBody !== undefined && (typeof commentBody !== "string" || !commentBody.trim())) {
        return res.status(400).json({
            message: "body.body must be a non-empty string",
            code: "INVALID_BODY",
        });
    }
    if (commentBody === undefined) {
        return res.status(400).json({ message: "body.body is required", code: "MISSING_BODY" });
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
        res.json({ data: result.data });
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
//# sourceMappingURL=comments.js.map