import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import PDFDocument from 'pdfkit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Build a valid PDF buffer using PDFKit
 */
function buildPdfBuffer(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 48 })
    const chunks: Buffer[] = []

    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.fontSize(22).text('Executive Brief', { align: 'left' })
    doc.moveDown(0.5)
    doc.fontSize(12).text('Placeholder PDF (valid bytes) to unblock UI.')
    doc.moveDown(0.5)
    doc.text(`Generated: ${new Date().toISOString()}`)

    doc.end()
  })
}

/**
 * POST /api/executive/brief/pdf
 * Generates PDF Board Brief from executive summary
 * Returns a PDF file for download
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's organization and verify executive role
    const { data: userData } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData?.organization_id) {
      return NextResponse.json(
        { message: 'Organization not found' },
        { status: 403 }
      )
    }

    // Verify executive role
    if (userData.role !== 'executive' && userData.role !== 'owner' && userData.role !== 'admin') {
      return NextResponse.json(
        { message: 'Executive access required' },
        { status: 403 }
      )
    }

    // Generate PDF using PDFKit (ensures valid PDF bytes)
    const pdfBuffer = await buildPdfBuffer()

    // Convert Buffer to Uint8Array for NextResponse (TypeScript compatibility)
    const pdfBytes = new Uint8Array(pdfBuffer)

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="executive-brief.pdf"',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Content-Length': String(pdfBuffer.length),
      },
    })
  } catch (error: any) {
    console.error('[executive/brief/pdf] Unexpected error:', error)
    return NextResponse.json(
      { message: 'Internal server error', error: error?.message },
      { status: 500 }
    )
  }
}

