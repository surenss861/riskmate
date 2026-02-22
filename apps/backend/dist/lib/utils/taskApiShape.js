"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapTaskToApiShape = mapTaskToApiShape;
/**
 * Maps a task row from Supabase (with optional assignee:assigned_to join) to the
 * API contract: assigned_user set, assignee omitted.
 */
function mapTaskToApiShape(row) {
    const { assignee, ...rest } = row;
    const assigned_user = assignee && typeof assignee === 'object' && 'id' in assignee
        ? {
            id: assignee.id,
            full_name: assignee.full_name ?? null,
            email: assignee.email ?? null,
        }
        : null;
    return { ...rest, assigned_user };
}
//# sourceMappingURL=taskApiShape.js.map