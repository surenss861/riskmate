import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { calculateRiskScore, generateMitigationItems } from '@/lib/utils/riskScoring'
import { getOrgEntitlements } from '@/lib/entitlements'
import { logFeatureUsage } from '@/lib/featureLogging'
import { getRequestId } from '@/lib/featureEvents'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
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
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const status = searchParams.get('status')
    const risk_level = searchParams.get('risk_level')

    const offset = (page - 1) * limit

    let query = supabase
      .from('jobs')
      .select('id, client_name, job_type, location, status, risk_score, risk_level, created_at, updated_at')
      .eq('organization_id', organization_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    if (risk_level) {
      query = query.eq('risk_level', risk_level)
    }

    const { data: jobs, error } = await query

    if (error) throw error

    // Get total count for pagination
    let countQuery = supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organization_id)

    if (status) {
      countQuery = countQuery.eq('status', status)
    }

    if (risk_level) {
      countQuery = countQuery.eq('risk_level', risk_level)
    }

    const { count, error: countError } = await countQuery

    if (countError) throw countError

    return NextResponse.json({
      data: jobs || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error: any) {
    console.error('Jobs fetch failed:', error)
    return NextResponse.json(
      { message: 'Failed to fetch jobs' },
      { status: 500 }
    )
  }
}

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
    const body = await request.json()

    const {
      client_name,
      client_type,
      job_type,
      location,
      description,
      start_date,
      end_date,
      risk_factor_codes = [],
      has_subcontractors = false,
      subcontractor_count = 0,
      insurance_status = 'pending',
      applied_template_id,
      applied_template_type,
    } = body

    // Preflight validation: Required fields
    if (!client_name || !client_type || !job_type || !location) {
      return NextResponse.json(
        { message: 'Missing required fields: client_name, client_type, job_type, location' },
        { status: 400 }
      )
    }

    // Preflight validation: Verify user has permission to create jobs
    // Check if user is an active member with appropriate role
    const { data: membership, error: membershipError } = await supabase
      .from('users')
      .select('role, archived_at')
      .eq('id', userId)
      .eq('organization_id', organization_id)
      .is('archived_at', null)
      .single()

    if (membershipError || !membership) {
      return NextResponse.json(
        { message: 'Permission denied: You are not an active member of this organization.' },
        { status: 403 }
      )
    }

    // Preflight validation: Normalize enum values (lowercase)
    const normalizedClientType = client_type?.toLowerCase().trim()
    const normalizedJobType = job_type?.toLowerCase().trim()
    const normalizedInsuranceStatus = insurance_status?.toLowerCase().trim()

    // Validate enum values (match UI options)
    const validClientTypes = ['residential', 'commercial', 'industrial', 'government', 'mixed']
    const validJobTypes = ['repair', 'maintenance', 'installation', 'inspection', 'renovation', 'new_construction', 'remodel', 'other']
    const validInsuranceStatuses = ['pending', 'approved', 'rejected', 'not_required']

    if (!validClientTypes.includes(normalizedClientType)) {
      return NextResponse.json(
        { message: `Invalid client_type: "${client_type}". Must be one of: ${validClientTypes.join(', ')}` },
        { status: 400 }
      )
    }

    if (!validJobTypes.includes(normalizedJobType)) {
      return NextResponse.json(
        { message: `Invalid job_type: "${job_type}". Must be one of: ${validJobTypes.join(', ')}` },
        { status: 400 }
      )
    }

    if (!validInsuranceStatuses.includes(normalizedInsuranceStatus)) {
      return NextResponse.json(
        { message: `Invalid insurance_status: "${insurance_status}". Must be one of: ${validInsuranceStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    // Preflight validation: Validate template reference if provided
    if (applied_template_id) {
      if (!applied_template_type || !['job', 'hazard'].includes(applied_template_type)) {
        return NextResponse.json(
          { message: 'If applied_template_id is provided, applied_template_type must be "job" or "hazard"' },
          { status: 400 }
        )
      }

      // Verify template exists and belongs to organization
      const templateTable = applied_template_type === 'job' ? 'job_templates' : 'hazard_templates'
      const { data: template, error: templateError } = await supabase
        .from(templateTable)
        .select('id, organization_id')
        .eq('id', applied_template_id)
        .eq('organization_id', organization_id)
        .single()

      if (templateError || !template) {
        return NextResponse.json(
          { message: `Template not found or does not belong to your organization.` },
          { status: 400 }
        )
      }
    }

    // Preflight validation: Validate subcontractor count
    if (has_subcontractors && (subcontractor_count === undefined || subcontractor_count < 0)) {
      return NextResponse.json(
        { message: 'If has_subcontractors is true, subcontractor_count must be a non-negative number' },
        { status: 400 }
      )
    }

    // Get request ID from header or generate
    const requestId = request.headers.get('x-request-id') || getRequestId()

    // Get entitlements ONCE at request start (request-scoped snapshot)
    const entitlements = await getOrgEntitlements(organization_id)

    // Check job creation limit
    if (entitlements.jobs_monthly_limit !== null) {
      // Get period start from subscription or default to current month
      const periodStart = entitlements.period_end
        ? new Date(new Date(entitlements.period_end).getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days before period end
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1)

      const { count } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organization_id)
        .gte('created_at', periodStart.toISOString())

      if ((count || 0) >= entitlements.jobs_monthly_limit) {
        // Log denied attempt with standardized schema
        await logFeatureUsage({
          feature: 'job_creation',
          action: 'limit_denied',
          allowed: false,
          organizationId: organization_id,
          actorId: userId,
          entitlements, // Pass snapshot (no re-fetch)
          source: 'api',
          requestId,
          denialCode: 'MONTHLY_LIMIT_REACHED',
          reason: `Job limit reached (${entitlements.jobs_monthly_limit} jobs/month on ${entitlements.tier} plan)`,
          additionalMetadata: {
            current_count: count || 0,
            limit: entitlements.jobs_monthly_limit,
          },
          logUsage: false,
        })

        return NextResponse.json(
          {
            code: 'JOB_LIMIT',
            denial_code: 'MONTHLY_LIMIT_REACHED',
            message: `${entitlements.tier === 'starter' ? 'Starter' : 'Plan'} limit reached (${entitlements.jobs_monthly_limit} jobs/month). Upgrade to Pro for unlimited jobs.`,
          },
          { status: 403 }
        )
      }
    }

    // Allowlist of valid jobs table columns (prevent PGRST204 from unknown columns)
    const validJobColumns = new Set([
      'organization_id',
      'created_by',
      'client_name',
      'client_type',
      'job_type',
      'location',
      'description',
      'start_date',
      'end_date',
      'status',
      'has_subcontractors',
      'subcontractor_count',
      'insurance_status',
      'applied_template_id',
      'applied_template_type',
      'site_id',
      'site_name',
    ])

    // Build job row with only valid columns
    const jobRow: Record<string, any> = {
      organization_id,
      created_by: userId,
      client_name: client_name.trim(),
      client_type: normalizedClientType,
      job_type: normalizedJobType,
      location: location.trim(),
      description: description?.trim() || null,
      start_date: start_date || null,
      end_date: end_date || null,
      status: 'draft',
      has_subcontractors,
      subcontractor_count: has_subcontractors ? (subcontractor_count || 0) : 0,
      insurance_status: normalizedInsuranceStatus,
      applied_template_id: applied_template_id || null,
      applied_template_type: applied_template_type || null,
    }

    // Filter to only valid columns (strip any extra fields from request body)
    const filteredJobRow = Object.fromEntries(
      Object.entries(jobRow).filter(([key]) => validJobColumns.has(key))
    )

    // Log payload keys for debugging (helps identify bad columns)
    console.log('[jobs] insert keys:', Object.keys(filteredJobRow))
    console.log('[jobs] request body keys:', Object.keys(body))

    // Create job (using filtered, normalized values)
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert(filteredJobRow)
      .select()
      .single()

    if (jobError) {
      console.error('Job creation failed:', JSON.stringify(jobError, null, 2))
      console.error('Job error details:', {
        message: jobError.message,
        code: jobError.code,
        details: jobError.details,
        hint: jobError.hint,
      })
      
      // Return specific error messages based on error type
      let errorMessage = 'Failed to create job'
      let statusCode = 500
      
      // PGRST204 = Column doesn't exist OR no rows returned (RLS blocking)
      if (jobError.code === 'PGRST204' || jobError.code === 'PGRST116') {
        // Check if it's a column error (details/hint will mention column)
        if (jobError.details?.includes('column') || jobError.hint?.includes('column')) {
          errorMessage = `Invalid column in request: ${jobError.message || jobError.details || 'Unknown column'}. Please check the request payload.`
          statusCode = 400
        } else {
          // It's an RLS blocking issue
          errorMessage = 'Permission denied: Job was created but cannot be retrieved. Row-level security policy may be blocking access. Check your team role and RLS policies.'
          statusCode = 403
        }
        // Always include the raw error message for debugging
        errorMessage = `${errorMessage} (${jobError.message || jobError.code})`
      }
      // RLS policy violation
      else if (jobError.message?.includes('row-level security') || jobError.message?.includes('RLS') || jobError.code === '42501') {
        errorMessage = 'Permission denied: You may not have permission to create jobs. Check your team role.'
        statusCode = 403
      }
      // Foreign key constraint violation
      else if (jobError.message?.includes('foreign key') || jobError.code === '23503') {
        errorMessage = 'Invalid reference: One of the selected values (template, organization, etc.) is invalid.'
        statusCode = 400
      }
      // Not null constraint violation
      else if (jobError.message?.includes('null value') || jobError.code === '23502') {
        const fieldMatch = jobError.message?.match(/column "(\w+)"/)
        const field = fieldMatch ? fieldMatch[1] : 'required field'
        errorMessage = `Missing required field: ${field}`
        statusCode = 400
      }
      // Enum/invalid value
      else if (jobError.message?.includes('invalid input') || jobError.code === '22P02') {
        errorMessage = 'Invalid value: One of the field values is not allowed. Check job type, client type, or status.'
        statusCode = 400
      }
      // Unique constraint violation
      else if (jobError.code === '23505') {
        errorMessage = 'Duplicate entry: A job with these details already exists.'
        statusCode = 409
      }
      // Always include actual error details in response for debugging
      else {
        errorMessage = jobError.message || 'Failed to create job'
      }
      
      return NextResponse.json(
        { 
          message: errorMessage,
          error: jobError.message,
          code: jobError.code,
          hint: jobError.hint,
          details: jobError.details || (process.env.NODE_ENV === 'development' ? jobError : undefined)
        },
        { status: statusCode }
      )
    }

    // Log successful job creation with standardized schema
    await logFeatureUsage({
      feature: 'job_creation',
      action: 'created',
      allowed: true,
      organizationId: organization_id,
      actorId: userId,
      entitlements, // Pass snapshot (no re-fetch)
      source: 'api',
      requestId,
      resourceType: 'job',
      resourceId: job.id,
      additionalMetadata: {
        job_id: job.id,
        client_name,
        job_type,
        location,
        risk_factors_count: risk_factor_codes?.length || 0,
      },
      logUsage: true,
    })

    // Calculate risk score if risk factors provided
    let riskScoreResult = null
    if (risk_factor_codes && risk_factor_codes.length > 0) {
      try {
        riskScoreResult = await calculateRiskScore(risk_factor_codes)

        // Save risk score
        await supabase.from('job_risk_scores').insert({
          job_id: job.id,
          overall_score: riskScoreResult.overall_score,
          risk_level: riskScoreResult.risk_level,
          factors: riskScoreResult.factors,
        })

        // Update job with risk score
        await supabase
          .from('jobs')
          .update({
            risk_score: riskScoreResult.overall_score,
            risk_level: riskScoreResult.risk_level,
          })
          .eq('id', job.id)

        // Generate mitigation items
        await generateMitigationItems(job.id, risk_factor_codes)
      } catch (riskError: any) {
        console.error('Risk scoring failed:', riskError)
        // Continue without risk score - job is still created
      }
    }

    // Fetch complete job with risk details
    const { data: completeJob } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', job.id)
      .single()

    const { data: mitigationItems } = await supabase
      .from('mitigation_items')
      .select('id, title, description, done, is_completed')
      .eq('job_id', job.id)

    return NextResponse.json(
      {
        data: {
          ...completeJob,
          risk_score_detail: riskScoreResult,
          mitigation_items: mitigationItems || [],
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Job creation error:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to create job' },
      { status: 500 }
    )
  }
}

