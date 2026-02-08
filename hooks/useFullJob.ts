'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { jobsApi } from '@/lib/api'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { JobReportData } from '@/types/report'

type FullJobPayload = JobReportData

interface UseFullJobResult {
  data: FullJobPayload | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

const TABLES_TO_WATCH = [
  { table: 'jobs', filterKey: 'id' },
  { table: 'job_risk_scores', filterKey: 'job_id' },
  { table: 'mitigation_items', filterKey: 'job_id' },
  { table: 'documents', filterKey: 'job_id' },
  { table: 'job_photos', filterKey: 'job_id' },
  { table: 'audit_logs', filterKey: 'target_id' },
] as const

export function useFullJob(jobId: string | null | undefined): UseFullJobResult {
  const [data, setData] = useState<FullJobPayload | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const supabaseRef = useRef<ReturnType<typeof createSupabaseBrowserClient> | null>(null)

  const fetchJob = useCallback(async () => {
    if (!jobId) return
    setIsLoading(true)
    setError(null)
    try {
      const payload = await jobsApi.full(jobId)
      setData(payload)
    } catch (err: any) {
      setError(err)
    } finally {
      setIsLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    fetchJob()
  }, [fetchJob])

  useEffect(() => {
    if (!jobId) return

    const supabase =
      supabaseRef.current ?? (supabaseRef.current = createSupabaseBrowserClient())
    const channel = supabase.channel(`job-report-${jobId}`)

    const handleChange = () => {
      fetchJob()
    }

    TABLES_TO_WATCH.forEach(({ table, filterKey }) => {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter:
            table === 'jobs'
              ? `id=eq.${jobId}`
              : filterKey === 'target_id'
              ? `target_id=eq.${jobId}`
              : `${filterKey}=eq.${jobId}`,
        },
        handleChange
      )
    })

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchJob, jobId])

  const result = useMemo<UseFullJobResult>(
    () => ({
      data,
      isLoading,
      error,
      refetch: fetchJob,
    }),
    [data, isLoading, error, fetchJob]
  )

  return result
}


