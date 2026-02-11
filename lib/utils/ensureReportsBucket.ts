import type { SupabaseClient } from '@supabase/supabase-js'

const REPORTS_BUCKET = 'reports'
const FILE_SIZE_LIMIT = 50 * 1024 * 1024

/**
 * Ensures the `reports` storage bucket exists. If it does not, creates it.
 * Throws on failure so callers can surface a 500 with a clear error.
 */
export async function ensureReportsBucketExists(
  supabase: SupabaseClient
): Promise<void> {
  const { data: bucket } = await supabase.storage.getBucket(REPORTS_BUCKET)
  if (bucket) return

  const { error: createError } = await supabase.storage.createBucket(
    REPORTS_BUCKET,
    {
      public: false,
      fileSizeLimit: FILE_SIZE_LIMIT,
    }
  )

  if (createError) {
    throw new Error(
      `Reports bucket unavailable: ${createError.message} (code: ${(createError as any).statusCode ?? createError.name ?? 'UNKNOWN'})`
    )
  }
}
