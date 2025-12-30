/**
 * Packet Print Page
 * 
 * Renders report packets using the modular section system.
 * This is the new packet-driven approach that replaces the hardcoded print page.
 */

import { createSupabaseServiceClient } from '@/lib/supabase/client'
import { verifyPrintToken } from '@/lib/utils/printToken'
import { buildJobPacket } from '@/lib/utils/packets/builder'
import { SectionRenderer } from '@/components/report/SectionRenderer'
import { colors } from '@/lib/design-system/tokens'
import { isValidPacketType } from '@/lib/utils/packets/types'
import type { JobPacketPayload } from '@/lib/utils/packets/builder'

// Force dynamic rendering and Node.js runtime for server-side auth/token verification
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PacketPrintPageProps {
  params: Promise<{ runId: string }>
  searchParams: Promise<{ token?: string }>
}

export default async function PacketPrintPage({ params, searchParams }: PacketPrintPageProps) {
  try {
    const { runId } = await params
    const { token: rawToken } = await searchParams

    let organization_id: string | null = null

    // Verify token if provided (for serverless PDF generation)
    if (rawToken) {
      let token = rawToken
      try {
        token = decodeURIComponent(rawToken)
      } catch (decodeError) {
        console.warn('[PACKET-PRINT] decodeURIComponent failed, using raw token:', decodeError)
        token = rawToken
      }

      console.log('[PACKET-PRINT] Token provided, verifying...', { tokenLength: token.length, runId })
      const verifiedPayload = verifyPrintToken(token)
      if (!verifiedPayload) {
        console.error('[PACKET-PRINT] token signature mismatch or expired')
        return (
          <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
            <h1>403 - Invalid Token</h1>
            <p>Token verification failed. This link may have expired or been tampered with.</p>
          </div>
        )
      }
      console.log('[PACKET-PRINT] Token verified successfully', { organizationId: verifiedPayload.organizationId })
      organization_id = verifiedPayload.organizationId
      tokenPayload = verifiedPayload // Store for later validation
    } else {
      console.log('[PACKET-PRINT] token missing - using cookie auth')
      // For browser access, use cookie-based auth
      const { createSupabaseServerClient } = await import('@/lib/supabase/server')
      const supabase = await createSupabaseServerClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('[PACKET-PRINT] user not authenticated')
        return (
          <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
            <h1>401 - Unauthorized</h1>
            <p>Please log in to view this report.</p>
          </div>
        )
      }

      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', user.id)
        .maybeSingle()

      if (!userData?.organization_id) {
        console.error('[PACKET-PRINT] user missing organization_id')
        return (
          <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
            <h1>403 - No Organization</h1>
            <p>Your account is not associated with an organization.</p>
          </div>
        )
      }
      organization_id = userData.organization_id
    }

    if (!organization_id) {
      console.error('[PACKET-PRINT] organization_id is null after auth')
      return (
        <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
          <h1>500 - Internal Error</h1>
          <p>Failed to determine organization.</p>
        </div>
      )
    }

    // Use service role client for serverless PDF generation (bypasses RLS)
    // Use regular client for browser access (respects user's RLS)
    const supabase = rawToken
      ? createSupabaseServiceClient()
      : await import('@/lib/supabase/server').then((m) => m.createSupabaseServerClient())

    console.log('[PACKET-PRINT] Using supabase client:', rawToken ? 'service-role (token auth)' : 'server-client (cookie auth)')

    // Fetch report_run to get job_id and packet_type
    const { data: reportRun, error: runError } = await supabase
      .from('report_runs')
      .select('id, job_id, organization_id, packet_type, status, generated_at')
      .eq('id', runId)
      .eq('organization_id', organization_id)
      .maybeSingle()

    if (runError || !reportRun) {
      console.error('[PACKET-PRINT] Report run not found:', { runId, organization_id, error: runError })
      return (
        <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
          <h1>404 - Report Run Not Found</h1>
          <p>The requested report run could not be found.</p>
        </div>
      )
    }

    // CRITICAL: Validate runId matches token (prevents token reuse across runs)
    if (rawToken && tokenPayload?.reportRunId && tokenPayload.reportRunId !== runId) {
      console.error('[PACKET-PRINT] Token runId mismatch:', { 
        tokenRunId: tokenPayload.reportRunId, 
        urlRunId: runId 
      })
      return (
        <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
          <h1>403 - Token Mismatch</h1>
          <p>Token is not valid for this report run.</p>
        </div>
      )
    }

    // CRITICAL: Validate token jobId matches reportRun.job_id (prevents cross-job access)
    if (rawToken && tokenPayload?.jobId && tokenPayload.jobId !== reportRun.job_id) {
      console.error('[PACKET-PRINT] Token jobId mismatch:', { 
        tokenJobId: tokenPayload.jobId, 
        runJobId: reportRun.job_id 
      })
      return (
        <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
          <h1>403 - Token Mismatch</h1>
          <p>Token is not valid for this job.</p>
        </div>
      )
    }

    // Build packet data
    let packetData: JobPacketPayload
    try {
      packetData = await buildJobPacket({
        jobId: reportRun.job_id,
        packetType: (reportRun.packet_type as any) || 'insurance', // Default to insurance for backwards compatibility
        organizationId: organization_id,
        supabaseClient: supabase,
      })
    } catch (packetError: any) {
      console.error('[PACKET-PRINT] Failed to build packet:', packetError)
      return (
        <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
          <h1>500 - Failed to Build Packet</h1>
          <p>Error: {packetError?.message || 'Unknown error'}</p>
        </div>
      )
    }

    // Get organization branding
    const { data: organization } = await supabase
      .from('organizations')
      .select('name, logo_url')
      .eq('id', organization_id)
      .maybeSingle()

    const logoUrl = organization?.logo_url || null
    const isDraft = reportRun.status === 'draft' || reportRun.status === 'pending'

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{packetData.meta.packetTitle} - RiskMate</title>
          <style dangerouslySetInnerHTML={{ __html: getPrintStyles() }} />
        </head>
        <body>
          <div className="report-root" data-draft={isDraft}>
            <div className="report-content">
              {/* Cover Page */}
              <div className="cover-page">
                <div className="cover-header">
                  {logoUrl && <img src={logoUrl} alt="Logo" className="cover-logo" />}
                  <div className="cover-brand">RiskMate</div>
                </div>

                <h1 className="cover-title">{packetData.meta.packetTitle}</h1>
                <div className="cover-accent-line"></div>

                <div className="cover-subheader">
                  <span>Job ID: {packetData.meta.jobId.substring(0, 8).toUpperCase()}</span>
                  <span>•</span>
                  <span>Generated: {new Date(packetData.meta.generatedAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Render Sections */}
              {packetData.sections.map((section, idx) => {
                const rendered = <SectionRenderer key={`${section.type}-${idx}`} section={section} />
                // Skip null sections (unimplemented)
                if (!rendered) return null
                return rendered
              })}
            </div>

            {/* PDF Ready Marker */}
            <div id="pdf-ready" style={{ display: 'none' }} />
          </div>
        </body>
      </html>
    )
  } catch (error: any) {
    console.error('[PACKET-PRINT] Unexpected error:', error)
    return (
      <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
        <h1>500 - Internal Server Error</h1>
        <pre>{error?.stack || error?.message || String(error)}</pre>
      </div>
    )
  }
}

function getPrintStyles(): string {
  return `
    /* Import existing print styles from the main print page */
    /* This is a simplified version - in production, extract to shared CSS file */
    @page {
      size: A4;
      margin: 0;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      transform: none !important;
      filter: none !important;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #111111;
      background: white;
    }

    .report-root {
      position: relative;
    }

    .report-root::before {
      content: 'CONFIDENTIAL';
      position: fixed;
      inset: 0;
      display: grid;
      place-items: center;
      font-size: 120px;
      font-weight: 700;
      letter-spacing: 0.08em;
      opacity: 0.03;
      z-index: 0;
      pointer-events: none;
      transform: rotate(-35deg);
    }

    .report-root[data-draft="true"]::before {
      content: 'DRAFT';
      opacity: 0.03;
    }

    .report-content {
      position: relative;
      z-index: 1;
    }

    .cover-page {
      position: relative;
      z-index: 1;
      page-break-after: always;
      break-after: page;
      min-height: 0;
      height: auto;
      display: block;
      margin: 0;
      padding: 40pt 16mm;
      background: ${colors.black};
      color: ${colors.white};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      break-inside: avoid;
    }

    .cover-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 40pt;
    }

    .cover-logo {
      height: 50pt;
      width: auto;
      filter: brightness(0) invert(1);
    }

    .cover-brand {
      font-size: 20pt;
      font-weight: bold;
      color: ${colors.white};
      letter-spacing: 0.05em;
    }

    .cover-title {
      font-size: 42pt;
      font-weight: bold;
      color: ${colors.white};
      margin: 0 0 20pt 0;
      letter-spacing: -0.02em;
    }

    .cover-accent-line {
      width: 280pt;
      height: 4pt;
      background-color: ${colors.cordovan};
      margin-bottom: 30pt;
    }

    .cover-subheader {
      font-size: 10.5pt;
      color: ${colors.gray300};
      margin-bottom: 50pt;
      display: flex;
      gap: 8pt;
      flex-wrap: wrap;
      line-height: 1.6;
    }

    .page {
      position: relative;
      z-index: 2;
      page-break-before: always;
      break-inside: avoid;
      background: ${colors.white};
      padding: 40pt 0;
    }

    .section-header {
      font-size: 22pt;
      font-weight: bold;
      color: ${colors.black};
      margin-bottom: 24pt;
      padding-bottom: 8pt;
      border-bottom: 2pt solid ${colors.cordovan};
    }

    .column-card {
      border: 1pt solid ${colors.borderLight};
      border-radius: 6pt;
      padding: 16pt;
      background-color: ${colors.white};
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .risk-card {
      border-left: 4pt solid;
    }

    .card-title {
      font-size: 14pt;
      font-weight: bold;
      color: ${colors.black};
      margin-bottom: 16pt;
    }

    .detail-list {
      display: flex;
      flex-direction: column;
      gap: 12pt;
    }

    .detail-item {
      font-size: 11pt;
      color: ${colors.gray700};
      line-height: 1.5;
    }

    .detail-item strong {
      color: ${colors.black};
      font-weight: 600;
    }

    .empty-state {
      color: ${colors.gray600};
      font-style: italic;
      padding: 20pt 0;
    }

    .audit-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5pt;
      background: ${colors.white};
    }

    .audit-table thead {
      background-color: ${colors.bgSecondary};
    }

    .audit-table th {
      padding: 10pt 8pt;
      text-align: left;
      font-weight: 600;
      color: ${colors.black};
      border-bottom: 1.5pt solid ${colors.borderLight};
    }

    .audit-table td {
      padding: 10pt 8pt;
      color: ${colors.gray700};
      border-bottom: 0.5pt solid ${colors.borderLight};
    }

    .audit-table .even-row {
      background-color: ${colors.bgSecondary};
    }

    table,
    thead,
    tbody {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    td,
    th {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    @media print {
      .cover-page,
      .page,
      section,
      div[class*="min-h"],
      div[class*="h-screen"],
      div[class*="h-full"] {
        min-height: auto !important;
        height: auto !important;
      }

      .detail-item {
        white-space: nowrap;
      }
    }
  `
}

