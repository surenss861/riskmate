import type { createSupabaseServerClient } from '@/lib/supabase/server'

const DEFAULT_SELECT = 'id, organization_id'

/**
 * Fetch a webhook endpoint by ID and verify the user's org membership.
 * Returns the endpoint row or null if not found or not authorized.
 */
export async function getEndpointAndCheckOrg(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  endpointId: string,
  organizationIds: string[],
  select: string = DEFAULT_SELECT
): Promise<{ id: string; organization_id: string; [k: string]: unknown } | null> {
  const { data, error } = await supabase
    .from('webhook_endpoints')
    .select(select)
    .eq('id', endpointId)
    .single()
  if (error || !data) return null
  const row = data as unknown as { id: string; organization_id: string; [k: string]: unknown }
  if (!organizationIds.includes(row.organization_id)) return null
  return row
}
