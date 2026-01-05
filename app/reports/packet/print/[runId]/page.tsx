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
import { pdfTheme } from '@/lib/design-system/pdfTheme'
import { isValidPacketType } from '@/lib/utils/packets/types'
import type { JobPacketPayload } from '@/lib/utils/packets/builder'
import { computeCanonicalHash } from '@/lib/utils/canonicalJson'
import { formatPdfTimestamp } from '@/lib/utils/pdfFormatUtils'
import { generateQRCodeDataURL } from '@/lib/utils/qrCode'
import { safeStr, humanize } from '@/lib/utils/stringHelpers'

// Force dynamic rendering and Node.js runtime for server-side auth/token verification
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PacketPrintPageProps {
  params: Promise<{ runId: string }>
  searchParams: Promise<{ token?: string }>
}

export default async function PacketPrintPage({ params, searchParams }: PacketPrintPageProps) {
  // Debug marker - helps identify if page loads at all
  const debugMode = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'preview'
  
  let tokenPayload: { jobId: string; organizationId: string; reportRunId?: string } | null = null
  let runId: string | null = null
  let rawToken: string | undefined = undefined

  try {
    // CRITICAL: Await params/searchParams early to catch any parsing errors
    try {
      const paramsResolved = await params
      const searchParamsResolved = await searchParams
      runId = paramsResolved.runId
      rawToken = searchParamsResolved.token
    } catch (paramError: any) {
      console.error('[PACKET-PRINT] Failed to parse params/searchParams:', paramError?.message)
      return (
        <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
          <h1>400 - Invalid Request</h1>
          <p>Failed to parse request parameters.</p>
          {debugMode && <pre style={{ fontSize: '10px', color: '#666' }}>{paramError?.message}</pre>}
        </div>
      )
    }

    if (!runId) {
      console.error('[PACKET-PRINT] Missing runId')
      return (
        <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
          <h1>400 - Missing Report Run ID</h1>
          <p>The report run ID is required.</p>
        </div>
      )
    }

    // Early debug marker
    if (debugMode) {
      console.log('[PACKET-PRINT] Page load started:', { runId: runId?.substring(0, 8) })
    }

    let organization_id: string | null = null

    // Verify token and extract payload
    if (rawToken) {
      try {
        tokenPayload = await verifyPrintToken(rawToken)
        if (!tokenPayload) {
          console.error('[PACKET-PRINT] Token verification returned null')
          return (
            <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
              <h1>401 - Unauthorized</h1>
              <p>Invalid or expired token.</p>
              {debugMode && <p style={{ fontSize: '12px', color: '#666' }}>Debug: Token verification returned null</p>}
            </div>
          )
        }
        organization_id = tokenPayload.organizationId
        console.log('[PACKET-PRINT] Token verified:', {
          jobId: tokenPayload.jobId.substring(0, 8),
          organizationId: organization_id?.substring(0, 8),
          reportRunId: tokenPayload.reportRunId?.substring(0, 8),
        })
      } catch (tokenError: any) {
        console.error('[PACKET-PRINT] Token verification failed:', {
          message: tokenError?.message,
          stack: tokenError?.stack,
          error: String(tokenError)
        })
        return (
          <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
            <h1>403 - Invalid Token</h1>
            <p>The provided token is invalid or expired.</p>
            {debugMode && (
              <pre style={{ fontSize: '10px', color: '#666', marginTop: '10px' }}>
                {tokenError?.message || String(tokenError)}
              </pre>
            )}
          </div>
        )
      }
    } else {
      // No token - try to use session-based auth (for development/debugging)
      console.log('[PACKET-PRINT] No token provided, using session auth')
    }

    // Create Supabase client (ALWAYS use service role for print pages - token-based auth)
    // This ensures the page works in headless browsers without cookies
    let supabase
    try {
      if (rawToken) {
        // Token provided - use service role (bypasses RLS)
        supabase = createSupabaseServiceClient()
        console.log('[PACKET-PRINT] Using service-role client (token auth)')
      } else {
        // No token - try server client but log warning
        console.warn('[PACKET-PRINT] No token provided - using server client (may fail in headless browsers)')
        supabase = await import('@/lib/supabase/server').then((m) => m.createSupabaseServerClient())
      }
    } catch (clientError: any) {
      console.error('[PACKET-PRINT] Failed to create Supabase client:', clientError?.message)
      return (
        <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
          <h1>500 - Database Connection Failed</h1>
          <p>Unable to connect to database.</p>
          {debugMode && <pre style={{ fontSize: '10px', color: '#666' }}>{clientError?.message}</pre>}
        </div>
      )
    }

    // Fetch report_run to get job_id and packet_type
    if (debugMode) {
      console.log('[PACKET-PRINT] Fetching report run:', { runId: runId.substring(0, 8), organization_id: organization_id?.substring(0, 8) })
    }

    let reportRun: any = null
    let runError: any = null
    
    try {
      const query = supabase
        .from('report_runs')
        .select('id, job_id, organization_id, packet_type, status, generated_at, data_hash')
        .eq('id', runId)
      
      // Only filter by organization_id if we have it (token validation)
      // But don't require it - service role can access any run
      if (organization_id) {
        query.eq('organization_id', organization_id)
      }
      
      const result = await query.maybeSingle()
      reportRun = result.data
      runError = result.error
      
      // If we got an error but it's a permission issue, try without org filter
      if (runError && organization_id && runError.code === 'PGRST116') {
        console.warn('[PACKET-PRINT] Retrying report run fetch without org filter')
        const retryResult = await supabase
          .from('report_runs')
          .select('id, job_id, organization_id, packet_type, status, generated_at, data_hash')
          .eq('id', runId)
          .maybeSingle()
        reportRun = retryResult.data
        runError = retryResult.error
      }
    } catch (fetchError: any) {
      console.error('[PACKET-PRINT] Report run fetch exception:', {
        message: fetchError?.message,
        stack: fetchError?.stack,
        error: String(fetchError)
      })
      runError = fetchError
    }

    if (runError || !reportRun) {
      console.error('[PACKET-PRINT] Report run not found:', { 
        runId: runId.substring(0, 8), 
        organization_id: organization_id?.substring(0, 8), 
        error: runError,
        errorMessage: runError?.message,
        errorCode: runError?.code
      })
      return (
        <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
          <h1>404 - Report Run Not Found</h1>
          <p>The requested report run could not be found.</p>
          {debugMode && runError && (
            <pre style={{ fontSize: '10px', color: '#666', marginTop: '10px' }}>
              {runError?.message || JSON.stringify(runError, null, 2)}
            </pre>
          )}
        </div>
      )
    }

    if (debugMode) {
      console.log('[PACKET-PRINT] Report run loaded:', {
        runId: reportRun.id?.substring(0, 8),
        jobId: reportRun.job_id?.substring(0, 8),
        packetType: reportRun.packet_type
      })
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
          <p>The token does not match the requested report run.</p>
        </div>
      )
    }

    // Update organization_id from reportRun if not set from token
    if (!organization_id) {
      organization_id = reportRun.organization_id
    }

    // Ensure organization_id is set (required for buildJobPacket)
    if (!organization_id) {
      console.error('[PACKET-PRINT] Missing organization_id')
      return (
        <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
          <h1>400 - Missing Organization</h1>
          <p>Unable to determine organization for this report run.</p>
        </div>
      )
    }

    // Validate packet type (fallback to 'insurance' for older records without packet_type)
    const packetType = reportRun.packet_type || 'insurance'
    if (!isValidPacketType(packetType)) {
      console.error('[PACKET-PRINT] Invalid packet type:', packetType)
      return (
        <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
          <h1>400 - Invalid Packet Type</h1>
          <p>The packet type &quot;{packetType}&quot; is not valid.</p>
          {debugMode && (
            <p style={{ fontSize: '12px', color: '#666' }}>
              Debug: reportRun.packet_type = {String(reportRun.packet_type)}
            </p>
          )}
        </div>
      )
    }

    // Build packet data (non-fatal - render with empty sections if build fails)
    if (debugMode) {
      console.log('[PACKET-PRINT] Building packet data...')
    }

    let packetData: JobPacketPayload | null = null
    let packetBuildError: any = null
    
    try {
      packetData = await buildJobPacket({
        jobId: reportRun.job_id,
        packetType: packetType,
        organizationId: organization_id || reportRun.organization_id, // Fallback to reportRun's org_id
        supabaseClient: supabase,
      })
      
      if (debugMode) {
        console.log('[PACKET-PRINT] Packet data built successfully:', {
          sections: packetData.sections?.length,
          packetTitle: packetData.meta?.packetTitle
        })
      }
    } catch (packetError: any) {
      console.error('[PACKET-PRINT] Failed to build packet (non-fatal):', {
        message: packetError?.message,
        stack: packetError?.stack,
        error: String(packetError),
        jobId: reportRun.job_id?.substring(0, 8),
        packetType,
        organizationId: organization_id?.substring(0, 8)
      })
      packetBuildError = packetError
      
      // Create minimal packet data so page still renders
      const safePacketTypeForError = String(packetType || 'insurance')
      packetData = {
        meta: {
          jobId: reportRun.job_id,
          organizationId: organization_id || reportRun.organization_id || '',
          packetType: packetType,
          packetTitle: safePacketTypeForError.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
          generatedAt: reportRun.generated_at || new Date().toISOString(),
        },
        sections: [
          {
            type: 'job_summary',
            data: {
              jobId: reportRun.job_id,
              error: 'Failed to load job data',
            },
            meta: {
              title: 'Job Summary',
              empty: false,
            },
          },
        ],
        computed: {
          totalSections: 1,
          sectionsWithData: 1,
        },
      }
    }

    // Get organization branding (non-fatal - use defaults if fetch fails)
    let organization: any = null
    const finalOrgId = organization_id || reportRun.organization_id
    
    if (finalOrgId) {
      try {
        const orgResult = await supabase
          .from('organizations')
          .select('name, logo_url')
          .eq('id', finalOrgId)
          .maybeSingle()
        
        organization = orgResult.data
        if (orgResult.error) {
          console.warn('[PACKET-PRINT] Organization fetch error (non-fatal):', orgResult.error)
        }
      } catch (orgError: any) {
        console.warn('[PACKET-PRINT] Organization fetch exception (non-fatal):', orgError?.message)
      }
    }

    const logoUrl = organization?.logo_url || null
    const organizationName = organization?.name || 'RiskMate'
    const isDraft = reportRun.status === 'draft' || reportRun.status === 'pending'

    if (debugMode) {
      console.log('[PACKET-PRINT] Organization loaded:', {
        name: organizationName,
        hasLogo: !!logoUrl,
        isDraft
      })
    }
    
    // Get packet title from packet data (with fallback - null-safe)
    const safePacketType = String(packetType || 'insurance')
    const packetTitle = packetData?.meta?.packetTitle || safePacketType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Report'
    
    // Compute document hash for integrity verification (non-fatal)
    let documentHash = ''
    try {
      if (packetData) {
        documentHash = computeCanonicalHash(packetData)
      } else {
        // Fallback hash if packet data failed to build
        documentHash = 'ERROR: Unable to compute hash'
      }
    } catch (hashError: any) {
      console.warn('[PACKET-PRINT] Hash computation failed (non-fatal):', hashError?.message)
      documentHash = 'ERROR: Hash computation failed'
    }
    
    // Normalize all string values before rendering (prevent .replace crashes)
    const safeJobId = String(packetData?.meta?.jobId || reportRun.job_id || '')
    const safeRunId = String(runId || '')
    const safeOrgName = String(organizationName || 'RiskMate')
    const safeGeneratedAt = reportRun.generated_at || packetData?.meta?.generatedAt || new Date().toISOString()
    
    // Generate verification URL and QR code
    let qrCodeDataUrl: string | null = null
    let verificationUrl: string | null = null
    try {
      const protocol = 'https' // Always use HTTPS for verification URLs
      const host = process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '') || 'riskmate.vercel.app'
      verificationUrl = `${protocol}://${host}/verify/report/${runId}`
      qrCodeDataUrl = await generateQRCodeDataURL(verificationUrl)
    } catch (qrError: any) {
      console.warn('[PACKET-PRINT] QR code generation failed (non-fatal):', qrError?.message)
      // Continue without QR code - not critical for PDF generation
    }
    
    // BULLETPROOF: Precompute all data before JSX - never throw during render
    // Step 1: Normalize sections array with try/catch
    let safeSections: any[] = []
    try {
      safeSections = Array.isArray(packetData?.sections) ? packetData.sections : []
    } catch (e) {
      console.warn('[PACKET-PRINT] Sections normalization failed (non-fatal):', e)
      safeSections = []
    }

    // Fetch signatures for signature proof section (non-fatal)
    let signatures: any[] = []
    try {
      const { data: signaturesData } = await supabase
        .from('report_signatures')
        .select(`
          signer_name,
          signer_title,
          signature_role,
          signature_svg,
          signed_at,
          signature_hash,
          signer_user:users!signer_user_id(email),
          attestation_text
        `)
        .eq('report_run_id', runId)
        .is('revoked_at', null)
        .order('signed_at', { ascending: true })
      
      // Flatten nested signer_user data
      signatures = (signaturesData || []).map((sig: any) => ({
        signer_name: sig.signer_name,
        signer_title: sig.signer_title,
        signature_role: sig.signature_role,
        signature_svg: sig.signature_svg,
        signed_at: sig.signed_at,
        signature_hash: sig.signature_hash || null,
        signer_email: sig.signer_user?.email || null,
        attestation_text: sig.attestation_text || null,
      }))
    } catch (sigError: any) {
      console.warn('[PACKET-PRINT] Signatures fetch failed (non-fatal):', sigError?.message)
      signatures = []
    }

    // Step 2: Build sectionsWithIntegrity with safe operations
    let sectionsWithIntegrity: any[] = []
    try {
      sectionsWithIntegrity = safeSections.map((section) => {
        if (!section) return null
        try {
          if (section.type === 'integrity_verification') {
            return {
              ...section,
              data: {
                ...(section.data || {}),
                reportRunId: safeRunId,
                documentHash: safeStr(documentHash),
                generatedAt: safeGeneratedAt,
                verificationUrl: verificationUrl || undefined,
                qrCodeDataUrl: qrCodeDataUrl || undefined,
              },
              meta: {
                ...(section.meta || {}),
                title: safeStr(section.meta?.title || section.type, humanize(section.type || 'Section')),
              },
            }
          }
          // Ensure all sections have safe meta.title
          return {
            ...section,
            meta: {
              ...(section.meta || {}),
              title: safeStr(section.meta?.title || section.type, humanize(section.type || 'Section')),
            },
          }
        } catch (sectionError) {
          console.warn('[PACKET-PRINT] Section processing failed (non-fatal):', sectionError)
          // Return minimal valid section
          return {
            type: section.type || 'unknown',
            data: {},
            meta: { title: humanize(section.type || 'Section'), empty: true },
          }
        }
      }).filter((s): s is NonNullable<typeof s> => s !== null)
      
      // Append signature proof section at the end (after integrity_verification)
      sectionsWithIntegrity.push({
        type: 'signature_proof',
        data: {
          reportRunId: safeRunId,
          reportRunHash: reportRun.data_hash || documentHash,
          reportRunCreatedAt: safeGeneratedAt,
          signatures: signatures,
          isDraft: isDraft,
          requiredRoles: ['prepared_by', 'reviewed_by', 'approved_by'],
        },
        meta: {
          title: 'Signature Proof & Attestation',
        },
      })
    } catch (e) {
      console.warn('[PACKET-PRINT] Sections processing failed (non-fatal):', e)
      sectionsWithIntegrity = []
    }
    
    // Step 3: Build finalPacketData safely
    let finalPacketData: any = {}
    try {
      finalPacketData = {
        ...(packetData || {}),
        sections: sectionsWithIntegrity,
      }
    } catch (e) {
      console.warn('[PACKET-PRINT] Final packet data construction failed (non-fatal):', e)
      finalPacketData = {
        meta: {
          jobId: safeJobId,
          organizationId: safeOrgName,
          packetType: safePacketType,
          packetTitle: humanize(safePacketType),
          generatedAt: safeGeneratedAt,
        },
        sections: [],
      }
    }

    // Step 4: Precompute safe sections array for JSX (no inline .map())
    let safeRenderSections: any[] = []
    try {
      safeRenderSections = Array.isArray(finalPacketData?.sections) ? finalPacketData.sections : []
    } catch (e) {
      console.warn('[PACKET-PRINT] Render sections preparation failed (non-fatal):', e)
      safeRenderSections = []
    }

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{packetTitle} - {organizationName}</title>
          <style dangerouslySetInnerHTML={{ __html: getPrintStyles() }} />
        </head>
        <body 
          data-organization-name={safeOrgName}
          data-packet-title={packetTitle}
          data-job-id={safeJobId.substring(0, 8).toUpperCase()}
          data-run-id={safeRunId.substring(0, 8).toUpperCase()}
          data-generated={formatPdfTimestamp(safeGeneratedAt)}
          data-hash={documentHash ? documentHash.substring(0, 16) : ''}
          data-draft={isDraft ? 'true' : undefined}
        >
          <div className="report-root" data-draft={isDraft ? 'true' : undefined}>
            <div className="report-content">
              {/* Cover Page */}
              <div className="cover-page">
                {/* Full-bleed top band */}
                <div className="cover-top-band">
                  <div className="cover-header">
                    {logoUrl && <img src={logoUrl} alt="Logo" className="cover-logo" />}
                    <div className="cover-brand">{organizationName}</div>
                  </div>
                </div>
                
                {/* Orange accent rule */}
                <div className="cover-accent-rule"></div>
                
                {/* Content area */}
                <div className="cover-content">
                  <h1 className="cover-title">{packetTitle}</h1>

                  <div className="cover-subheader">
                    <span>Job ID: {safeJobId.substring(0, 8).toUpperCase()}</span>
                    <span>•</span>
                    <span>Report Run ID: {safeRunId.substring(0, 8).toUpperCase()}</span>
                    <span>•</span>
                    <span>Generated: {formatPdfTimestamp(safeGeneratedAt)}</span>
                    {!isDraft && <span>•</span>}
                    {!isDraft && <span>Status: Final</span>}
                    {isDraft && <span>•</span>}
                    {isDraft && <span>Status: Draft</span>}
                  </div>
                  
                  {/* What this packet proves - teaser */}
                  <div className="cover-proof-teaser">
                    <div className="cover-proof-label">What This Packet Proves</div>
                    <ul className="cover-proof-list">
                      <li>All records are timestamped and immutable</li>
                      <li>Evidence is cryptographically verified and linked to events</li>
                      <li>Complete chain of custody from job creation to closure</li>
                      <li>Document integrity verified via SHA-256 hash (see Integrity &amp; Verification page)</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Render Sections - Precomputed array, no inline .map() logic */}
              {safeRenderSections.map((section, idx) => {
                if (!section || !section.type) return null
                try {
                  return <SectionRenderer key={`${safeStr(section.type)}-${idx}`} section={section} />
                } catch (renderError) {
                  console.warn(`[PACKET-PRINT] Section render failed for ${section.type} (non-fatal):`, renderError)
                  return null
                }
              }).filter((rendered) => rendered !== null)}
            </div>

            {/* PDF Ready Marker - ALWAYS render (even on errors) so PDF service doesn't hang */}
            <div id="pdf-ready" data-ready="1" style={{ display: 'none' }} aria-hidden="true" />
            <div data-report-ready="true" style={{ display: 'none' }} aria-hidden="true" />
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
  const theme = pdfTheme
  
  return `
    /* PDF Theme - Minimal, court-ready, brand-aligned */
    @page {
      size: A4;
      margin: ${theme.spacing.pageMargin} ${theme.spacing.pageMargin} ${theme.spacing.pageMargin} ${theme.spacing.pageMargin};
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      transform: none !important;
      filter: none !important;
    }

    body {
      font-family: ${theme.typography.fontFamily};
      font-size: ${theme.typography.sizes.body};
      line-height: ${theme.typography.lineHeight.normal};
      color: ${theme.colors.ink};
      background: ${theme.colors.paper};
    }

    .report-root {
      position: relative;
    }

    /* Watermark - very subtle, only on draft */
    .report-root[data-draft="true"]::before {
      content: 'DRAFT';
      position: fixed;
      inset: 0;
      display: grid;
      place-items: center;
      font-size: 140px;
      font-weight: ${theme.typography.weights.bold};
      letter-spacing: 0.1em;
      opacity: 0.02;
      z-index: 0;
      pointer-events: none;
      transform: rotate(-35deg);
      color: ${theme.colors.ink};
    }
    
    /* No watermark for production exports */
    .report-root:not([data-draft="true"])::before {
      display: none;
    }

    .report-content {
      position: relative;
      z-index: 1;
    }

    /* Cover Page - Full-bleed top band + white content */
    .cover-page {
      position: relative;
      z-index: 1;
      page-break-after: always;
      break-after: page;
      min-height: 0;
      height: auto;
      display: block;
      margin: 0;
      padding: 0;
      background: ${theme.colors.paper};
      color: ${theme.colors.ink};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      break-inside: avoid;
    }

    .cover-top-band {
      width: 100%;
      background: #000000;
      color: #FFFFFF;
      padding: 32pt ${theme.spacing.pageMargin} 24pt;
      margin: 0;
    }

    .cover-accent-rule {
      width: 100%;
      height: 1pt;
      background-color: ${theme.colors.accent};
      margin: 0;
    }

    .cover-content {
      padding: 40pt ${theme.spacing.pageMargin};
    }

    .cover-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0;
    }

    .cover-logo {
      height: 50pt;
      width: auto;
      filter: brightness(0) invert(1);
    }

    .cover-brand {
      font-size: 20pt;
      font-weight: ${theme.typography.weights.bold};
      color: #FFFFFF;
      letter-spacing: 0.05em;
    }

    .cover-title {
      font-size: 36pt;
      font-weight: ${theme.typography.weights.bold};
      color: ${theme.colors.ink};
      margin: 32pt 0 20pt 0;
      letter-spacing: -0.02em;
    }

    .cover-subheader {
      font-size: 10pt;
      color: ${theme.colors.muted};
      margin-bottom: 32pt;
      display: flex;
      gap: 8pt;
      flex-wrap: wrap;
      line-height: 1.6;
    }
    
    .cover-proof-teaser {
      margin-top: 32pt;
      padding-top: 24pt;
      border-top: ${theme.borders.thin} solid ${theme.colors.borders};
    }
    
    .cover-proof-label {
      font-size: 10pt;
      color: ${theme.colors.muted};
      margin-bottom: 12pt;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: ${theme.typography.weights.semibold};
    }
    
    .cover-proof-list {
      list-style: none;
      padding: 0;
      margin: 0;
      font-size: 10.5pt;
      line-height: 1.7;
      color: ${theme.colors.ink};
    }
    
    .cover-proof-list li {
      margin-bottom: 6pt;
      padding-left: 18pt;
      position: relative;
    }
    
    .cover-proof-list li::before {
      content: '•';
      position: absolute;
      left: 0;
      color: ${theme.colors.accent};
      font-weight: ${theme.typography.weights.bold};
    }

    /* Page Sections - White background, minimal design */
    .page {
      position: relative;
      z-index: 2;
      page-break-before: always;
      break-inside: avoid;
      background: ${theme.colors.paper};
      padding: ${theme.spacing.sectionGap} ${theme.spacing.pageMargin};
      min-height: 100vh;
    }

    .section-header {
      font-size: ${theme.typography.sizes.h2};
      font-weight: ${theme.typography.weights.bold};
      color: ${theme.colors.ink};
      margin-bottom: ${theme.spacing.sectionGap};
      padding-bottom: 6pt;
      border-bottom: ${theme.borders.medium} solid ${theme.colors.accent};
    }

    /* Cards - Minimal borders, clean spacing */
    .column-card {
      border: ${theme.borders.medium} solid ${theme.colors.borders};
      border-radius: ${theme.borders.radius};
      padding: ${theme.spacing.cardPadding};
      background-color: ${theme.colors.paper};
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .card-title {
      font-size: ${theme.typography.sizes.h3};
      font-weight: ${theme.typography.weights.semibold};
      color: ${theme.colors.ink};
      margin-bottom: ${theme.spacing.textGap};
    }

    .detail-list {
      display: flex;
      flex-direction: column;
      gap: ${theme.spacing.textGap};
    }

    .detail-item {
      font-size: ${theme.typography.sizes.body};
      color: ${theme.colors.ink};
      line-height: ${theme.typography.lineHeight.normal};
    }

    .detail-item strong {
      color: ${theme.colors.ink};
      font-weight: ${theme.typography.weights.semibold};
    }

    /* Tables - Clean, scannable */
    .pdf-table {
      width: 100%;
      border-collapse: collapse;
      font-size: ${theme.typography.sizes.body};
      background: ${theme.colors.paper};
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .pdf-table thead {
      background-color: #FAFAFA;
    }

    .pdf-table th {
      padding: 10pt 8pt;
      text-align: left;
      font-weight: ${theme.typography.weights.semibold};
      color: ${theme.colors.ink};
      border-bottom: ${theme.borders.thick} solid ${theme.colors.borders};
      font-size: ${theme.typography.sizes.caption};
      text-transform: uppercase;
      letter-spacing: 0.05em;
      vertical-align: bottom;
    }

    .pdf-table td {
      padding: 10pt 8pt;
      color: ${theme.colors.ink};
      border-bottom: ${theme.borders.thin} solid ${theme.colors.borders};
      font-size: ${theme.typography.sizes.body};
      vertical-align: top;
      line-height: ${theme.typography.lineHeight.normal};
    }

    .pdf-table tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .pdf-table tbody tr:nth-child(even) {
      background-color: #FAFAFA;
    }

    /* Chain of custody table styling - for evidence/events */
    .pdf-table.chain-of-custody th {
      background-color: ${theme.colors.ink};
      color: ${theme.colors.paper};
    }

    .pdf-table.chain-of-custody td {
      font-family: 'Courier New', monospace;
      font-size: ${theme.typography.sizes.caption};
    }

    /* Risk Badges - Minimal, outline style */
    .risk-badge {
      display: inline-block;
      padding: 4pt 10pt;
      border-radius: ${theme.borders.radius};
      font-size: ${theme.typography.sizes.caption};
      font-weight: ${theme.typography.weights.semibold};
      border: ${theme.borders.medium} solid;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .risk-badge-critical {
      border-color: ${theme.colors.accent};
      background-color: ${theme.colors.accent};
      color: #FFFFFF;
    }

    .risk-badge-high {
      border-color: ${theme.colors.accent};
      color: ${theme.colors.accent};
      background-color: transparent;
    }

    .risk-badge-medium {
      border-color: ${theme.colors.muted};
      color: ${theme.colors.muted};
      background-color: transparent;
    }

    .risk-badge-low {
      border-color: ${theme.colors.borders};
      color: ${theme.colors.muted};
      background-color: transparent;
    }

    /* Severity Chips - Outline style */
    .severity-chip {
      display: inline-block;
      padding: 2pt 8pt;
      border-radius: ${theme.borders.radius};
      font-size: ${theme.typography.sizes.small};
      font-weight: ${theme.typography.weights.semibold};
      border: ${theme.borders.thin} solid;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .severity-chip-high {
      border-color: ${theme.colors.accent};
      color: ${theme.colors.accent};
    }

    .severity-chip-medium {
      border-color: ${theme.colors.muted};
      color: ${theme.colors.muted};
    }

    .severity-chip-low {
      border-color: ${theme.colors.borders};
      color: ${theme.colors.muted};
    }

    /* Grids - 2-column layouts for density */
    .pdf-grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: ${theme.spacing.gridGap};
      margin-bottom: ${theme.spacing.sectionGap};
    }

    .pdf-grid-4 {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: ${theme.spacing.gridGap};
      margin-bottom: ${theme.spacing.sectionGap};
    }

    /* Photo Grid - 2-column, chain-of-custody style */
    .photos-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: ${theme.spacing.gridGap};
      break-inside: avoid;
    }

    .photo-item {
      border: ${theme.borders.medium} solid ${theme.colors.borders};
      border-radius: ${theme.borders.radius};
      overflow: hidden;
      break-inside: avoid;
    }

    .photo-image {
      width: 100%;
      height: 180pt;
      object-fit: cover;
      display: block;
    }

    .photo-caption {
      padding: 10pt;
      background-color: #FAFAFA;
      font-size: ${theme.typography.sizes.caption};
    }

    .photo-name {
      font-weight: ${theme.typography.weights.semibold};
      color: ${theme.colors.ink};
      margin-bottom: 4pt;
    }

    .photo-meta {
      font-size: ${theme.typography.sizes.small};
      color: ${theme.colors.muted};
    }

    /* Section Empty State - Court-ready empty sections */
    .section-empty {
      padding: ${theme.spacing.cardPadding};
      border: ${theme.borders.medium} solid ${theme.colors.borders};
      border-radius: ${theme.borders.radius};
      background-color: ${theme.colors.paper};
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .section-empty .section-title {
      font-size: ${theme.typography.sizes.h2};
      font-weight: ${theme.typography.weights.bold};
      color: ${theme.colors.ink};
      margin-bottom: ${theme.spacing.textGap};
      padding-bottom: 6pt;
      border-bottom: ${theme.borders.medium} solid ${theme.colors.accent};
    }

    .section-empty-content {
      margin-top: ${theme.spacing.textGap};
    }

    .section-empty-message {
      font-size: ${theme.typography.sizes.body};
      color: ${theme.colors.ink};
      line-height: ${theme.typography.lineHeight.relaxed};
      margin-bottom: ${theme.spacing.textGap};
    }

    .section-empty-note {
      font-size: ${theme.typography.sizes.body};
      color: ${theme.colors.muted};
      line-height: ${theme.typography.lineHeight.normal};
      margin-top: ${theme.spacing.textGap};
      padding: ${theme.spacing.textGap};
      background-color: #FAFAFA;
      border-left: 3pt solid ${theme.colors.borders};
      border-radius: 2pt;
    }

    .section-empty-note strong {
      color: ${theme.colors.ink};
      font-weight: ${theme.typography.weights.semibold};
      display: block;
      margin-bottom: 4pt;
    }

    /* Legacy empty-state class (backwards compatibility) */
    .empty-state {
      color: ${theme.colors.muted};
      font-style: italic;
      padding: 20pt 0;
      font-size: ${theme.typography.sizes.body};
    }

    /* Compliance Status */
    .compliance-status-badge {
      display: inline-block;
      padding: 4pt 8pt;
      border-radius: ${theme.borders.radius};
      font-size: ${theme.typography.sizes.caption};
      font-weight: ${theme.typography.weights.semibold};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .compliance-status-badge.complete {
      background-color: #E6F7E6;
      color: #16a34a;
      border: ${theme.borders.thin} solid #16a34a;
    }

    .compliance-status-badge.incomplete {
      background-color: #FEE;
      color: #dc2626;
      border: ${theme.borders.thin} solid #dc2626;
    }

    .compliance-status-badge.pending {
      background-color: #FFF4E6;
      color: #ca8a04;
      border: ${theme.borders.thin} solid #ca8a04;
    }

    /* TOC */
    .toc-list {
      list-style: none;
      padding: 0;
      margin-top: ${theme.spacing.sectionGap};
    }

    .toc-item {
      font-size: ${theme.typography.sizes.body};
      margin-bottom: ${theme.spacing.textGap};
      color: ${theme.colors.ink};
    }

    .toc-item strong {
      color: ${theme.colors.ink};
      font-weight: ${theme.typography.weights.semibold};
    }

    /* Integrity Section */
    .integrity-section {
      background-color: #FAFAFA;
      border: ${theme.borders.medium} solid ${theme.colors.borders};
      border-radius: 8pt;
      padding: ${theme.spacing.sectionGap};
      margin-top: ${theme.spacing.sectionGap};
      break-inside: avoid;
    }

    .integrity-header {
      font-size: ${theme.typography.sizes.h2};
      font-weight: ${theme.typography.weights.bold};
      color: ${theme.colors.ink};
      margin-bottom: ${theme.spacing.textGap};
      padding-bottom: 8pt;
      border-bottom: ${theme.borders.medium} solid ${theme.colors.borders};
    }

    .integrity-detail {
      font-size: ${theme.typography.sizes.body};
      color: ${theme.colors.ink};
      margin-bottom: 8pt;
    }

    .integrity-detail strong {
      color: ${theme.colors.ink};
      font-weight: ${theme.typography.weights.semibold};
    }

    .integrity-proof-list {
      list-style: disc;
      margin-left: 20pt;
      margin-top: ${theme.spacing.textGap};
      color: ${theme.colors.ink};
      font-size: ${theme.typography.sizes.body};
    }

    .integrity-proof-list li {
      margin-bottom: 6pt;
    }

    .integrity-confidential {
      font-size: ${theme.typography.sizes.caption};
      color: ${theme.colors.muted};
      text-align: center;
      margin-top: ${theme.spacing.sectionGap};
      font-style: italic;
    }

    /* QR Code Container */
    .qr-code-container {
      text-align: center;
      margin-top: ${theme.spacing.sectionGap};
      padding: ${theme.spacing.cardPadding};
      background-color: #FAFAFA;
      border-radius: ${theme.borders.radius};
    }

    .qr-code-image {
      width: 120pt;
      height: 120pt;
      margin: 0 auto ${theme.spacing.textGap};
      display: block;
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

