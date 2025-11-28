import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext, verifyJobOwnership } from '@/lib/utils/organizationGuard'

export const runtime = 'nodejs'

/**
 * GET /api/jobs/[id]/permit-packs
 * List all generated permit packs for a job
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { organization_id } = await getOrganizationContext()
    const { id: jobId } = await params

    await verifyJobOwnership(jobId, organization_id)

    const supabase = await createSupabaseServerClient()

    // Get all permit packs (job_reports) for this job
    const { data: permitPacks, error } = await supabase
      .from('job_reports')
      .select('id, version, file_path, generated_at, generated_by')
      .eq('job_id', jobId)
      .eq('organization_id', organization_id)
      .order('generated_at', { ascending: false })

    if (error) {
      throw error
    }

    // Generate signed URLs for each permit pack
    const permitPacksWithUrls = await Promise.all(
      (permitPacks || []).map(async (pack) => {
        try {
          // Check if file path contains 'permit-packs' to identify permit packs
          if (pack.file_path && pack.file_path.includes('permit-packs')) {
            const { data: signedUrlData } = await supabase.storage
              .from('documents')
              .createSignedUrl(pack.file_path, 3600) // 1 hour validity

            return {
              id: pack.id,
              version: pack.version,
              file_path: pack.file_path,
              generated_at: pack.generated_at,
              generated_by: pack.generated_by,
              downloadUrl: signedUrlData?.signedUrl || null,
            }
          }
          return null
        } catch (error) {
          console.warn(`Failed to generate signed URL for permit pack ${pack.id}:`, error)
          return {
            id: pack.id,
            version: pack.version,
            file_path: pack.file_path,
            generated_at: pack.generated_at,
            generated_by: pack.generated_by,
            downloadUrl: null,
          }
        }
      })
    )

    // Filter out nulls and only return permit packs
    const validPermitPacks = permitPacksWithUrls.filter(
      (pack): pack is NonNullable<typeof pack> => pack !== null
    )

    return NextResponse.json({
      data: validPermitPacks,
    })
  } catch (error: any) {
    console.error('Failed to fetch permit packs:', error)
    return NextResponse.json(
      { message: 'Failed to fetch permit packs' },
      { status: 500 }
    )
  }
}

