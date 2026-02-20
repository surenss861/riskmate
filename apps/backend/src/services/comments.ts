import { supabase } from "../lib/supabaseClient";
import { sendMentionNotification } from "./notifications";
import { extractMentionUserIds } from "../utils/mentionParser";

export const COMMENT_ENTITY_TYPES = [
  "job",
  "hazard",
  "control",
  "task",
  "document",
  "signoff",
  "photo",
] as const;
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
  author?: { id: string; full_name: string | null; email: string | null };
  /** Resolved mention list for API (CommentRow.mentions is raw UUID[]). */
  mentions?: { user_id: string }[];
  reply_count?: number;
}

export interface ListCommentsOptions {
  limit?: number;
  offset?: number;
  includeReplies?: boolean;
  includeDeleted?: boolean;
}

/** List comments for an entity. Excludes soft-deleted by default. Returns author info and reply counts. */
export async function listComments(
  organizationId: string,
  entityType: CommentEntityType,
  entityId: string,
  options: ListCommentsOptions = {}
): Promise<{ data: CommentWithAuthor[] }> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);

  let query = supabase
    .from("comments")
    .select(
      "id, organization_id, entity_type, entity_id, parent_id, author_id, content, mentions, is_resolved, resolved_by, resolved_at, edited_at, deleted_at, created_at, updated_at"
    )
    .eq("organization_id", organizationId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: true });

  if (options.includeReplies === false) {
    query = query.is("parent_id", null);
  }
  if (options.includeDeleted !== true) {
    query = query.is("deleted_at", null);
  }

  const { data: rows, error } = await query.range(offset, offset + limit - 1);

  if (error) {
    console.error("[Comments] listComments error:", error);
    return { data: [] };
  }

  const comments = (rows || []) as CommentRow[];
  if (comments.length === 0) {
    return { data: [] };
  }

  const authorIds = [...new Set(comments.map((c) => c.author_id))];
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, email")
    .in("id", authorIds);

  const commentIds = comments.map((c) => c.id);
  const { data: replyRows } = await supabase
    .from("comments")
    .select("parent_id")
    .eq("organization_id", organizationId)
    .in("parent_id", commentIds)
    .is("deleted_at", null);

  const replyCountByParent = new Map<string, number>();
  for (const r of replyRows || []) {
    const pid = (r as { parent_id: string }).parent_id;
    if (pid) replyCountByParent.set(pid, (replyCountByParent.get(pid) ?? 0) + 1);
  }

  const userMap = new Map((users || []).map((u: any) => [u.id, u]));
  const data: CommentWithAuthor[] = comments.map((c) => ({
    ...c,
    author: userMap.get(c.author_id)
      ? {
          id: c.author_id,
          full_name: (userMap.get(c.author_id) as any)?.full_name ?? null,
          email: (userMap.get(c.author_id) as any)?.email ?? null,
        }
      : undefined,
    mentions: (c.mentions ?? []).map((user_id) => ({ user_id })),
    reply_count: replyCountByParent.get(c.id) ?? 0,
  }));

  return { data };
}

/** Get a parent comment by id scoped to org and optional entity_type/entity_id; excludes deleted. Returns null if not found. */
export async function getParentComment(
  organizationId: string,
  parentId: string,
  entityType?: CommentEntityType,
  entityId?: string
): Promise<CommentRow | null> {
  let query = supabase
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
  if (error || !data) return null;
  return data as CommentRow;
}

/** Create a comment with optional mentions (stored in comments.mentions; sends notifications). Parses body for @[Name](id) as fallback. */
export async function createComment(
  organizationId: string,
  authorId: string,
  params: {
    entity_type: CommentEntityType;
    entity_id: string;
    body: string;
    parent_id?: string | null;
    mention_user_ids?: string[];
  }
): Promise<{ data: CommentRow | null; error: string | null }> {
  const { entity_type, entity_id, body, parent_id, mention_user_ids } = params;

  if (!body || typeof body !== "string" || body.trim().length === 0) {
    return { data: null, error: "Body is required" };
  }
  if (!COMMENT_ENTITY_TYPES.includes(entity_type)) {
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

  const fromText = extractMentionUserIds(body);
  const explicitIds = Array.isArray(mention_user_ids) ? mention_user_ids : [];
  const rawMentionIds = [...new Set([...explicitIds, ...fromText])].filter(
    (id) => id && id !== authorId
  );

  // Only send mention notifications to users in the same organization
  let toMention: string[] = [];
  if (rawMentionIds.length > 0) {
    const { data: orgUsers } = await supabase
      .from("users")
      .select("id")
      .eq("organization_id", organizationId)
      .in("id", rawMentionIds);
    toMention = (orgUsers ?? []).map((u: { id: string }) => u.id);
  }

  const { data: comment, error: insertError } = await supabase
    .from("comments")
    .insert({
      organization_id: organizationId,
      entity_type,
      entity_id,
      parent_id: parent_id ?? null,
      author_id: authorId,
      content: body.trim(),
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
      sendMentionNotification(
        userId,
        organizationId,
        comment.id,
        contextLabel
      ).catch((err) =>
        console.error("[Comments] Mention notification failed:", err)
      );
    }
  }

  return { data: comment as CommentRow, error: null };
}

/** Update comment content (sets edited_at). Re-parses mentions, sends notifications for newly added mentions. Author only. */
export async function updateComment(
  organizationId: string,
  commentId: string,
  body: string,
  userId: string
): Promise<{ data: CommentRow | null; error: string | null }> {
  if (!body || typeof body !== "string" || body.trim().length === 0) {
    return { data: null, error: "Body is required" };
  }

  const { data: existing } = await supabase
    .from("comments")
    .select("id, author_id, organization_id, deleted_at, mentions")
    .eq("id", commentId)
    .eq("organization_id", organizationId)
    .single();

  if (!existing) {
    return { data: null, error: "Comment not found" };
  }
  if ((existing as any).deleted_at) {
    return { data: null, error: "Comment is deleted" };
  }
  const isAuthor = (existing as any).author_id === userId;
  if (!isAuthor) {
    return { data: null, error: "Only the author can update this comment" };
  }

  const fromText = extractMentionUserIds(body.trim());
  const rawMentionIds = fromText.filter((id) => id && id !== userId);

  let mentionUserIds: string[] = [];
  if (rawMentionIds.length > 0) {
    const { data: orgUsers } = await supabase
      .from("users")
      .select("id")
      .eq("organization_id", organizationId)
      .in("id", rawMentionIds);
    mentionUserIds = (orgUsers ?? []).map((u: { id: string }) => u.id);
  }

  const existingMentions: string[] = (existing as any).mentions ?? [];
  const existingSet = new Set(existingMentions);
  const addedMentionIds = mentionUserIds.filter((id) => !existingSet.has(id));

  const now = new Date().toISOString();
  const { data: comment, error } = await supabase
    .from("comments")
    .update({
      content: body.trim(),
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
    sendMentionNotification(
      mentionedUserId,
      organizationId,
      commentId,
      contextLabel
    ).catch((err) =>
      console.error("[Comments] Mention notification (edit) failed:", err)
    );
  }

  return { data: comment as CommentRow, error: null };
}

/** Soft-delete a comment (sets deleted_at and updated_at). No cascade on replies. Caller must ensure author or org admin. */
export async function deleteComment(
  organizationId: string,
  commentId: string
): Promise<{ ok: boolean; error: string | null }> {
  const now = new Date().toISOString();
  const { error } = await supabase
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
export async function getComment(
  organizationId: string,
  commentId: string
): Promise<CommentRow | null> {
  const { data, error } = await supabase
    .from("comments")
    .select()
    .eq("id", commentId)
    .eq("organization_id", organizationId)
    .single();

  if (error || !data) return null;
  return data as CommentRow;
}

/** List comments where the given user is in mentions array. Excludes soft-deleted. */
export async function listCommentsWhereMentioned(
  organizationId: string,
  userId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ data: CommentWithAuthor[] }> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  const offset = Math.max(options.offset ?? 0, 0);

  const { data: comments, error } = await supabase
    .from("comments")
    .select(
      "id, organization_id, entity_type, entity_id, parent_id, author_id, content, mentions, is_resolved, resolved_by, resolved_at, edited_at, deleted_at, created_at, updated_at"
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .contains("mentions", [userId])
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error || !comments?.length) {
    return { data: [] };
  }

  const authorIds = [...new Set((comments as CommentRow[]).map((c) => c.author_id))];
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, email")
    .in("id", authorIds);

  const userMap = new Map((users || []).map((u: any) => [u.id, u]));
  const data: CommentWithAuthor[] = (comments as CommentRow[]).map((c) => ({
    ...c,
    author: userMap.get(c.author_id)
      ? {
          id: c.author_id,
          full_name: (userMap.get(c.author_id) as any)?.full_name ?? null,
          email: (userMap.get(c.author_id) as any)?.email ?? null,
        }
      : undefined,
    mentions: (c.mentions ?? []).map((user_id) => ({ user_id })),
  }));

  return { data };
}

/** Resolve a comment (sets is_resolved, resolved_by, resolved_at). */
export async function resolveComment(
  organizationId: string,
  commentId: string,
  userId: string
): Promise<{ data: CommentRow | null; error: string | null }> {
  const { data: existing } = await supabase
    .from("comments")
    .select("id, deleted_at")
    .eq("id", commentId)
    .eq("organization_id", organizationId)
    .single();

  if (!existing || (existing as any).deleted_at) {
    return { data: null, error: "Comment not found" };
  }

  const now = new Date().toISOString();
  const { data: comment, error } = await supabase
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
  return { data: comment as CommentRow, error: null };
}

/** Unresolve a comment (clears is_resolved, resolved_by, resolved_at). */
export async function unresolveComment(
  organizationId: string,
  commentId: string
): Promise<{ data: CommentRow | null; error: string | null }> {
  const { data: existing } = await supabase
    .from("comments")
    .select("id, deleted_at")
    .eq("id", commentId)
    .eq("organization_id", organizationId)
    .single();

  if (!existing || (existing as any).deleted_at) {
    return { data: null, error: "Comment not found" };
  }

  const now = new Date().toISOString();
  const { data: comment, error } = await supabase
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
  return { data: comment as CommentRow, error: null };
}

/** List replies for a comment. Excludes soft-deleted by default. */
export async function listReplies(
  organizationId: string,
  parentId: string,
  options: { limit?: number; offset?: number; includeDeleted?: boolean } = {}
): Promise<{ data: CommentWithAuthor[] }> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);

  let query = supabase
    .from("comments")
    .select(
      "id, organization_id, entity_type, entity_id, parent_id, author_id, content, mentions, is_resolved, resolved_by, resolved_at, edited_at, deleted_at, created_at, updated_at"
    )
    .eq("organization_id", organizationId)
    .eq("parent_id", parentId)
    .order("created_at", { ascending: true });

  if (options.includeDeleted !== true) {
    query = query.is("deleted_at", null);
  }

  const { data: rows, error } = await query.range(offset, offset + limit - 1);

  if (error) {
    console.error("[Comments] listReplies error:", error);
    return { data: [] };
  }

  const comments = (rows || []) as CommentRow[];
  if (comments.length === 0) {
    return { data: [] };
  }

  const authorIds = [...new Set(comments.map((c) => c.author_id))];
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, email")
    .in("id", authorIds);

  const userMap = new Map((users || []).map((u: any) => [u.id, u]));
  const data: CommentWithAuthor[] = comments.map((c) => ({
    ...c,
    author: userMap.get(c.author_id)
      ? {
          id: c.author_id,
          full_name: (userMap.get(c.author_id) as any)?.full_name ?? null,
          email: (userMap.get(c.author_id) as any)?.email ?? null,
        }
      : undefined,
    mentions: (c.mentions ?? []).map((user_id) => ({ user_id })),
  }));

  return { data };
}
