/**
 * Web Realtime Event Subscription
 * 
 * Subscribes to Supabase Realtime events and invalidates SWR cache
 * Same debounce/coalesce pattern as iOS for consistency
 */

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Debounce/coalesce state
let pendingEvents: Map<string, number> = new Map();
let debounceTimer: NodeJS.Timeout | null = null;
const debounceInterval = 500; // 500ms

// Last seen event timestamp (for catch-up)
const LAST_SEEN_EVENT_AT_KEY = "realtime_last_seen_event_at";

/** Channel ID for job activity (audit_logs where target_id = jobId). Must match subscribe route. */
export function getJobActivityChannelId(jobId: string): string {
  return `job-activity-${jobId}`;
}

/**
 * Subscribe to realtime audit_logs for a specific job (target_id = jobId).
 * Use after POST /api/jobs/[id]/activity/subscribe to get channelId, or call directly with jobId.
 * Returns unsubscribe function.
 */
export function subscribeToJobActivity(
  jobId: string,
  onEvent?: (payload: { new: Record<string, unknown> }) => void
) {
  const supabase = createSupabaseBrowserClient();
  const channelId = getJobActivityChannelId(jobId);
  const channel = supabase.channel(channelId);

  channel
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "audit_logs",
        filter: `target_id=eq.${jobId}`,
      },
      (payload) => {
        if (onEvent) onEvent(payload as { new: Record<string, unknown> });
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("[RealtimeJobActivity] ✅ Subscribed to audit_logs for job:", jobId);
      } else if (status === "CHANNEL_ERROR") {
        console.error("[RealtimeJobActivity] ❌ Channel error for job:", jobId);
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to realtime events for an organization
 */
export function subscribeToRealtimeEvents(
  organizationId: string,
  onEvent?: (eventType: string, entityType: string, entityId?: string) => void
) {
  const supabase = createSupabaseBrowserClient();

  // Create channel for org events
  const channelName = `org-${organizationId}-events`;
  const channel = supabase.channel(channelName);

  // Subscribe to postgres changes on realtime_events table
  // Filter by organization_id to only get events for this org
  channel
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "realtime_events",
        filter: `organization_id=eq.${organizationId}`,
      },
      (payload) => {
        handleEvent(payload.new as any, onEvent);
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("[RealtimeEvents] ✅ Subscribed to events for org:", organizationId);
      } else if (status === "CHANNEL_ERROR") {
        console.error("[RealtimeEvents] ❌ Channel error for org:", organizationId);
      }
    });

  return () => {
    // Unsubscribe function
    supabase.removeChannel(channel);
  };
}

/**
 * Handle incoming realtime event (with debounce/coalesce)
 */
function handleEvent(
  event: {
    event_type: string;
    entity_type: string;
    entity_id?: string;
    created_at: string;
  },
  onEvent?: (eventType: string, entityType: string, entityId?: string) => void
) {
  const { event_type, entity_type, entity_id } = event;
  
  console.log("[RealtimeEvents] 📨 Received event:", event_type, entity_type, entity_id || "none");

  // Update last seen timestamp (for catch-up)
  if (typeof window !== "undefined") {
    localStorage.setItem(LAST_SEEN_EVENT_AT_KEY, new Date().toISOString());
  }

  // Create coalesce key: eventType + entityId (prevents duplicate refreshes for same entity)
  const coalesceKey = `${event_type}:${entity_id || "none"}`;
  const now = Date.now();

  // Update pending events map
  pendingEvents.set(coalesceKey, now);

  // Cancel existing debounce timer
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  // Start new debounce timer
  debounceTimer = setTimeout(() => {
    processPendingEvents(onEvent);
  }, debounceInterval);
}

/**
 * Process pending events (after debounce)
 */
function processPendingEvents(
  onEvent?: (eventType: string, entityType: string, entityId?: string) => void
) {
  const eventsToProcess = new Map(pendingEvents);
  pendingEvents.clear();

  // Group by entity to avoid duplicate refreshes
  const entityRefreshes = new Set<string>(); // "entityType:entityId"

  for (const [coalesceKey] of eventsToProcess) {
    const parts = coalesceKey.split(":");
    if (parts.length < 2) continue;

    const eventType = parts[0];
    const entityId = parts.length > 1 ? parts[1] : undefined;

    // Determine entity type from event type
    let entityType: string;
    if (eventType.includes("job")) {
      entityType = "job";
    } else if (eventType.includes("evidence") || eventType.includes("document")) {
      entityType = "evidence";
    } else if (eventType.includes("audit")) {
      entityType = "audit";
    } else {
      continue; // Skip unknown event types
    }

    const entityKey = `${entityType}:${entityId || "all"}`;

    // Only refresh once per entity (coalesce)
    if (!entityRefreshes.has(entityKey)) {
      entityRefreshes.add(entityKey);
      
      // Call callback (for SWR cache invalidation)
      if (onEvent) {
        onEvent(eventType, entityType, entityId);
      }
    }
  }
}

/**
 * Get last seen event timestamp (for catch-up)
 */
export function getLastSeenEventAt(): Date | null {
  if (typeof window === "undefined") return null;
  
  const timestamp = localStorage.getItem(LAST_SEEN_EVENT_AT_KEY);
  return timestamp ? new Date(timestamp) : null;
}

/**
 * Clear last seen timestamp
 */
export function clearLastSeenEventAt() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(LAST_SEEN_EVENT_AT_KEY);
  }
}
