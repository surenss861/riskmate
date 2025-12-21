import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * POST /api/audit/export
 * Export audit ledger as PDF
 * TODO: Implement direct Supabase query + PDF generation (currently requires backend server)
 */
export async function POST(request: NextRequest) {
  // For now, return a helpful error indicating backend is required for exports
  // The events endpoint now works directly, but PDF/CSV generation needs backend services
  return NextResponse.json(
    {
      message: 'Export functionality requires the backend server. Please ensure BACKEND_URL is configured, or implement PDF generation directly in this route.',
      code: 'EXPORT_REQUIRES_BACKEND',
      hint: 'PDF generation with pdfkit and CSV generation require server-side processing. Either deploy the backend server separately or implement the export logic directly in this Next.js API route.',
    },
    { status: 503 }
  )
}

