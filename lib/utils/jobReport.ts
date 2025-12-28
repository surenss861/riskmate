import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface OrganizationBranding {
  id: string
  name: string
  logo_url?: string | null
  accent_color?: string | null
  subscription_tier?: string | null
}

export interface JobReportPayload {
  job: any
  risk_score: any | null
  risk_factors: any[]
  mitigations: any[]
  documents: any[]
  audit: any[]
  organization: OrganizationBranding | null
}

export async function buildJobReport(
  organizationId: string,
  jobId: string,
  supabaseClient?: SupabaseClient
): Promise<JobReportPayload> {
  // Use provided client (e.g., service role for serverless PDF generation) 
  // or create a server client (respects RLS for browser access)
  const supabase = supabaseClient || await createSupabaseServerClient()

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (jobError) {
    console.error('[buildJobReport] Job query error:', jobError)
    console.error('[buildJobReport] Job query details:', { jobId, organizationId, errorCode: jobError.code, errorMessage: jobError.message })
    throw new Error(`Failed to fetch job: ${jobError.message} (code: ${jobError.code})`)
  }
  
  if (!job) {
    console.error('[buildJobReport] Job not found:', { jobId, organizationId })
    throw new Error(`Job not found: ${jobId} (organization: ${organizationId})`)
  }

  const { data: riskScore } = await supabase
    .from('job_risk_scores')
    .select('*')
    .eq('job_id', jobId)
    .maybeSingle()

  const { data: mitigationItems } = await supabase
    .from('mitigation_items')
    .select('id, title, description, done, is_completed, completed_at, created_at')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true })

  const { data: documentsData } = await supabase
    .from('documents')
    .select('id, name, type, file_path, mime_type, description, created_at, uploaded_by')
    .eq('job_id', jobId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })

  // Generate signed URLs for documents
  const documents = await Promise.all(
    (documentsData || []).map(async (doc) => {
      try {
        const { data: signed } = await supabase.storage
          .from('documents')
          .createSignedUrl(doc.file_path, 60 * 60) // 1 hour expiry

        return {
          ...doc,
          url: signed?.signedUrl || null,
        }
      } catch (error) {
        console.warn('Failed to generate document signed URL', error)
        return {
          ...doc,
          url: null,
        }
      }
    })
  )

  // Fetch audit logs with user names
  const { data: auditLogsData } = await supabase
    .from('audit_logs')
    .select('id, event_name, target_type, target_id, actor_id, metadata, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(250)

  // Get unique actor IDs
  const actorIds = [
    ...new Set((auditLogsData || []).map((log) => log.actor_id).filter(Boolean)),
  ]

  // Fetch user names
  let usersMap = new Map()
  if (actorIds.length > 0) {
    const { data: usersData } = await supabase
      .from('users')
      .select('id, full_name, email')
      .in('id', actorIds)

    usersMap = new Map((usersData || []).map((u) => [u.id, u]))
  }

  // Enrich audit logs with user names
  const auditLogs = (auditLogsData || []).map((log) => {
    const user = log.actor_id ? usersMap.get(log.actor_id) : null
    return {
      ...log,
      actor_name: user?.full_name || null,
      actor_email: user?.email || null,
    }
  })

  const { data: organization } = await supabase
    .from('organizations')
    .select('id, name, logo_url, accent_color, subscription_tier')
    .eq('id', organizationId)
    .maybeSingle()

  const filteredAudit = (auditLogs || []).filter((log) => {
    if (log.target_id === jobId) return true
    const metadata = (log.metadata || {}) as Record<string, any>
    return metadata?.job_id === jobId
  })

  return {
    job,
    risk_score: riskScore ?? null,
    risk_factors: riskScore?.factors ?? [],
    mitigations: mitigationItems ?? [],
    documents: documents ?? [],
    audit: filteredAudit,
    organization: organization ?? null,
  }
}

