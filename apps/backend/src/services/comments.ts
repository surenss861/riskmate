import { supabase } from "../lib/supabaseClient";
import { sendMentionNotification } from "./notifications";

export const COMMENT_ENTITY_TYPES = [
  "job",
  "hazard",
  "control",
  "task",
  "document",
  "signoff",
] as const;
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
  author?: { id: string; full_name: string | null; email: string | null };
  mentions?: { user_id: string }[];
}

export interface ListCommentsOptions {
  limit?: number;
  offset?: number;
  includeReplies?: boolean;
}

/** List comments for an entity. Returns flat list (replies have parent_id set). */
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
      "id, organization_id, entity_type, entity_id, parent_id, author_id, body, created_at, updated_at"
    )
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
  const { data: mentionRows } = await supabase
    .from("comment_mentions")
    .select("comment_id, user_id")
    .in("comment_id", commentIds);

  const userMap = new Map((users || []).map((u: any) => [u.id, u]));
  const mentionsByComment = new Map<string, { user_id: string }[]>();
  for (const m of mentionRows || []) {
    const list = mentionsByComment.get((m as any).comment_id) ?? [];
    list.push({ user_id: (m as any).user_id });
    mentionsByComment.set((m as any).comment_id, list);
  }

  const data: CommentWithAuthor[] = comments.map((c) => ({
    ...c,
    author: userMap.get(c.author_id)
      ? {
          id: c.author_id,
          full_name: (userMap.get(c.author_id) as any)?.full_name ?? null,
          email: (userMap.get(c.author_id) as any)?.email ?? null,
        }
      : undefined,
    mentions: mentionsByComment.get(c.id) ?? [],
  }));

  return { data };
}

/** Create a comment and optionally mention users (sends notifications). */
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

  const { data: comment, error: insertError } = await supabase
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

  const toMention = (mention_user_ids ?? []).filter(
    (id) => id && id !== authorId
  );
  if (toMention.length > 0) {
    await supabase.from("comment_mentions").insert(
      toMention.map((user_id) => ({
        comment_id: comment.id,
        user_id,
      }))
    );

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

/** Update comment body (caller must ensure author or admin). */
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
    .select("id, author_id, organization_id")
    .eq("id", commentId)
    .eq("organization_id", organizationId)
    .single();

  if (!existing) {
    return { data: null, error: "Comment not found" };
  }
  if ((existing as any).author_id !== userId) {
    return { data: null, error: "Only the author can update this comment" };
  }

  const { data: comment, error } = await supabase
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
  return { data: comment as CommentRow, error: null };
}

/** Delete a comment (caller must ensure author or org admin). */
export async function deleteComment(
  organizationId: string,
  commentId: string
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabase
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

/** List comments where the given user is mentioned (for notification center). */
export async function listCommentsWhereMentioned(
  organizationId: string,
  userId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ data: CommentWithAuthor[] }> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  const offset = Math.max(options.offset ?? 0, 0);

  const { data: mentionRows, error: mentionError } = await supabase
    .from("comment_mentions")
    .select("comment_id")
    .eq("user_id", userId);

  if (mentionError || !mentionRows?.length) {
    return { data: [] };
  }

  const commentIds = [...new Set((mentionRows as any[]).map((r) => r.comment_id))];
  const { data: comments, error } = await supabase
    .from("comments")
    .select("id, organization_id, entity_type, entity_id, parent_id, author_id, body, created_at, updated_at")
    .eq("organization_id", organizationId)
    .in("id", commentIds)
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

  const { data: mentionRows2 } = await supabase
    .from("comment_mentions")
    .select("comment_id, user_id")
    .in("comment_id", (comments as CommentRow[]).map((c) => c.id));

  const userMap = new Map((users || []).map((u: any) => [u.id, u]));
  const mentionsByComment = new Map<string, { user_id: string }[]>();
  for (const m of mentionRows2 || []) {
    const list = mentionsByComment.get((m as any).comment_id) ?? [];
    list.push({ user_id: (m as any).user_id });
    mentionsByComment.set((m as any).comment_id, list);
  }

  const data: CommentWithAuthor[] = (comments as CommentRow[]).map((c) => ({
    ...c,
    author: userMap.get(c.author_id)
      ? {
          id: c.author_id,
          full_name: (userMap.get(c.author_id) as any)?.full_name ?? null,
          email: (userMap.get(c.author_id) as any)?.email ?? null,
        }
      : undefined,
    mentions: mentionsByComment.get(c.id) ?? [],
  }));

  return { data };
}
