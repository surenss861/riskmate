export declare const COMMENT_ENTITY_TYPES: readonly ["job", "hazard", "control", "task", "document", "signoff", "photo"];
export type CommentEntityType = (typeof COMMENT_ENTITY_TYPES)[number];
export interface CommentRow {
    id: string;
    organization_id: string;
    entity_type: string;
    entity_id: string;
    parent_id: string | null;
    author_id: string;
    content: string;
    mentions?: string[];
    is_resolved?: boolean;
    resolved_by?: string | null;
    resolved_at?: string | null;
    edited_at?: string | null;
    deleted_at?: string | null;
    created_at: string;
    updated_at: string;
}
export interface CommentWithAuthor extends Omit<CommentRow, 'mentions'> {
    author?: {
        id: string;
        full_name: string | null;
        email: string | null;
    };
    /** Resolved mention list for API (CommentRow.mentions is raw UUID[]). */
    mentions?: {
        user_id: string;
    }[];
    reply_count?: number;
}
export interface ListCommentsOptions {
    limit?: number;
    offset?: number;
    includeReplies?: boolean;
    includeDeleted?: boolean;
}
/** List comments for an entity. Excludes soft-deleted by default. Returns author info and reply counts. */
export declare function listComments(organizationId: string, entityType: CommentEntityType, entityId: string, options?: ListCommentsOptions): Promise<{
    data: CommentWithAuthor[];
}>;
/** Get a parent comment by id scoped to org and optional entity_type/entity_id; excludes deleted. Returns null if not found. */
export declare function getParentComment(organizationId: string, parentId: string, entityType?: CommentEntityType | string, entityId?: string): Promise<CommentRow | null>;
/** Create a comment with optional mentions (stored in comments.mentions; sends notifications). Parses body for @[Name](id) as fallback. */
export declare function createComment(organizationId: string, authorId: string, params: {
    entity_type: CommentEntityType;
    entity_id: string;
    body: string;
    parent_id?: string | null;
    mention_user_ids?: string[];
}): Promise<{
    data: CommentRow | null;
    error: string | null;
}>;
/** Update comment content (sets edited_at). Re-parses mentions, sends notifications for newly added mentions. Author only. */
export declare function updateComment(organizationId: string, commentId: string, body: string, userId: string): Promise<{
    data: CommentRow | null;
    error: string | null;
}>;
/** Soft-delete a comment (sets deleted_at and updated_at). No cascade on replies. Caller must ensure author or org admin. */
export declare function deleteComment(organizationId: string, commentId: string): Promise<{
    ok: boolean;
    error: string | null;
}>;
/** Get a single comment by id (for permission checks). Includes deleted. */
export declare function getComment(organizationId: string, commentId: string): Promise<CommentRow | null>;
/** List comments where the given user is in mentions array. Excludes soft-deleted. */
export declare function listCommentsWhereMentioned(organizationId: string, userId: string, options?: {
    limit?: number;
    offset?: number;
}): Promise<{
    data: CommentWithAuthor[];
}>;
/** Resolve a comment (sets is_resolved, resolved_by, resolved_at). */
export declare function resolveComment(organizationId: string, commentId: string, userId: string): Promise<{
    data: CommentRow | null;
    error: string | null;
}>;
/** Unresolve a comment (clears is_resolved, resolved_by, resolved_at). */
export declare function unresolveComment(organizationId: string, commentId: string): Promise<{
    data: CommentRow | null;
    error: string | null;
}>;
/** List replies for a comment. Excludes soft-deleted by default. */
export declare function listReplies(organizationId: string, parentId: string, options?: {
    limit?: number;
    offset?: number;
    includeDeleted?: boolean;
}): Promise<{
    data: CommentWithAuthor[];
}>;
//# sourceMappingURL=comments.d.ts.map