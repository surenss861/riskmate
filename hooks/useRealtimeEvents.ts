/**
 * React hook for Supabase Realtime events
 * 
 * Subscribes to events and invalidates SWR cache for affected entities
 */

import { useEffect, useState } from "react";
import { useSWRConfig } from "swr";
import { useRouter, usePathname } from "next/navigation";
import { subscribeToRealtimeEvents, getLastSeenEventAt } from "@/lib/realtime/eventSubscription";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function useRealtimeEvents() {
  const { mutate } = useSWRConfig();
  const pathname = usePathname();
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  // Fetch organization ID from user
  useEffect(() => {
    const fetchOrgId = async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: userRow } = await supabase
          .from("users")
          .select("organization_id")
          .eq("id", user.id)
          .maybeSingle();
        
        setOrganizationId(userRow?.organization_id || null);
      }
    };

    fetchOrgId();
  }, []);

  useEffect(() => {
    if (!organizationId) return;

    // Catch-up: if we missed events while away, refresh once
    const lastSeen = getLastSeenEventAt();
    const minutesSinceLastSeen = lastSeen
      ? (Date.now() - lastSeen.getTime()) / (1000 * 60)
      : Infinity;

    // If more than 5 minutes since last event, do catch-up refresh
    if (minutesSinceLastSeen > 5) {
      // Invalidate jobs list cache
      mutate("/api/jobs");
    }

    // Subscribe to realtime events
    const unsubscribe = subscribeToRealtimeEvents(organizationId, (eventType, entityType, entityId) => {
      console.log("[useRealtimeEvents] 🔔 Event:", eventType, entityType, entityId);

      // Invalidate SWR cache for affected entities
      switch (entityType) {
        case "job":
          // Invalidate jobs list
          mutate("/api/jobs");
          // If job detail is open for this job, refresh it too
          if (entityId && pathname?.includes(`/jobs/${entityId}`)) {
            mutate(`/api/jobs/${entityId}`);
          }
          break;

        case "evidence":
          // Evidence upload affects jobs list (evidence count)
          mutate("/api/jobs");
          // If viewing job detail, refresh evidence list
          if (entityId && pathname?.includes(`/jobs/`)) {
            const jobIdMatch = pathname.match(/\/jobs\/([^\/]+)/);
            if (jobIdMatch) {
              mutate(`/api/jobs/${jobIdMatch[1]}/documents`);
            }
          }
          break;

        case "audit":
          // Audit events - invalidate audit feed if open
          if (pathname?.includes("/audit")) {
            mutate("/api/audit/events");
          }
          break;

        default:
          break;
      }
    });

    // Cleanup on unmount
    return () => {
      unsubscribe();
    };
  }, [organizationId, mutate, pathname]);
}
