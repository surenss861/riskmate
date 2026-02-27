'use client';

import { useState, useCallback, useEffect } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const roleCache = new Map<string, { role: string; ts: number }>();

function getCachedRole(userId: string): string | null {
  const entry = roleCache.get(userId);
  if (!entry || Date.now() - entry.ts > CACHE_TTL_MS) return null;
  return entry.role;
}

function setCachedRole(userId: string, role: string): void {
  roleCache.set(userId, { role, ts: Date.now() });
}

/**
 * Fetches and caches the current user's role from the users table.
 * Cache is shared across page navigations to avoid redundant Supabase calls.
 */
export function useUserRole() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    const supabase = createSupabaseBrowserClient();
    const { data: { user: u } } = await supabase.auth.getUser();
    setUser(u ?? null);
    if (!u) {
      setUserRole(null);
      return;
    }
    const cached = getCachedRole(u.id);
    if (cached !== null) {
      setUserRole(cached);
      return;
    }
    const { data: userRow, error: err } = await supabase
      .from('users')
      .select('role')
      .eq('id', u.id)
      .maybeSingle();
    if (err) {
      setError(true);
      setUserRole(null);
      return;
    }
    if (userRow?.role != null && userRow.role !== '') {
      setUserRole(userRow.role);
      setCachedRole(u.id, userRow.role);
    } else {
      setError(true);
      setUserRole(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { user, userRole, roleFetchError: error, refetchRole: load };
}
