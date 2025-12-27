import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { chromium } from 'playwright'
import crypto from 'crypto'

export const runtime = 'nodejs'
// Set max duration to handle browser launch and navigation
export const maxDuration = 60

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
    const { id: jobId } = await params

    // Prepare URL for the print page
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const host = request.headers.get('host')
    const origin = `${protocol}://${host}`
    const printUrl = `${origin}/reports/${jobId}/print`

    console.log('[reports] Generating PDF from:', printUrl)

    // Launch Playwright
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none']
    })

    let pdfBuffer: Buffer
    try {
      const context = await browser.newContext()

      // Forward cookies to share authentication session
      const cookies = request.cookies.getAll().map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: host?.split(':')[0] || 'localhost',
        path: '/',
      }))

      if (cookies.length > 0) {
        await context.addCookies(cookies)
      }

      const page = await context.newPage()

      // Navigate to the print page
      await page.goto(printUrl, { waitUntil: 'networkidle' })

      // Wait specifically for the cover page to ensure React has fully hydrated/rendered
      await page.waitForSelector('.cover-page', { timeout: 10000 })

      // Generate PDF
      // preferCSSPageSize: true allows our @page CSS to control size/margins
      pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
      })

    } catch (browserError: any) {
      console.error('[reports] Playwright failed:', browserError)
      throw new Error(`Browser generation failed: ${browserError.message}`)
    } finally {
      await browser.close()
    }

    // --- Upload and Verification Logic (Same as before) ---

    // Calculate hash for deduplication/verification
    const hash = crypto.createHash('sha256').update(pdfBuffer).digest('hex')
    const pdfBase64 = pdfBuffer.toString('base64')

    // Create snapshot payload (re-fetch data to match schema if needed, 
    // or we can rely on what the print page fetched. 
    // For now, to keep legacy compatibility, we won't insert a "payload" snapshot 
    // here because we didn't fetch the raw data in this API route. 
    // We can fetch it if "report_snapshots" requires it, but for now 
    // let's focus on the PDF upload success.)

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
        // Create signed URL (1 year)
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
      // snapshot_id: null // Skipping snapshot creation in this simplified flow to avoid double-fetch
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
        generated_at: reportPayload.generated_at,
      },
    })
  } catch (error: any) {
    console.error('[reports] generate failed:', error)
    return NextResponse.json(
      {
        message: 'Failed to generate PDF report',
        detail: error?.message ?? String(error),
      },
      { status: 500 }
    )
  }
}

