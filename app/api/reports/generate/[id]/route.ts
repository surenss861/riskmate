import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buildJobReport } from '@/lib/utils/jobReport'
// Import PDF generator from lib utils (copied from backend)
import { generateRiskSnapshotPDF } from '@/lib/utils/pdf'
import { stampPdf } from '@/lib/utils/pdf/stamp'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'

// Debug helper to check where PDFKit font files exist
function checkFontPaths() {
  const cwd = process.cwd()
  const candidates = [
    path.join(cwd, 'assets/pdfkit/Helvetica.afm'),
    path.join(cwd, 'node_modules/pdfkit/js/data/Helvetica.afm'),
    path.join(cwd, '.next/server/chunks/data/Helvetica.afm'),
    '/var/task/assets/pdfkit/Helvetica.afm',
    '/var/task/node_modules/pdfkit/js/data/Helvetica.afm',
    '/var/task/.next/server/chunks/data/Helvetica.afm',
  ]

  const results: Record<string, boolean> = {}
  for (const candidate of candidates) {
    try {
      results[candidate] = fs.existsSync(candidate)
    } catch {
      results[candidate] = false
    }
  }

  console.log('[pdf] cwd:', cwd)
  console.log('[pdf] Font path check results:', JSON.stringify(results, null, 2))

  // Set PDFKit data directory to our controlled assets folder
  const assetsPath = path.join(cwd, 'assets/pdfkit')
  if (fs.existsSync(assetsPath)) {
    process.env.PDFKIT_DATA_DIR = assetsPath
    console.log('[pdf] Set PDFKIT_DATA_DIR to:', assetsPath)
  } else {
    console.warn('[pdf] assets/pdfkit directory not found, PDFKit will use default location')
  }

  return results
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's organization_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.organization_id) {
      return NextResponse.json(
        { message: 'Failed to get organization ID' },
        { status: 500 }
      )
    }

    const organization_id = userData.organization_id
    const userId = user.id
    const { id: jobId } = await params

    let reportData
    try {
      reportData = await buildJobReport(organization_id, jobId)
    } catch (err: any) {
      if (err?.message === 'Job not found') {
        return NextResponse.json(
          { message: 'Job not found' },
          { status: 404 }
        )
      }
      throw err
    }

    if (!reportData?.job) {
      return NextResponse.json(
        { message: 'Job not found' },
        { status: 404 }
      )
    }

    // Get photos for PDF
    const photoDocuments = (reportData.documents ?? []).filter(
      (doc) => doc.type === 'photo' && doc.file_path
    )

    const photos = (
      await Promise.all(
        photoDocuments.map(async (document: any) => {
          try {
            const { data: fileData } = await supabase.storage
              .from('documents')
              .download(document.file_path)

            if (!fileData) {
              return null
            }

            const arrayBuffer = await fileData.arrayBuffer()
            return {
              name: document.name,
              description: document.description,
              created_at: document.created_at,
              buffer: Buffer.from(arrayBuffer),
            }
          } catch (error) {
            console.warn('Failed to include photo in PDF', error)
            return null
          }
        })
      )
    ).filter((item): item is NonNullable<typeof item> => item !== null)

    // Debug: Check font paths before generating PDF
    checkFontPaths()

    // Generate PDF
    let pdfBuffer: Buffer
    try {
      pdfBuffer = await generateRiskSnapshotPDF(
        reportData.job,
        reportData.risk_score,
        reportData.mitigations || [],
        reportData.organization ?? {
          id: organization_id,
          name: reportData.job?.client_name ?? 'Organization',
        },
        photos,
        reportData.audit || []
      )
    } catch (pdfError: any) {
      console.error('[reports] generate failed:', pdfError)
      console.error('[reports] generate failed stack:', pdfError?.stack)
      throw new Error(`PDF generation failed: ${pdfError?.message || String(pdfError)}`)
    }

    const hash = crypto.createHash('sha256').update(pdfBuffer).digest('hex')
    const pdfBase64 = pdfBuffer.toString('base64')

    // Save report snapshot
    const { data: snapshot, error: snapshotError } = await supabase
      .from('report_snapshots')
      .insert({
        job_id: jobId,
        organization_id,
        payload: reportData,
        hash,
      })
      .select()
      .single()

    if (snapshotError) {
      console.error('Snapshot save failed:', snapshotError)
      // Continue even if snapshot save fails
    }

    // Ensure reports bucket exists
    try {
      const { data: bucket } = await supabase.storage.getBucket('reports')
      if (!bucket) {
        await supabase.storage.createBucket('reports', {
          public: false,
          fileSizeLimit: 50 * 1024 * 1024,
        })
      }
    } catch (bucketError) {
      console.warn('Bucket check/create failed:', bucketError)
    }

    // Upload PDF to storage
    const storagePath = `${organization_id}/${jobId}/${hash}.pdf`
    let pdfUrl: string | null = null

    try {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('reports')
        .upload(storagePath, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true,
        })

      if (!uploadError && uploadData) {
        const { data: signed } = await supabase.storage
          .from('reports')
          .createSignedUrl(storagePath, 60 * 60 * 24 * 365) // 1 year

        pdfUrl = signed?.signedUrl || null
      }
    } catch (uploadError) {
      console.warn('PDF upload failed:', uploadError)
    }

    // Save or update report record
    const { data: existingReport } = await supabase
      .from('reports')
      .select('id')
      .eq('job_id', jobId)
      .maybeSingle()

    const reportPayload = {
      job_id: jobId,
      organization_id,
      pdf_url: pdfUrl,
      storage_path: storagePath,
      hash,
      pdf_base64: pdfBase64,
      generated_at: new Date().toISOString(),
      snapshot_id: snapshot?.id || null,
    }

    let reportRecord
    if (existingReport) {
      const { data: updated } = await supabase
        .from('reports')
        .update(reportPayload)
        .eq('id', existingReport.id)
        .select()
        .single()

      reportRecord = updated
    } else {
      const { data: inserted } = await supabase
        .from('reports')
        .insert(reportPayload)
        .select()
        .single()

      reportRecord = inserted
    }

    return NextResponse.json({
      data: {
        id: reportRecord?.id || null,
        pdf_url: pdfUrl,
        storage_path: storagePath,
        hash,
        pdf_base64: pdfBase64,
        generated_at: reportPayload.generated_at,
        snapshot_id: snapshot?.id || null,
      },
    })
  } catch (error: any) {
    console.error('[reports] generate failed in route handler:', error)
    console.error('[reports] generate failed stack:', error?.stack)
    return NextResponse.json(
      {
        message: 'Failed to generate PDF report',
        detail: error?.message ?? String(error),
      },
      { status: 500 }
    )
  }
}

