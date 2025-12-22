import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { getRequestId } from '@/lib/utils/requestId'
import { createSuccessResponse, createErrorResponse } from '@/lib/utils/apiResponse'

export const runtime = 'nodejs'

/**
 * Readiness Rule Codes
 * Each rule has a code, severity, and explanation
 */
export type ReadinessRuleCode =
  | 'EVIDENCE.MISSING.HIGH_RISK'
  | 'EVIDENCE.MISSING.MATERIAL'
  | 'ATTESTATION.MISSING.HIGH_RISK'
  | 'ATTESTATION.MISSING.MATERIAL'
  | 'CONTROL.OVERDUE.CRITICAL'
  | 'CONTROL.OVERDUE.MATERIAL'
  | 'INCIDENT.OPEN'
  | 'REVIEW_ITEM.OPEN'
  | 'ACCESS_VIOLATION.LOGGED'

export type ReadinessItemCategory = 'evidence' | 'controls' | 'attestations' | 'incidents' | 'access'
export type FixActionType = 'upload_evidence' | 'request_attestation' | 'complete_controls' | 'resolve_incident' | 'review_item'

interface ReadinessItem {
  id: string
  rule_code: ReadinessRuleCode
  rule_name: string
  category: ReadinessItemCategory
  severity: 'critical' | 'material' | 'info'
  affected_type: 'work_record' | 'control' | 'attestation' | 'incident' | 'review_item'
  affected_id: string
  affected_name?: string
  work_record_id?: string
  work_record_name?: string
  site_id?: string
  site_name?: string
  owner_id?: string
  owner_name?: string
  due_date?: string
  status: 'open' | 'in_progress' | 'waived' | 'resolved'
  why_it_matters: string
  fix_action_type: FixActionType
  metadata?: any
  created_at?: string
  updated_at?: string
}

interface ReadinessSummary {
  total_items: number
  critical_blockers: number
  material: number
  info: number
  resolved: number
  audit_ready_score: number // 0-100
  estimated_time_to_clear_hours?: number
  oldest_overdue_date?: string
  category_breakdown: {
    evidence: number
    controls: number
    attestations: number
    incidents: number
    access: number
  }
}

interface ReadinessResponse {
  summary: ReadinessSummary
  items: ReadinessItem[]
}

/**
 * GET /api/audit/readiness
 * Returns audit readiness items with standardized rule codes and fix actions
 * Supports filters: time_range, category, severity, job_id, site_id, owner_id, status
 */
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request)

  try {
    let organization_id: string
    try {
      const context = await getOrganizationContext()
      organization_id = context.organization_id
    } catch (authError: any) {
      console.error('[audit/readiness] Auth error:', {
        message: authError.message,
        requestId,
      })
      return NextResponse.json(
        createErrorResponse('Unauthorized: Please log in', 'UNAUTHORIZED', { requestId, statusCode: 401 }),
        { status: 401, headers: { 'X-Request-ID': requestId } }
      )
    }

    const { searchParams } = request.nextUrl
    const time_range = searchParams.get('time_range') || '30d'
    const category = searchParams.get('category') as ReadinessItemCategory | null
    const severity = searchParams.get('severity') as 'critical' | 'material' | 'info' | null
    const job_id = searchParams.get('job_id')
    const site_id = searchParams.get('site_id')
    const owner_id = searchParams.get('owner_id')
    const status = searchParams.get('status') as 'open' | 'in_progress' | 'waived' | 'resolved' | null

    const supabase = await createSupabaseServerClient()

    // Calculate time cutoff
    const now = new Date()
    let cutoff = new Date()
    if (time_range === '24h') {
      cutoff.setHours(now.getHours() - 24)
    } else if (time_range === '7d') {
      cutoff.setDate(now.getDate() - 7)
    } else if (time_range === '30d') {
      cutoff.setDate(now.getDate() - 30)
    } else if (time_range === '90d') {
      cutoff.setDate(now.getDate() - 90)
    }
    // 'all' means no cutoff

    const items: ReadinessItem[] = []

    // 1. MISSING EVIDENCE (high-risk work records without documents)
    if (!category || category === 'evidence') {
      let evidenceQuery = supabase
        .from('jobs')
        .select('id, client_name, risk_score, risk_level, site_id, owner_id, created_at')
        .eq('organization_id', organization_id)
        .is('deleted_at', null)
        .gt('risk_score', 50) // Only medium+ risk need evidence

      if (time_range !== 'all') {
        evidenceQuery = evidenceQuery.gte('created_at', cutoff.toISOString())
      }
      if (job_id) {
        evidenceQuery = evidenceQuery.eq('id', job_id)
      }
      if (site_id) {
        evidenceQuery = evidenceQuery.eq('site_id', site_id)
      }
      if (owner_id) {
        evidenceQuery = evidenceQuery.eq('owner_id', owner_id)
      }

      const { data: highRiskJobs } = await evidenceQuery

      if (highRiskJobs) {
        for (const job of highRiskJobs) {
          // Check for documents (job_documents table)
          const { count: docCount } = await supabase
            .from('job_documents')
            .select('id', { count: 'exact', head: true })
            .eq('job_id', job.id)

          if (!docCount || docCount === 0) {
            const isCritical = (job.risk_score || 0) > 75
            if (severity && severity !== (isCritical ? 'critical' : 'material')) {
              continue
            }

            // Get owner info
            let ownerName: string | undefined
            if (job.owner_id) {
              const { data: ownerData } = await supabase
                .from('users')
                .select('full_name, email')
                .eq('id', job.owner_id)
                .single()
              ownerName = ownerData?.full_name || ownerData?.email
            }

            items.push({
              id: `evidence-missing-${job.id}`,
              rule_code: isCritical ? 'EVIDENCE.MISSING.HIGH_RISK' : 'EVIDENCE.MISSING.MATERIAL',
              rule_name: `Missing Evidence for High-Risk Work Record`,
              category: 'evidence',
              severity: isCritical ? 'critical' : 'material',
              affected_type: 'work_record',
              affected_id: job.id,
              affected_name: job.client_name,
              work_record_id: job.id,
              work_record_name: job.client_name,
              site_id: job.site_id || undefined,
              owner_id: job.owner_id || undefined,
              owner_name: ownerName,
              status: 'open',
              why_it_matters: `High-risk work records require evidence documentation for audit defensibility and insurance compliance. Missing evidence increases audit exposure and may impact claims processing.`,
              fix_action_type: 'upload_evidence',
              created_at: job.created_at,
            })
          }
        }
      }
    }

    // 2. MISSING ATTESTATIONS (high-risk work records without sign-offs)
    if (!category || category === 'attestations') {
      let attestationQuery = supabase
        .from('jobs')
        .select('id, client_name, risk_score, owner_id, created_at')
        .eq('organization_id', organization_id)
        .is('deleted_at', null)
        .gt('risk_score', 75) // Only high-risk need attestations

      if (time_range !== 'all') {
        attestationQuery = attestationQuery.gte('created_at', cutoff.toISOString())
      }
      if (job_id) {
        attestationQuery = attestationQuery.eq('id', job_id)
      }
      if (owner_id) {
        attestationQuery = attestationQuery.eq('owner_id', owner_id)
      }

      const { data: criticalJobs } = await attestationQuery

      if (criticalJobs) {
        for (const job of criticalJobs) {
          // Check for signed attestations
          const { count: signoffCount } = await supabase
            .from('job_signoffs')
            .select('id', { count: 'exact', head: true })
            .eq('job_id', job.id)

          if (!signoffCount || signoffCount === 0) {
            if (severity && severity !== 'material') {
              continue
            }

            let ownerName: string | undefined
            if (job.owner_id) {
              const { data: ownerData } = await supabase
                .from('users')
                .select('full_name, email')
                .eq('id', job.owner_id)
                .single()
              ownerName = ownerData?.full_name || ownerData?.email
            }

            items.push({
              id: `attestation-missing-${job.id}`,
              rule_code: 'ATTESTATION.MISSING.HIGH_RISK',
              rule_name: `Missing Attestation for High-Risk Work Record`,
              category: 'attestations',
              severity: 'material',
              affected_type: 'attestation',
              affected_id: job.id,
              affected_name: job.client_name,
              work_record_id: job.id,
              work_record_name: job.client_name,
              owner_id: job.owner_id || undefined,
              owner_name: ownerName,
              status: 'open',
              why_it_matters: `High-risk work records require role-based attestations to demonstrate oversight and accountability. Missing attestations may raise governance concerns during audits.`,
              fix_action_type: 'request_attestation',
              created_at: job.created_at,
            })
          }
        }
      }
    }

    // 3. OVERDUE CONTROLS (mitigation items not completed)
    if (!category || category === 'controls') {
      let controlsQuery = supabase
        .from('jobs')
        .select('id, client_name, risk_score, site_id, owner_id, created_at')
        .eq('organization_id', organization_id)
        .is('deleted_at', null)
        .gt('risk_score', 50)

      if (time_range !== 'all') {
        controlsQuery = controlsQuery.gte('created_at', cutoff.toISOString())
      }
      if (job_id) {
        controlsQuery = controlsQuery.eq('id', job_id)
      }
      if (site_id) {
        controlsQuery = controlsQuery.eq('site_id', site_id)
      }
      if (owner_id) {
        controlsQuery = controlsQuery.eq('owner_id', owner_id)
      }

      const { data: jobsWithControls } = await controlsQuery

      if (jobsWithControls) {
        for (const job of jobsWithControls) {
          // Get incomplete mitigation items
          let mitigationsQuery = supabase
            .from('mitigation_items')
            .select('id, title, done, is_completed, due_date, owner_id, created_at')
            .eq('job_id', job.id)
            .eq('done', false)
            .eq('is_completed', false)

          if (owner_id) {
            mitigationsQuery = mitigationsQuery.eq('owner_id', owner_id)
          }

          const { data: incompleteControls } = await mitigationsQuery

          if (incompleteControls && incompleteControls.length > 0) {
            // Check if any are overdue (due_date < today)
            const today = new Date()
            today.setHours(0, 0, 0, 0)

            const overdueControls = incompleteControls.filter((ctrl: any) => {
              if (!ctrl.due_date) return false
              const dueDate = new Date(ctrl.due_date)
              dueDate.setHours(0, 0, 0, 0)
              return dueDate < today
            })

            if (overdueControls.length > 0) {
              const isCritical = (job.risk_score || 0) > 75 || overdueControls.length > 5
              if (severity && severity !== (isCritical ? 'critical' : 'material')) {
                continue
              }

              const oldestDueDate = overdueControls
                .map((c: any) => c.due_date)
                .sort()[0]

              let ownerName: string | undefined
              const ownerIds = new Set(overdueControls.map((c: any) => c.owner_id).filter(Boolean))
              if (ownerIds.size === 1) {
                const ownerId = Array.from(ownerIds)[0]
                const { data: ownerData } = await supabase
                  .from('users')
                  .select('full_name, email')
                  .eq('id', ownerId)
                  .single()
                ownerName = ownerData?.full_name || ownerData?.email
              }

              items.push({
                id: `control-overdue-${job.id}`,
                rule_code: isCritical ? 'CONTROL.OVERDUE.CRITICAL' : 'CONTROL.OVERDUE.MATERIAL',
                rule_name: `Overdue Controls for Work Record`,
                category: 'controls',
                severity: isCritical ? 'critical' : 'material',
                affected_type: 'control',
                affected_id: job.id, // Group by job
                affected_name: `${overdueControls.length} overdue control${overdueControls.length > 1 ? 's' : ''}`,
                work_record_id: job.id,
                work_record_name: job.client_name,
                site_id: job.site_id || undefined,
                owner_id: ownerIds.size === 1 ? Array.from(ownerIds)[0] : undefined,
                owner_name: ownerName,
                due_date: oldestDueDate,
                status: 'open',
                why_it_matters: `Overdue controls indicate incomplete risk mitigation. Auditors expect all identified controls to be completed or formally waived with justification.`,
                fix_action_type: 'complete_controls',
                metadata: {
                  overdue_count: overdueControls.length,
                  control_ids: overdueControls.map((c: any) => c.id),
                },
                created_at: job.created_at,
              })
            }
          }
        }
      }
    }

    // 4. OPEN INCIDENTS (flagged work records or incidents)
    if (!category || category === 'incidents') {
      let incidentsQuery = supabase
        .from('jobs')
        .select('id, client_name, risk_score, review_flag, flagged_at, site_id, owner_id, created_at')
        .eq('organization_id', organization_id)
        .is('deleted_at', null)
        .eq('review_flag', true)

      if (time_range !== 'all') {
        incidentsQuery = incidentsQuery.gte('flagged_at', cutoff.toISOString())
      }
      if (job_id) {
        incidentsQuery = incidentsQuery.eq('id', job_id)
      }
      if (site_id) {
        incidentsQuery = incidentsQuery.eq('site_id', site_id)
      }
      if (owner_id) {
        incidentsQuery = incidentsQuery.eq('owner_id', owner_id)
      }

      const { data: flaggedJobs } = await incidentsQuery

      if (flaggedJobs) {
        for (const job of flaggedJobs) {
          // Check if incident is already closed (has closure metadata)
          const { data: jobData } = await supabase
            .from('jobs')
            .select('metadata')
            .eq('id', job.id)
            .single()

          const isClosed = jobData?.metadata?.incident_closed?.closed_at

          if (!isClosed) {
            if (severity && severity !== 'critical') {
              continue
            }

            let ownerName: string | undefined
            if (job.owner_id) {
              const { data: ownerData } = await supabase
                .from('users')
                .select('full_name, email')
                .eq('id', job.owner_id)
                .single()
              ownerName = ownerData?.full_name || ownerData?.email
            }

            items.push({
              id: `incident-open-${job.id}`,
              rule_code: 'INCIDENT.OPEN',
              rule_name: `Open Incident`,
              category: 'incidents',
              severity: 'critical',
              affected_type: 'incident',
              affected_id: job.id,
              affected_name: job.client_name,
              work_record_id: job.id,
              work_record_name: job.client_name,
              site_id: job.site_id || undefined,
              owner_id: job.owner_id || undefined,
              owner_name: ownerName,
              status: 'open',
              why_it_matters: `Open incidents must be resolved with root cause analysis, corrective actions, and closure attestations before audit. Unresolved incidents raise significant governance concerns.`,
              fix_action_type: 'resolve_incident',
              created_at: job.flagged_at || job.created_at,
            })
          }
        }
      }
    }

    // 5. ACCESS VIOLATIONS (recent role violations)
    if (!category || category === 'access') {
      let violationsQuery = supabase
        .from('audit_logs')
        .select('id, event_name, job_id, created_at, summary, metadata')
        .eq('organization_id', organization_id)
        .eq('event_name', 'auth.role_violation')
        .eq('category', 'governance')

      if (time_range !== 'all') {
        violationsQuery = violationsQuery.gte('created_at', cutoff.toISOString())
      }
      if (job_id) {
        violationsQuery = violationsQuery.eq('job_id', job_id)
      }

      const { data: violations } = await violationsQuery.limit(20)

      if (violations) {
        for (const violation of violations) {
          if (severity && severity !== 'critical') {
            continue
          }

          items.push({
            id: `access-violation-${violation.id}`,
            rule_code: 'ACCESS_VIOLATION.LOGGED',
            rule_name: `Role Violation Attempt`,
            category: 'access',
            severity: 'critical',
            affected_type: 'review_item',
            affected_id: violation.id,
            affected_name: violation.summary || 'Unauthorized action attempt',
            work_record_id: violation.job_id || undefined,
            status: 'open',
            why_it_matters: `Role violations indicate attempted unauthorized access. These must be reviewed and documented for audit compliance and separation-of-duties proof.`,
            fix_action_type: 'review_item',
            metadata: {
              endpoint: violation.metadata?.endpoint,
              policy_statement: violation.metadata?.policy_statement,
            },
            created_at: violation.created_at,
          })
        }
      }
    }

    // Filter by status if provided
    let filteredItems = items
    if (status) {
      filteredItems = filteredItems.filter(item => item.status === status)
    }

    // Calculate summary
    const summary: ReadinessSummary = {
      total_items: filteredItems.length,
      critical_blockers: filteredItems.filter(i => i.severity === 'critical').length,
      material: filteredItems.filter(i => i.severity === 'material').length,
      info: filteredItems.filter(i => i.severity === 'info').length,
      resolved: 0, // Would track resolved items if we had a status field
      audit_ready_score: calculateAuditReadyScore(filteredItems),
      estimated_time_to_clear_hours: estimateTimeToClear(filteredItems),
      oldest_overdue_date: getOldestOverdueDate(filteredItems),
      category_breakdown: {
        evidence: filteredItems.filter(i => i.category === 'evidence').length,
        controls: filteredItems.filter(i => i.category === 'controls').length,
        attestations: filteredItems.filter(i => i.category === 'attestations').length,
        incidents: filteredItems.filter(i => i.category === 'incidents').length,
        access: filteredItems.filter(i => i.category === 'access').length,
      },
    }

    const response: ReadinessResponse = {
      summary,
      items: filteredItems,
    }

    return NextResponse.json(
      createSuccessResponse(response, { requestId }),
      { headers: { 'X-Request-ID': requestId } }
    )
  } catch (error: any) {
    console.error('[audit/readiness] Error:', {
      message: error.message,
      stack: error.stack,
      requestId,
    })
    return NextResponse.json(
      createErrorResponse(
        error.message || 'Failed to fetch audit readiness',
        error.code || 'READINESS_ERROR',
        {
          requestId,
          statusCode: 500,
          details: process.env.NODE_ENV === 'development' ? { stack: error.stack } : undefined,
        }
      ),
      { status: 500, headers: { 'X-Request-ID': requestId } }
    )
  }
}

/**
 * Calculate audit-ready score (0-100)
 * Score decreases based on severity and count of items
 */
function calculateAuditReadyScore(items: ReadinessItem[]): number {
  if (items.length === 0) return 100

  let penalty = 0
  items.forEach(item => {
    if (item.severity === 'critical') {
      penalty += 10
    } else if (item.severity === 'material') {
      penalty += 5
    } else {
      penalty += 1
    }
  })

  return Math.max(0, 100 - Math.min(penalty, 100))
}

/**
 * Estimate time to clear all items (in hours)
 * Based on average SLA defaults: Critical = 4h, Material = 24h, Info = 72h
 */
function estimateTimeToClear(items: ReadinessItem[]): number {
  let totalHours = 0
  items.forEach(item => {
    if (item.severity === 'critical') {
      totalHours += 4
    } else if (item.severity === 'material') {
      totalHours += 24
    } else {
      totalHours += 72
    }
  })
  return totalHours
}

/**
 * Get oldest overdue date from items
 */
function getOldestOverdueDate(items: ReadinessItem[]): string | undefined {
  const dates = items
    .map(item => item.due_date || item.created_at)
    .filter(Boolean)
    .sort()

  return dates[0]
}

