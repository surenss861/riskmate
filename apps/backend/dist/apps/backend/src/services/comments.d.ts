export declare const COMMENT_ENTITY_TYPES: readonly ["job", "hazard", "control", "task", "document", "signoff"];
export type CommentEntityType = (typeof COMMENT_ENTITY_TYPES)[number];
export interface CommentRow {
    id: string;
    organization_id: string;
    entity_type: string;
    entity_id: string;
    parent_id: string | null;
    author_id: string;
    body: string;
    created_at: string;
    updated_at: string;
}
export interface CommentWithAuthor extends CommentRow {
    author?: {
        id: string;
        full_name: string | null;
        email: string | null;
    };
    mentions?: {
        user_id: string;
    }[];
}
export interface ListCommentsOptions {
    limit?: number;
    offset?: number;
    includeReplies?: boolean;
}
/** List comments for an entity. Returns flat list (replies have parent_id set). */
export declare function listComments(organizationId: string, entityType: CommentEntityType, entityId: string, options?: ListCommentsOptions): Promise<{
    data: CommentWithAuthor[];
}>;
/** Create a comment and optionally mention users (sends notifications). */
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
/** Update comment body (caller must ensure author or admin). */
export declare function updateComment(organizationId: string, commentId: string, body: string, userId: string): Promise<{
    data: CommentRow | null;
    error: string | null;
}>;
/** Delete a comment (caller must ensure author or org admin). */
export declare function deleteComment(organizationId: string, commentId: string): Promise<{
    ok: boolean;
    error: string | null;
}>;
/** Get a single comment by id (for permission checks). */
export declare function getComment(organizationId: string, commentId: string): Promise<CommentRow | null>;
/** List comments where the given user is mentioned (for notification center). */
export declare function listCommentsWhereMentioned(organizationId: string, userId: string, options?: {
    limit?: number;
    offset?: number;
}): Promise<{
    data: CommentWithAuthor[];
}>;
//# sourceMappingURL=comments.d.ts.map