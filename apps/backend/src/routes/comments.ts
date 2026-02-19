import express, { type Router as ExpressRouter } from "express";
import { authenticate, AuthenticatedRequest } from "../middleware/auth";
import {
  listComments,
  createComment,
  updateComment,
  deleteComment,
  getComment,
  listCommentsWhereMentioned,
  resolveComment,
  unresolveComment,
  listReplies,
  COMMENT_ENTITY_TYPES,
  type CommentEntityType,
} from "../services/comments";
import { sendCommentReplyNotification } from "../services/notifications";

export const commentsRouter: ExpressRouter = express.Router();

/** GET /api/comments?entity_type=job&entity_id=uuid — list comments for an entity. */
commentsRouter.get(
  "/",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    const entityType = typeof req.query.entity_type === "string" ? req.query.entity_type : undefined;
    const entityId = typeof req.query.entity_id === "string" ? req.query.entity_id : undefined;

    if (!entityType || !entityId) {
      return res.status(400).json({
        message: "Query params entity_type and entity_id are required",
        code: "MISSING_PARAMS",
      });
    }
    if (!COMMENT_ENTITY_TYPES.includes(entityType as CommentEntityType)) {
      return res.status(400).json({
        message: `entity_type must be one of: ${COMMENT_ENTITY_TYPES.join(", ")}`,
        code: "INVALID_ENTITY_TYPE",
      });
    }

    try {
      const limit = req.query.limit != null ? parseInt(String(req.query.limit), 10) : 50;
      const offset = req.query.offset != null ? parseInt(String(req.query.offset), 10) : 0;
      const includeReplies = req.query.include_replies !== "false";

      const result = await listComments(
        authReq.user.organization_id,
        entityType as CommentEntityType,
        entityId,
        { limit, offset, includeReplies }
      );
      res.json(result);
    } catch (err: any) {
      console.error("List comments failed:", err);
      res.status(500).json({ message: "Failed to list comments" });
    }
  }
);

/** GET /api/comments/mentions/me — list comments where current user is mentioned. */
commentsRouter.get(
  "/mentions/me",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    try {
      const limit = req.query.limit != null ? parseInt(String(req.query.limit), 10) : 20;
      const offset = req.query.offset != null ? parseInt(String(req.query.offset), 10) : 0;
      const result = await listCommentsWhereMentioned(
        authReq.user.organization_id,
        authReq.user.id,
        { limit, offset }
      );
      res.json(result);
    } catch (err: any) {
      console.error("List mentions failed:", err);
      res.status(500).json({ message: "Failed to list comments where mentioned" });
    }
  }
);

/** POST /api/comments — create a comment. Body: entity_type, entity_id, body, parent_id?, mention_user_ids? */
commentsRouter.post(
  "/",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    const body = (req.body || {}) as {
      entity_type?: string;
      entity_id?: string;
      body?: string;
      parent_id?: string | null;
      mention_user_ids?: string[];
    };

    const entityType = body.entity_type;
    const entityId = body.entity_id;
    const commentBody = body.body;
    if (!entityType || !entityId) {
      return res.status(400).json({
        message: "body must include entity_type and entity_id",
        code: "MISSING_PARAMS",
      });
    }
    if (!COMMENT_ENTITY_TYPES.includes(entityType as CommentEntityType)) {
      return res.status(400).json({
        message: `entity_type must be one of: ${COMMENT_ENTITY_TYPES.join(", ")}`,
        code: "INVALID_ENTITY_TYPE",
      });
    }

    try {
      const result = await createComment(
        authReq.user.organization_id,
        authReq.user.id,
        {
          entity_type: entityType as CommentEntityType,
          entity_id: entityId,
          body: commentBody ?? "",
          parent_id: body.parent_id,
          mention_user_ids: Array.isArray(body.mention_user_ids) ? body.mention_user_ids : undefined,
        }
      );
      if (result.error) {
        return res.status(400).json({ message: result.error, code: "CREATE_FAILED" });
      }
      res.status(201).json({ data: result.data });
    } catch (err: any) {
      console.error("Create comment failed:", err);
      res.status(500).json({ message: "Failed to create comment" });
    }
  }
);

/** PATCH /api/comments/:id — update comment body (author only). */
commentsRouter.patch(
  "/:id",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    const commentId = req.params.id;
    const body = (req.body || {}) as { body?: string };
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
      const result = await updateComment(
        authReq.user.organization_id,
        commentId,
        commentBody,
        authReq.user.id
      );
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
    } catch (err: any) {
      console.error("Update comment failed:", err);
      res.status(500).json({ message: "Failed to update comment" });
    }
  }
);

/** DELETE /api/comments/:id — delete a comment (author or org admin). */
commentsRouter.delete(
  "/:id",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    const commentId = req.params.id;

    const comment = await getComment(authReq.user.organization_id, commentId);
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
      const result = await deleteComment(authReq.user.organization_id, commentId);
      if (result.error) {
        return res.status(400).json({ message: result.error, code: "DELETE_FAILED" });
      }
      res.status(204).send();
    } catch (err: any) {
      console.error("Delete comment failed:", err);
      res.status(500).json({ message: "Failed to delete comment" });
    }
  }
);

/** POST /api/comments/:id/resolve — mark comment resolved (author or owner/admin only). */
commentsRouter.post(
  "/:id/resolve",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    const commentId = req.params.id;

    const comment = await getComment(authReq.user.organization_id, commentId);
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
      const result = await resolveComment(
        authReq.user.organization_id,
        commentId,
        authReq.user.id
      );
      if (result.error) {
        return res.status(404).json({ message: result.error, code: "NOT_FOUND" });
      }
      res.json({ data: result.data });
    } catch (err: any) {
      console.error("Resolve comment failed:", err);
      res.status(500).json({ message: "Failed to resolve comment" });
    }
  }
);

/** DELETE /api/comments/:id/resolve — unresolve comment (author or owner/admin only). */
commentsRouter.delete(
  "/:id/resolve",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    const commentId = req.params.id;

    const comment = await getComment(authReq.user.organization_id, commentId);
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
      const result = await unresolveComment(
        authReq.user.organization_id,
        commentId
      );
      if (result.error) {
        return res.status(404).json({ message: result.error, code: "NOT_FOUND" });
      }
      res.json({ data: result.data });
    } catch (err: any) {
      console.error("Unresolve comment failed:", err);
      res.status(500).json({ message: "Failed to unresolve comment" });
    }
  }
);

/** GET /api/comments/:id/replies — list replies for a comment. */
commentsRouter.get(
  "/:id/replies",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    const parentId = req.params.id;
    try {
      const limit = req.query.limit != null ? parseInt(String(req.query.limit), 10) : 50;
      const offset = req.query.offset != null ? parseInt(String(req.query.offset), 10) : 0;
      const result = await listReplies(
        authReq.user.organization_id,
        parentId,
        { limit, offset }
      );
      res.json(result);
    } catch (err: any) {
      console.error("List replies failed:", err);
      res.status(500).json({ message: "Failed to list replies" });
    }
  }
);

/** POST /api/comments/:id/replies — create a reply (entity_type/entity_id from parent comment). */
commentsRouter.post(
  "/:id/replies",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    const parentId = req.params.id;
    const body = (req.body || {}) as { body?: string; mention_user_ids?: string[] };
    const commentBody = body.body;
    if (!commentBody || typeof commentBody !== "string" || !commentBody.trim()) {
      return res.status(400).json({
        message: "body.body is required and must be a non-empty string",
        code: "INVALID_BODY",
      });
    }
    const parent = await getComment(authReq.user.organization_id, parentId);
    if (!parent || (parent as any).deleted_at) {
      return res.status(404).json({ message: "Comment not found", code: "NOT_FOUND" });
    }
    try {
      const result = await createComment(
        authReq.user.organization_id,
        authReq.user.id,
        {
          entity_type: parent.entity_type as CommentEntityType,
          entity_id: parent.entity_id,
          body: commentBody.trim(),
          parent_id: parentId,
          mention_user_ids: Array.isArray(body.mention_user_ids) ? body.mention_user_ids : undefined,
        }
      );
      if (result.error) {
        return res.status(400).json({ message: result.error, code: "CREATE_FAILED" });
      }
      const parentAuthorId = parent.author_id;
      if (parentAuthorId && parentAuthorId !== authReq.user.id && result.data) {
        sendCommentReplyNotification(
          parentAuthorId,
          authReq.user.organization_id,
          result.data.id,
          "Someone replied to your comment."
        ).catch((err) =>
          console.error("[Comments] Reply notification failed:", err)
        );
      }
      res.status(201).json({ data: result.data });
    } catch (err: any) {
      console.error("Create reply failed:", err);
      res.status(500).json({ message: "Failed to create reply" });
    }
  }
);
