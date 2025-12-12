/**
 * Caching layer for RiskMate using SWR
 * Org-scoped cache keys with stale-while-revalidate pattern
 */

import useSWR, { SWRConfiguration, mutate } from 'swr'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { riskApi, subscriptionsApi } from '@/lib/api'

// Cache key builders (org-scoped)
export const cacheKeys = {
  riskFactors: (orgId?: string) => orgId ? `risk_factors:${orgId}` : 'risk_factors',
  templates: (orgId: string, type: 'hazard' | 'job') => `templates:${orgId}:${type}`,
  user: (userId: string) => `user:${userId}`,
  org: (orgId: string) => `org:${orgId}`,
  permissions: (orgId: string, userId: string) => `permissions:${orgId}:${userId}`,
  plan: (orgId: string) => `plan:${orgId}`,
}

// Cache configuration
const cacheConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 2000, // Dedupe requests within 2s
}

// Long-lived cache for static data (30-120 min stale, 24h cache)
const staticCacheConfig: SWRConfiguration = {
  ...cacheConfig,
  revalidateIfStale: true,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: 60000, // 1 minute
  // Keep in cache for 24 hours
  keepPreviousData: true,
}

// Fetchers
const fetchers = {
  riskFactors: async () => {
    const response = await riskApi.getFactors()
    return response.data
  },
  
  templates: async (orgId: string, type: 'hazard' | 'job') => {
    const supabase = createSupabaseBrowserClient()
    const table = type === 'hazard' ? 'hazard_templates' : 'job_templates'
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('organization_id', orgId)
      .eq('archived', false)
    if (error) throw error
    return data || []
  },
  
  user: async (userId: string) => {
    const supabase = createSupabaseBrowserClient()
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) throw error
    return data
  },
  
  org: async (orgId: string) => {
    const supabase = createSupabaseBrowserClient()
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .single()
    if (error) throw error
    return data
  },
  
  permissions: async (orgId: string, userId: string) => {
    const supabase = createSupabaseBrowserClient()
    const { data: userData } = await supabase
      .from('users')
      .select('role, organization_id')
      .eq('id', userId)
      .eq('organization_id', orgId)
      .single()
    return {
      role: userData?.role || 'member',
      canManage: userData?.role === 'owner' || userData?.role === 'admin',
    }
  },
  
  plan: async (orgId: string) => {
    const response = await subscriptionsApi.get()
    return response.data
  },
}

// Hooks
export function useRiskFactors(orgId?: string) {
  const { data, error, isLoading } = useSWR(
    cacheKeys.riskFactors(orgId),
    fetchers.riskFactors,
    {
      ...staticCacheConfig,
      // Risk factors are global, cache for 2 hours
      revalidateIfStale: false,
    }
  )
  return { data: data || [], error, isLoading }
}

export function useTemplates(orgId: string | null, type: 'hazard' | 'job') {
  const { data, error, isLoading } = useSWR(
    orgId ? cacheKeys.templates(orgId, type) : null,
    orgId ? () => fetchers.templates(orgId, type) : null,
    {
      ...staticCacheConfig,
      // Templates cache for 30 minutes
      revalidateIfStale: true,
    }
  )
  return { data: data || [], error, isLoading }
}

export function useUser(userId: string | null) {
  const { data, error, isLoading } = useSWR(
    userId ? cacheKeys.user(userId) : null,
    userId ? () => fetchers.user(userId) : null,
    {
      ...staticCacheConfig,
      // User data cache for 1 hour
      revalidateIfStale: true,
    }
  )
  return { data, error, isLoading }
}

export function useOrg(orgId: string | null) {
  const { data, error, isLoading } = useSWR(
    orgId ? cacheKeys.org(orgId) : null,
    orgId ? () => fetchers.org(orgId) : null,
    {
      ...staticCacheConfig,
      // Org data cache for 1 hour
      revalidateIfStale: true,
    }
  )
  return { data, error, isLoading }
}

export function usePermissions(orgId: string | null, userId: string | null) {
  const { data, error, isLoading } = useSWR(
    orgId && userId ? cacheKeys.permissions(orgId, userId) : null,
    orgId && userId ? () => fetchers.permissions(orgId, userId) : null,
    {
      ...staticCacheConfig,
      // Permissions cache for 30 minutes
      revalidateIfStale: true,
    }
  )
  return { data, error, isLoading }
}

export function usePlan(orgId: string | null) {
  const { data, error, isLoading } = useSWR(
    orgId ? cacheKeys.plan(orgId) : null,
    orgId ? () => fetchers.plan(orgId) : null,
    {
      ...staticCacheConfig,
      // Plan cache for 1 hour
      revalidateIfStale: true,
    }
  )
  return { data, error, isLoading }
}

// Invalidation helpers
export const cacheInvalidation = {
  // Invalidate templates when created/edited/archived
  templates: (orgId: string) => {
    mutate(cacheKeys.templates(orgId, 'hazard'))
    mutate(cacheKeys.templates(orgId, 'job'))
  },
  
  // Invalidate everything on org switch
  org: (orgId: string) => {
    // Invalidate all org-scoped caches
    mutate((key) => typeof key === 'string' && key.includes(orgId))
  },
  
  // Clear entire cache on logout
  clearAll: () => {
    mutate(() => true, undefined, { revalidate: false })
  },
  
  // Invalidate permissions and plan on role/plan change
  permissions: (orgId: string, userId: string) => {
    mutate(cacheKeys.permissions(orgId, userId))
    mutate(cacheKeys.plan(orgId))
  },
  
  // Invalidate plan only
  plan: (orgId: string) => {
    mutate(cacheKeys.plan(orgId))
  },
}

