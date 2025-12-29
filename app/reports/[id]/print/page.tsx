import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceClient } from '@/lib/supabase/client'
import { buildJobReport } from '@/lib/utils/jobReport'
import { formatDate, formatTime, getRiskColor, getSeverityColor } from '@/lib/utils/reportUtils'
import type { JobReportPayload } from '@/lib/utils/jobReport'
import { colors } from '@/lib/design-system/tokens'
import { verifyPrintToken } from '@/lib/utils/printToken'

// Force dynamic rendering and Node.js runtime for server-side auth/token verification
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PrintPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string; report_run_id?: string }>
}

/**
 * Print-friendly report page
 * 
 * This page renders the report as HTML optimized for PDF export.
 * Uses RiskMate design tokens and proper CSS layering for watermark.
 * 
 * Security: Uses signed token in URL for access (not relying on cookies in headless browser)
 */
export default async function PrintReportPage({ params, searchParams }: PrintPageProps) {
  try {
    const { id: jobId } = await params
    const searchParamsResolved = await searchParams
    const rawToken = searchParamsResolved.token
    const report_run_id = searchParamsResolved.report_run_id

    console.log('[PRINT] Route accessed', { jobId, hasToken: !!rawToken, hasReportRunId: !!report_run_id })

    let organization_id: string | null = null

    // If token is provided, verify it (for serverless PDF generation)
    if (rawToken) {
      // Next.js should automatically decode URL-encoded query params, but handle it safely
      let token: string
      try {
        token = decodeURIComponent(rawToken)
      } catch (decodeError) {
        // If decode fails, use raw token (it might already be decoded)
        console.warn('[PRINT] decodeURIComponent failed, using raw token:', decodeError)
        token = rawToken
      }
      
      console.log('[PRINT] Token provided, verifying...', { tokenLength: token.length, jobId })
      const tokenPayload = verifyPrintToken(token)
      if (!tokenPayload) {
        console.error('[PRINT] token signature mismatch or expired')
        return (
          <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
            <h1>403 - Invalid Token</h1>
            <p>Token verification failed. This link may have expired or been tampered with.</p>
          </div>
        )
      }
      if (tokenPayload.jobId !== jobId) {
        console.error('[PRINT] job mismatch', { params: jobId, token: tokenPayload.jobId })
        return (
          <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
            <h1>403 - Token Mismatch</h1>
            <p>Token job ID does not match the requested job.</p>
          </div>
        )
      }
      console.log('[PRINT] Token verified successfully', { organizationId: tokenPayload.organizationId })
      organization_id = tokenPayload.organizationId
    } else {
      console.log('[PRINT] token missing - using cookie auth')
      // Otherwise, use cookie-based auth (for browser access)
      const supabase = await createSupabaseServerClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('[PRINT] user not authenticated')
        return (
          <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
            <h1>401 - Unauthorized</h1>
            <p>Please log in to view this report.</p>
          </div>
        )
      }

      // Get user's organization
      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', user.id)
        .maybeSingle()

      if (!userData?.organization_id) {
        console.error('[PRINT] user missing organization_id')
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
      console.error('[PRINT] organization_id is null after auth')
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
      : await createSupabaseServerClient()
    
    console.log('[PRINT] Using supabase client:', rawToken ? 'service-role (token auth)' : 'server-client (cookie auth)')

    // If report_run_id is provided, use frozen data from that run
    // Otherwise, use current live data (for draft generation)
    let reportData: JobReportPayload
    let reportRun: {
      id: string
      data_hash: string
      status: string
      generated_at: string
    } | null = null

    if (report_run_id) {
      // Fetch report_run to get frozen snapshot info
      try {
        const { data: run, error: runError } = await supabase
          .from('report_runs')
          .select('id, data_hash, status, generated_at')
          .eq('id', report_run_id)
          .eq('organization_id', organization_id)
          .maybeSingle()

        if (runError) {
          console.error('[PRINT] report_run lookup error', runError)
        } else if (run) {
          reportRun = run
          console.log('[PRINT] report_run found', { id: run.id, status: run.status })
        } else {
          console.warn('[PRINT] report_run not found', { id: report_run_id, organization_id })
        }
      } catch (error) {
        console.error('[PRINT] report_run lookup failed', error)
        // Non-fatal, continue with live data
      }
    }

    // Build report data (this will be current/live data)
    // Note: For production hardening, you might want to store the full payload
    // in report_runs and use that instead, but for now we use live data
    // and rely on hash verification via the verify endpoint
    try {
      console.log('[PRINT] Building report data...', { organization_id, jobId, usingServiceRole: !!rawToken })
      // Pass the supabase client to buildJobReport so it uses service role for token-based access
      reportData = await buildJobReport(organization_id, jobId, supabase)
      console.log('[PRINT] Report data built successfully')
    } catch (error: any) {
      console.error('[PRINT] buildJobReport threw', error?.message || error)
      throw error // Re-throw to be caught by outer try-catch as 500
    }

    if (!reportData.job) {
      console.error('[PRINT] reportData.job is missing')
      return (
        <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
          <h1>404 - Job Not Found</h1>
          <p>The requested job could not be found.</p>
        </div>
      )
    }

    // If report_run exists and is final, log a warning if data might have changed
    // (In production, consider using stored payload instead of live data)
    if (reportRun && reportRun.status === 'final') {
      const { computeCanonicalHash } = await import('@/lib/utils/canonicalJson')
      const currentHash = computeCanonicalHash(reportData)
      if (currentHash !== reportRun.data_hash) {
        console.warn(
          `[PRINT] Final report_run ${reportRun.id} data mismatch - using live data (hash changed)`
        )
      }
    }

    const { job, risk_score, mitigations, documents, organization, audit } = reportData
    const hazardsCount = risk_score?.factors?.length || 0
    const controlsCount = mitigations.length
    const completedControls = mitigations.filter((m) => m.done || m.is_completed).length
    const photos = documents.filter((doc) => doc.type === 'photo')
    const photosCount = photos.length
    const riskLevel = risk_score?.risk_level || 'unknown'
    const riskScoreValue = risk_score?.overall_score || 0
    const riskColor = getRiskColor(riskLevel)
    const isDraft = job.status === 'draft' || job.status === 'pending'

    // Get logo if available
    const logoUrl = organization?.logo_url || null

    // Fetch signatures if report_run_id is provided
    let signatures: Array<{
      id: string
      signer_name: string
      signer_title: string
      signature_role: string
      signature_svg: string
      signed_at: string
    }> = []

    if (report_run_id) {
    try {
      // Fetch signatures
      const { data: sigs, error: sigError } = await supabase
        .from('report_signatures')
        .select('*')
        .eq('report_run_id', report_run_id)
        .is('revoked_at', null)
        .order('signed_at', { ascending: true })

      if (!sigError && sigs) {
        signatures = sigs
      }
    } catch (error) {
      console.error('Failed to fetch signatures:', error)
    }
    }

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <title>Risk Snapshot Report - {job.job_type}</title>
          <style dangerouslySetInnerHTML={{ __html: printStyles(colors) }} />
        </head>
        <body className="print-body">
        <div className="report-root" data-draft={isDraft ? 'true' : undefined}>
          <div className="report-content">
            {/* Cover Page - Dark branded deck */}
            <div className="cover-page">
          <div className="cover-header">
            {logoUrl && (
              <img src={logoUrl} alt="Logo" className="cover-logo" />
            )}
            <div className="cover-brand">RiskMate</div>
          </div>

          <h1 className="cover-title">Risk Snapshot Report</h1>
          <div className="cover-accent-line"></div>

          <div className="cover-subheader">
            <span>{job.job_type || 'N/A'}</span>
            <span>•</span>
            <span>{job.location || 'N/A'}</span>
            <span>•</span>
            <span>Job ID: {job.id.substring(0, 8).toUpperCase()}</span>
            <span>•</span>
            <span>Generated: {formatDate(new Date().toISOString())}</span>
          </div>

          <div className="cover-kpis">
            <div className="kpi-pill kpi-pill-risk" data-pill="kpi" style={{ borderColor: riskColor }}>
              <div className="kpi-value" data-pill-value="true" style={{ color: riskColor }}>
                {riskScoreValue}
              </div>
              <div className="kpi-label" data-pill-label="true" style={{ color: riskColor }}>
                {riskLevel.toUpperCase()}
              </div>
            </div>

            <div className="kpi-pill" data-pill="kpi">
              <div className="kpi-value" data-pill-value="true">{hazardsCount}</div>
              <div className="kpi-label" data-pill-label="true">Hazards</div>
            </div>

            <div className="kpi-pill" data-pill="kpi">
              <div className="kpi-value" data-pill-value="true">
                {controlsCount === 0 ? '—' : `${completedControls}/${controlsCount}`}
              </div>
              <div className="kpi-label" data-pill-label="true">Controls</div>
            </div>

            <div className="kpi-pill" data-pill="kpi">
              <div className="kpi-value" data-pill-value="true">{photosCount}</div>
              <div className="kpi-label" data-pill-label="true">Photos</div>
            </div>

            <div className="kpi-pill" data-pill="status">
              <div className="kpi-value" data-pill-value="true">{job.status.toUpperCase()}</div>
              <div className="kpi-label" data-pill-label="true">Status</div>
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="page">
          <h2 className="section-header">Executive Summary</h2>

          <p className="overview-text">
            {job.description ||
              `This safety report summarizes the ${job.job_type} job performed at ${job.location} for ${job.client_name}. ` +
                `A total of ${hazardsCount} hazard${hazardsCount !== 1 ? 's' : ''} ${hazardsCount === 1 ? 'was' : 'were'} identified, ` +
                `with ${completedControls} of ${controlsCount} control measure${controlsCount !== 1 ? 's' : ''} applied by the assigned crew. ` +
                `The overall risk level for this job is classified as ${riskLevel.toUpperCase()}.`}
          </p>

          <div className="two-column-layout">
            {/* Left Column: Job Details */}
            <div className="column-card">
              <h3 className="card-title">Job Details</h3>
              <div className="detail-list">
                <div className="detail-item">
                  <strong>Client:</strong> {job.client_name}
                </div>
                <div className="detail-item">
                  <strong>Location:</strong> {job.location}
                </div>
                <div className="detail-item">
                  <strong>Job Type:</strong> {job.job_type}
                </div>
                <div className="detail-item">
                  <strong>Duration:</strong>{' '}
                  {job.start_date && job.end_date
                    ? `${formatDate(job.start_date)} - ${formatDate(job.end_date)}`
                    : job.start_date
                    ? `Started: ${formatDate(job.start_date)}`
                    : 'N/A'}
                </div>
                <div className="detail-item">
                  <strong>Status:</strong> {job.status}
                </div>
              </div>
            </div>

            {/* Right Column: Risk Block */}
            <div className="column-card risk-card" style={{ borderLeftColor: riskColor }}>
              <h3 className="card-title">Risk Assessment</h3>
              <div className="risk-score-display">
                <div className="risk-score-value" style={{ color: riskColor }}>
                  {riskScoreValue}
                </div>
                <div className="risk-badge" style={{ backgroundColor: riskColor + '20', borderColor: riskColor, color: riskColor }}>
                  {riskLevel.toUpperCase()}
                </div>
              </div>
              {risk_score?.factors && risk_score.factors.length > 0 && (
                <div className="risk-drivers">
                  <div className="risk-drivers-label">Top Drivers:</div>
                  {risk_score.factors.slice(0, 3).map((factor: any, idx: number) => (
                    <div key={idx} className="risk-driver-item">
                      • {factor.name || factor.code || 'Unknown'}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Key Findings */}
          {risk_score?.factors && risk_score.factors.length > 0 && (
            <div className="key-findings">
              <h3 className="findings-title">Key Findings</h3>
              {risk_score.factors.slice(0, 5).map((factor: any, idx: number) => {
                const severity = factor.severity || 'low'
                const severityColor = getSeverityColor(severity)
                return (
                  <div key={idx} className="finding-item">
                    <div className="finding-severity-dot" style={{ backgroundColor: severityColor }}></div>
                    <div className="finding-content">
                      <div className="finding-name">{factor.name || factor.code || 'Unknown Hazard'}</div>
                      {factor.description && (
                        <div className="finding-description">{factor.description}</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Hazard Checklist */}
        {risk_score?.factors && risk_score.factors.length > 0 && (
          <div className="page">
            <h2 className="section-header">Hazard Checklist</h2>
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Hazard</th>
                  <th>Severity</th>
                  <th>Present</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {risk_score.factors.map((factor: any, idx: number) => {
                  const severity = factor.severity || 'low'
                  const severityColor = getSeverityColor(severity)
                  return (
                    <tr key={idx} className={idx % 2 === 0 ? 'even-row' : ''}>
                      <td>{factor.name || factor.code || 'Unknown'}</td>
                      <td>
                        <span className="severity-badge" style={{ backgroundColor: severityColor + '40', color: severityColor }}>
                          {severity.toUpperCase()}
                        </span>
                      </td>
                      <td>Yes</td>
                      <td>{factor.description || 'None'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Controls Applied */}
        {mitigations.length > 0 && (
          <div className="page">
            <h2 className="section-header">Controls Applied</h2>
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Control</th>
                  <th>Applied?</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {mitigations.map((item: any, idx: number) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'even-row' : ''}>
                    <td>{item.title || 'Untitled Control'}</td>
                    <td>{item.done || item.is_completed ? 'Yes' : 'No'}</td>
                    <td>{item.description || 'None'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Signatures & Compliance */}
        <div className="page">
          <h2 className="section-header">Signatures & Compliance</h2>
          
          {/* Render actual signatures if available */}
          {signatures.length > 0 ? (
            <div className="signatures-grid">
              {signatures.map((sig) => {
                const roleLabels: Record<string, string> = {
                  prepared_by: 'Prepared By',
                  reviewed_by: 'Reviewed By',
                  approved_by: 'Approved By',
                  other: 'Signature',
                }
                return (
                  <div key={sig.id} className="signature-box">
                    <div className="signature-label">{roleLabels[sig.signature_role] || 'Signature'}</div>
                    <div 
                      className="signature-svg-container"
                      dangerouslySetInnerHTML={{ __html: sig.signature_svg }}
                    />
                    <div className="signature-field"><strong>Name:</strong> {sig.signer_name}</div>
                    <div className="signature-field"><strong>Title:</strong> {sig.signer_title}</div>
                    <div className="signature-field">
                      <strong>Date:</strong> {formatDate(sig.signed_at)} at {formatTime(sig.signed_at)}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="signatures-grid">
              {['Prepared By', 'Reviewed By', 'Approved By', 'Other'].map((label, i) => (
                <div key={i} className="signature-box">
                  <div className="signature-line"></div>
                  <div className="signature-label">{label}</div>
                  <div className="signature-field">Printed Name: _________________</div>
                  <div className="signature-field">Crew Role: _________________</div>
                  <div className="signature-field">Date: _________________</div>
                </div>
              ))}
            </div>
          )}

          <div className="compliance-callout">
            <h3 className="callout-title">Compliance Statement</h3>
            <p className="callout-text">
              This report was generated through RiskMate and includes all safety, hazard, and control
              documentation submitted by the assigned crew. All data is timestamped and stored securely.
              This documentation serves as evidence of compliance with safety protocols and regulatory requirements.
            </p>
          </div>

          <div className="document-meta">
            <div>Prepared by RiskMate</div>
            {reportRun && (
              <>
                <div>Report Run ID: {reportRun.id.substring(0, 8).toUpperCase()}</div>
                <div>Document Hash: {reportRun.data_hash.substring(0, 12).toUpperCase()}</div>
                <div>Generated: {formatDate(reportRun.generated_at)} at {formatTime(reportRun.generated_at)}</div>
                <div>Status: {reportRun.status.toUpperCase()}</div>
              </>
            )}
            {!reportRun && <div>Document ID: {job.id.substring(0, 8).toUpperCase()}</div>}
          </div>

          {/* Audit Trail */}
          {reportRun && signatures.length > 0 && (
            <div className="audit-trail">
              <h3 className="audit-title">Signature Audit Trail</h3>
              {signatures.map((sig) => (
                <div key={sig.id} className="audit-entry">
                  <div className="audit-role">{sig.signer_name} ({sig.signer_title})</div>
                  <div className="audit-details">
                    Signed as {sig.signature_role.replace('_', ' ')} on {formatDate(sig.signed_at)} at {formatTime(sig.signed_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

            {/* PDF Ready Marker - Used by Playwright to detect when page is fully loaded */}
            <div id="pdf-ready" data-ready="true" aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }} />
          </div>
        </div>
        </body>
      </html>
    )
  } catch (error: any) {
    const errorMessage = error?.message || String(error)
    const errorStack = error?.stack
    console.error('[PRINT] Unexpected error:', errorMessage)
    console.error('[PRINT] Error stack:', errorStack)
    console.error('[PRINT] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
    
    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <title>Error - Report Generation Failed</title>
        </head>
        <body style={{ padding: '20px', fontFamily: 'system-ui', backgroundColor: '#fff' }}>
          <h1 style={{ color: '#d32f2f' }}>500 - Internal Server Error</h1>
          <p>An unexpected error occurred while generating the report.</p>
          <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
            <h2 style={{ fontSize: '14px', marginTop: 0 }}>Error Details:</h2>
            <pre style={{ fontSize: '12px', color: '#666', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {errorMessage}
            </pre>
            {errorStack && (
              <details style={{ marginTop: '10px' }}>
                <summary style={{ cursor: 'pointer', fontSize: '12px', color: '#666' }}>Stack Trace</summary>
                <pre style={{ fontSize: '11px', color: '#999', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: '5px' }}>
                  {errorStack}
                </pre>
              </details>
            )}
          </div>
        </body>
      </html>
    )
  }
}

// Print styles with RiskMate branding, proper watermark layering, and CSS print rules
const printStyles = (colors: typeof import('@/lib/design-system/tokens').colors) => `
  @page {
    size: A4;
    margin: 16mm;
  }

  * {
    box-sizing: border-box;
  }

  @media print {
    /* Nuclear print reset - kill all transforms, filters, and positioning that break stacking */
    * {
      transform: none !important;
      filter: none !important;
    }

    /* Print reset - kill all screen-height rules from Tailwind/app CSS */
    *,
    body,
    html,
    #__next,
    main {
      min-height: auto !important;
      height: auto !important;
      max-height: none !important;
    }

    /* Reset any containers that might have screen-height classes */
    .cover-page,
    .page,
    section,
    div[class*="min-h"],
    div[class*="h-screen"],
    div[class*="h-full"] {
      min-height: auto !important;
      height: auto !important;
    }

    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color: ${colors.black};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.4;
      background: ${colors.white};
      margin: 0;
      padding: 0;
    }

    /* Report root - watermark pseudo-element lives here for proper stacking */
    .report-root {
      position: relative !important;
    }

    /* Watermark as pseudo-element on root - can't be broken by stacking contexts */
    .report-root[data-draft="true"]::before {
      content: 'DRAFT';
      position: fixed !important;
      inset: 0 !important;
      display: grid !important;
      place-items: center !important;
      z-index: 0 !important;
      opacity: 0.08 !important;
      pointer-events: none !important;
      color: ${colors.black};
      user-select: none;
      font-size: 120px !important;
      font-weight: 700 !important;
      letter-spacing: 0.08em !important;
      /* Use CSS transform only for watermark rotation (allowed exception) */
      transform: rotate(-25deg) !important;
    }

    /* Report content - above watermark */
    .report-content {
      position: relative !important;
      z-index: 1 !important;
    }

    /* Kill old watermark class (shouldn't be used anymore, but just in case) */
    .watermark,
    .draft-watermark {
      display: none !important;
    }

    /* All content pages have z-index above watermark */
    .page {
      position: relative !important;
      z-index: 2 !important;
      page-break-before: always;
      break-inside: avoid;
      background: ${colors.white} !important;
      padding: 40pt 0; /* consistent padding */
    }

    /* Cover page - no watermark, branded deck mode - force block layout */
    .cover-page {
      position: relative !important;
      z-index: 1 !important; /* Same z-index as report-content */
      page-break-after: always;
      break-after: page;
      min-height: 0 !important;
      height: auto !important;
      display: block !important; /* Force block, not flex */
      justify-content: unset !important;
      align-items: unset !important;
      margin: 0 !important;
      padding: 40pt 16mm !important;
      background: #121212 !important; /* Hardcoded dark for print consistency */
      color: ${colors.white};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      break-inside: avoid;
    }

    /* Kill flex spacing on cover and all ancestors */
    .cover-page.flex,
    .cover-page[class*="flex"],
    .report-content[class*="flex"],
    .report-root[class*="flex"] {
      display: block !important;
    }

    .section-header {
      page-break-after: avoid;
      break-after: avoid;
      margin-top: 0;
    }

    /* Prevent table row splits - keep rows together */
    table,
    thead,
    tbody,
    tr,
    td,
    th {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }

    thead {
      display: table-header-group;
    }

    /* Ensure cards and sections don't break awkwardly */
    .column-card,
    .risk-card,
    .compliance-callout,
    .audit-entry {
      break-inside: avoid;
      page-break-inside: avoid;
    }
  }

  /* Cover page styles - dark branded deck */
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

  .cover-kpis {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12pt;
    margin-top: auto;
    break-inside: avoid;
  }

  /* For print, ensure KPI pills don't wrap awkwardly */
  @media print {
    .cover-kpis {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important; /* 2-col always, flexible */
      gap: 10mm !important;
    }

    .kpi-pill,
    .kpi-card {
      display: flex !important;
      flex-direction: column !important;
      align-items: flex-start !important;
      justify-content: flex-start !important;
      gap: 2mm !important;
      padding: 5mm 6mm !important;
      position: relative !important; /* Reset any absolute positioning */
      min-width: 0 !important; /* Allow grid items to shrink below content size */
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }

    /* Kill any absolute positioning inside KPI content */
    .kpi-pill *,
    .kpi-card * {
      position: static !important;
    }

    /* Hard-lock KPI value typography for print */
    .kpi-pill .kpi-value,
    .kpi-pill .value,
    .kpi-card .kpi-value,
    .kpi-card .value {
      font-size: 18pt !important;       /* Smaller, fixed size */
      line-height: 1.05 !important;     /* Tight line height */
      font-weight: 700 !important;
      white-space: nowrap !important;   /* Prevents DRA / FT split */
      letter-spacing: 0 !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }

    /* Status pill gets even smaller text */
    .kpi-pill--status .kpi-value,
    .kpi-pill--status .value,
    .kpi-pill .kpi-value[data-status],
    .kpi-pill .value[data-status] {
      font-size: 14pt !important;
      white-space: nowrap !important;
      letter-spacing: 0.06em !important;
    }

    /* Hard-lock KPI label typography for print */
    .kpi-pill .kpi-label,
    .kpi-pill .label,
    .kpi-card .kpi-label,
    .kpi-card .label {
      font-size: 9pt !important;
      line-height: 1.2 !important;
      white-space: normal !important;
      overflow-wrap: anywhere !important;
      word-wrap: break-word !important;
      opacity: 0.85 !important;
    }
  }

  /* Bulletproof KPI pills - explicit colors, fixed dimensions */
  .kpi-pill {
    min-width: 100pt;
    border: 1.5pt solid ${colors.gray700};
    border-radius: 8pt;
    padding: 16pt 12pt;
    text-align: center;
    background-color: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(10px);
    break-inside: avoid;
    page-break-inside: avoid;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .kpi-pill .label,
  .kpi-pill .kpi-label {
    white-space: normal;
    overflow-wrap: anywhere;
    word-break: break-word;
    line-height: 1.3;
  }

  .kpi-pill .value,
  .kpi-pill .kpi-value {
    white-space: normal;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .kpi-pill-risk {
    border-color: ${colors.cordovan};
    background-color: rgba(145, 47, 64, 0.4) !important; /* Ensure visibility on print */
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .kpi-value {
    font-size: 32pt;
    font-weight: 700;
    color: ${colors.white};
    margin-bottom: 8pt;
    line-height: 1.2;
    min-height: 38pt;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .kpi-label {
    font-size: 9pt;
    color: ${colors.gray300};
    text-transform: uppercase;
    letter-spacing: 0.1em;
    line-height: 1.4;
    font-weight: 600;
  }

  /* Content page styles - clean compliance look */
  .section-header {
    font-size: 22pt;
    font-weight: bold;
    color: ${colors.black};
    margin-bottom: 24pt;
    padding-bottom: 8pt;
    border-bottom: 2pt solid ${colors.cordovan};
  }

  .overview-text {
    margin-bottom: 24pt;
    line-height: 1.6;
    color: ${colors.gray700};
  }

  .two-column-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20pt;
    margin-bottom: 32pt;
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

  .risk-score-display {
    text-align: center;
    margin: 20pt 0;
  }

  .risk-score-value {
    font-size: 42pt;
    font-weight: bold;
    margin-bottom: 16pt;
    line-height: 1.2;
  }

  .risk-badge {
    display: inline-block;
    padding: 6pt 20pt;
    border-radius: 11pt;
    border: 1.5pt solid;
    font-size: 11pt;
    font-weight: bold;
  }

  .risk-drivers {
    margin-top: 16pt;
    font-size: 9pt;
    color: ${colors.gray600};
  }

  .risk-drivers-label {
    font-weight: bold;
    margin-bottom: 8pt;
    color: ${colors.black};
  }

  .risk-driver-item {
    margin-left: 8pt;
    margin-bottom: 4pt;
  }

  .key-findings {
    margin-top: 32pt;
  }

  .findings-title {
    font-size: 16pt;
    font-weight: bold;
    color: ${colors.black};
    margin-bottom: 16pt;
  }

  .finding-item {
    display: flex;
    gap: 12pt;
    margin-bottom: 16pt;
  }

  .finding-severity-dot {
    width: 10pt;
    height: 10pt;
    border-radius: 50%;
    margin-top: 6pt;
    flex-shrink: 0;
  }

  .finding-name {
    font-weight: bold;
    font-size: 11pt;
    color: ${colors.black};
    margin-bottom: 4pt;
  }

  .finding-description {
    font-size: 10.5pt;
    color: ${colors.gray600};
    line-height: 1.5;
  }

  /* Audit-grade tables */
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
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 9pt;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .audit-table td {
    padding: 10pt 8pt;
    color: ${colors.gray700};
    border-bottom: 0.5pt solid ${colors.borderLight};
  }

  .audit-table .even-row {
    background-color: ${colors.bgSecondary};
  }

  .severity-badge {
    display: inline-block;
    padding: 3pt 8pt;
    border-radius: 3pt;
    font-size: 8.5pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .signatures-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20pt;
    margin-bottom: 32pt;
  }

  .signature-box {
    border: 1.5pt solid ${colors.borderLight};
    border-radius: 6pt;
    padding: 15pt;
    background-color: ${colors.white};
    min-height: 90pt;
  }

  .signature-line {
    border-top: 1pt dashed ${colors.gray500};
    margin-bottom: 8pt;
  }

  .signature-svg-container {
    margin: 8pt 0;
    padding: 8pt;
    border: 1pt solid ${colors.borderLight};
    border-radius: 4pt;
    background-color: ${colors.white};
    min-height: 60pt;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .signature-svg-container svg {
    max-width: 100%;
    max-height: 80pt;
  }

  .signature-label {
    font-size: 9pt;
    color: ${colors.gray600};
    margin-bottom: 12pt;
    font-weight: 600;
  }

  .signature-field {
    font-size: 11pt;
    color: ${colors.black};
    margin-bottom: 8pt;
  }

  .compliance-callout {
    border: 1.5pt solid ${colors.borderLight};
    border-radius: 6pt;
    padding: 16pt;
    background-color: ${colors.bgSecondary};
    margin-bottom: 24pt;
  }

  .callout-title {
    font-size: 14pt;
    font-weight: bold;
    color: ${colors.black};
    margin-bottom: 12pt;
  }

  .callout-text {
    font-size: 11pt;
    color: ${colors.gray700};
    line-height: 1.6;
  }

  .document-meta {
    font-size: 9pt;
    color: ${colors.gray600};
    display: flex;
    flex-direction: column;
    gap: 4pt;
  }

  .audit-trail {
    margin-top: 24pt;
    padding-top: 16pt;
    border-top: 1pt solid ${colors.borderLight};
  }

  .audit-title {
    font-size: 12pt;
    font-weight: bold;
    color: ${colors.black};
    margin-bottom: 12pt;
  }

  .audit-entry {
    margin-bottom: 12pt;
    padding: 8pt;
    background-color: ${colors.bgSecondary};
    border-radius: 4pt;
    border-left: 3pt solid ${colors.cordovan};
  }

  .audit-role {
    font-size: 10pt;
    font-weight: 600;
    color: ${colors.black};
    margin-bottom: 4pt;
  }

  .audit-details {
    font-size: 9pt;
    color: ${colors.gray600};
  }
`
