import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/verify/[reportId]
 * Verification endpoint for Executive Brief PDFs
 * Returns metadata hash, PDF file hash, and report metadata for auditor verification
 * 
 * Report ID format: RM-xxxx (8 char short ID) or full UUID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId: reportIdParam } = await params
    
    // Extract report ID (handle both "RM-xxxx" and full UUID formats)
    let reportId: string
    if (reportIdParam.startsWith('RM-')) {
      // Short format: need to look up full UUID from report_runs
      const shortId = reportIdParam.substring(3) // Remove "RM-" prefix
      const supabase = await createSupabaseServerClient()
      
      // Find report run by matching the short ID (first 8 chars of UUID)
      const { data: reportRun, error: lookupError } = await supabase
        .from('report_runs')
        .select('id, organization_id, generated_at, metadata, completed_hash')
        .like('id', `${shortId}%`)
        .eq('packet_type', 'executive_brief')
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (lookupError || !reportRun) {
        return NextResponse.json(
          { message: 'Report not found' },
          { status: 404 }
        )
      }
      
      reportId = reportRun.id
    } else {
      // Full UUID format
      reportId = reportIdParam
    }
    
    const supabase = await createSupabaseServerClient()
    
    // Get report run metadata (look for packet_type = 'executive_brief')
    const { data: reportRun, error: runError } = await supabase
      .from('report_runs')
      .select('id, organization_id, generated_at, metadata, completed_hash, storage_path')
      .eq('id', reportId)
      .eq('packet_type', 'executive_brief')
      .single()
    
    if (runError || !reportRun) {
      return NextResponse.json(
        { message: 'Report not found' },
        { status: 404 }
      )
    }
    
    // Get organization name
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', reportRun.organization_id)
      .single()
    
    // Extract metadata from report_run
    const metadata = reportRun.metadata as {
      time_window_start?: string
      time_window_end?: string
      metadata_hash?: string
      pdf_hash?: string
      [key: string]: any
    } || {}
    
    const windowStart = metadata.time_window_start 
      ? new Date(metadata.time_window_start)
      : new Date(reportRun.generated_at)
    const windowEnd = metadata.time_window_end
      ? new Date(metadata.time_window_end)
      : new Date(reportRun.generated_at)
    
    // Get metadata hash (deterministic hash displayed in PDF)
    const metadataHashDeterministic = metadata.metadata_hash || reportRun.completed_hash || null
    
    // Get PDF file hash (SHA-256 of actual PDF bytes)
    // Stored in metadata.pdf_hash at generation time, or compute from storage if available
    let pdfFileHash: string | null = metadata.pdf_hash || null
    
    // If not in metadata, try to compute from stored PDF
    if (!pdfFileHash && reportRun.storage_path) {
      try {
        // Download PDF from storage
        const { data: pdfData, error: storageError } = await supabase.storage
          .from('reports')
          .download(reportRun.storage_path)
        
        if (!storageError && pdfData) {
          // Convert blob to buffer
          const arrayBuffer = await pdfData.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)
          
          // Compute SHA-256 of PDF bytes
          pdfFileHash = crypto.createHash('sha256').update(buffer).digest('hex')
        }
      } catch (err) {
        console.error('[verify] Failed to compute PDF file hash:', err)
        // Continue without PDF file hash if storage retrieval fails
      }
    }
    
    // Return verification payload
    return NextResponse.json({
      reportId: `RM-${reportId.substring(0, 8)}`,
      org: org?.name || null,
      organizationId: reportRun.organization_id,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      generatedAt: new Date(reportRun.generated_at).toISOString(),
      metadataHashDeterministic,
      pdfFileHash,
      verifiedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[verify] Error:', error)
    return NextResponse.json(
      { message: 'Internal server error', detail: error?.message },
      { status: 500 }
    )
  }
}

