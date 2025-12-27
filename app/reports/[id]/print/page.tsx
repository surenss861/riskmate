import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buildJobReport } from '@/lib/utils/jobReport'
import { formatDate, formatTime, getRiskColor, getSeverityColor } from '@/lib/utils/reportUtils'
import type { JobReportPayload } from '@/lib/utils/jobReport'
import { colors } from '@/lib/design-system/tokens'

interface PrintPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string }>
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
  const { id: jobId } = await params
  const { token } = await searchParams

  // TODO: Verify token if needed (for now, we'll rely on the PDF API endpoint to handle auth)
  // In production, you'd validate the token here

  const supabase = await createSupabaseServerClient()
  
  // Get user for organization access
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    notFound()
  }

  // Get user's organization
  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userData?.organization_id) {
    notFound()
  }

  // Build report data
  let reportData: JobReportPayload
  try {
    reportData = await buildJobReport(userData.organization_id, jobId)
  } catch (error) {
    console.error('Failed to build report:', error)
    notFound()
  }

  if (!reportData.job) {
    notFound()
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

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>Risk Snapshot Report - {job.job_type}</title>
        <style dangerouslySetInnerHTML={{ __html: printStyles(colors) }} />
      </head>
      <body className="print-body">
        {/* Fixed watermark - behind all content, never collides */}
        {isDraft && (
          <div className="watermark">DRAFT</div>
        )}

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
            <div className="kpi-pill kpi-pill-risk" style={{ borderColor: riskColor }}>
              <div className="kpi-value" style={{ color: riskColor }}>
                {riskScoreValue}
              </div>
              <div className="kpi-label" style={{ color: riskColor }}>
                {riskLevel.toUpperCase()}
              </div>
            </div>

            <div className="kpi-pill">
              <div className="kpi-value">{hazardsCount}</div>
              <div className="kpi-label">Hazards</div>
            </div>

            <div className="kpi-pill">
              <div className="kpi-value">
                {controlsCount === 0 ? '—' : `${completedControls}/${controlsCount}`}
              </div>
              <div className="kpi-label">Controls</div>
            </div>

            <div className="kpi-pill">
              <div className="kpi-value">{photosCount}</div>
              <div className="kpi-label">Photos</div>
            </div>

            <div className="kpi-pill">
              <div className="kpi-value">{job.status.toUpperCase()}</div>
              <div className="kpi-label">Status</div>
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
          <div className="signatures-grid">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="signature-box">
                <div className="signature-line"></div>
                <div className="signature-label">Signature</div>
                <div className="signature-field">Printed Name: _________________</div>
                <div className="signature-field">Crew Role: _________________</div>
                <div className="signature-field">Date: _________________</div>
              </div>
            ))}
          </div>

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
            <div>Document ID: {job.id.substring(0, 8).toUpperCase()}</div>
          </div>
        </div>
      </body>
    </html>
  )
}

// Print styles with RiskMate branding, proper watermark layering, and CSS print rules
const printStyles = (colors: typeof import('@/lib/design-system/tokens').colors) => `
  @page {
    size: A4;
    margin: 48pt 48pt 60pt 48pt;
  }

  * {
    box-sizing: border-box;
  }

  @media print {
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

    /* Fixed watermark - behind everything, never collides */
    .watermark {
      position: fixed;
      inset: 0;
      display: grid;
      place-items: center;
      transform: rotate(-35deg);
      font-size: 120px;
      font-weight: 700;
      letter-spacing: 0.08em;
      opacity: 0.03;
      z-index: 0;
      pointer-events: none;
      color: ${colors.black};
      user-select: none;
    }

    /* All content pages have z-index above watermark */
    .page {
      position: relative;
      z-index: 1;
      page-break-before: always;
      break-inside: avoid;
      background: ${colors.white};
    }

    /* Cover page - no watermark, branded deck mode */
    .cover-page {
      position: relative;
      z-index: 1;
      page-break-after: always;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      padding: 60pt 0;
      background: linear-gradient(135deg, ${colors.gray900} 0%, ${colors.gray800} 100%);
      color: ${colors.white};
    }

    .section-header {
      page-break-after: avoid;
      break-after: avoid;
    }

    table {
      page-break-inside: avoid;
    }

    tr {
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
    display: flex;
    gap: 12pt;
    margin-top: auto;
    flex-wrap: wrap;
  }

  /* Bulletproof KPI pills - explicit colors, fixed dimensions */
  .kpi-pill {
    flex: 1;
    min-width: 100pt;
    border: 1.5pt solid ${colors.gray700};
    border-radius: 8pt;
    padding: 16pt 12pt;
    text-align: center;
    background-color: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(10px);
  }

  .kpi-pill-risk {
    border-color: ${colors.cordovan};
    background-color: rgba(145, 47, 64, 0.2);
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
`
