/**
 * React hook for fetching entitlements
 * 
 * Returns the same shape as backend entitlements object.
 * Ensures UI and backend read the same entitlement shape.
 */

import useSWR from 'swr'
import type { Entitlements } from '@/lib/entitlements'

const fetcher = async (url: string): Promise<Entitlements> => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to fetch entitlements')
  }
  const data = await response.json()
  return data.data
}

export function useEntitlements() {
  const { data, error, isLoading, mutate } = useSWR<Entitlements>(
    '/api/org/entitlements',
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 2000, // Dedupe requests within 2s
    }
  )

  return {
    entitlements: data,
    isLoading,
    isError: error,
    mutate, // For manual revalidation
  }
}

