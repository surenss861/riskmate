/**
 * Ledger Projections
 * 
 * Precomputed views for fast UI queries.
 * These are disposable - if projections are wrong, rebuild from ledger.
 * 
 * Ledger stays immutable; projections are just performance optimizations.
 */

import { supabase } from '../lib/supabaseClient'

export interface ReadinessProjection {
  organization_id: string
  total_events: number
  violations: number
  jobs_touched: number
  proof_packs: number
  signoffs: number
  access_changes: number
  open_incidents: number
  overdue_controls: number
  missing_evidence: number
  unsigned_items: number
  last_updated: string
}

export interface CategoryProjection {
  organization_id: string
  category: string
  event_count: number
  last_event_at: string
  last_updated: string
}

/**
 * Compute readiness projection for an organization
 * 
 * This aggregates ledger events to provide fast "audit readiness" metrics
 */
export async function computeReadinessProjection(
  organizationId: string
): Promise<ReadinessProjection | null> {
  try {
    // Count total events
    const { count: totalEvents } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)

    // Count violations
    const { count: violations } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('category', 'governance')
      .eq('outcome', 'blocked')

    // Count unique jobs touched
    const { data: jobsTouched } = await supabase
      .from('audit_logs')
      .select('work_record_id')
      .eq('organization_id', organizationId)
      .not('work_record_id', 'is', null)
    
    const uniqueJobs = new Set((jobsTouched || []).map(j => j.work_record_id).filter(Boolean))
    const jobsTouchedCount = uniqueJobs.size

    // Count proof packs
    const { count: proofPacks } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('event_name', 'export.pack.generated')

    // Count signoffs
    const { count: signoffs } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('event_name', 'attestation.created')

    // Count access changes
    const { count: accessChanges } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('category', 'access_review')

    // Count open incidents (incident.closed not yet called)
    const { data: incidentEvents } = await supabase
      .from('audit_logs')
      .select('work_record_id, event_name')
      .eq('organization_id', organizationId)
      .in('event_name', ['incident.corrective_action.created', 'security.incident.opened', 'incident.closed'])
      .not('work_record_id', 'is', null)

    const openIncidents = new Set<string>()
    const closedIncidents = new Set<string>()
    
    ;(incidentEvents || []).forEach((e: any) => {
      if (e.event_name === 'incident.closed') {
        closedIncidents.add(e.work_record_id)
      } else {
        openIncidents.add(e.work_record_id)
      }
    })
    
    // Remove closed incidents from open set
    closedIncidents.forEach(id => openIncidents.delete(id))
    const openIncidentsCount = openIncidents.size

    // Count overdue controls (mitigation_items with due_date < today and not done)
    const today = new Date().toISOString().split('T')[0]
    const { count: overdueControls } = await supabase
      .from('mitigation_items')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .lt('due_date', today)
      .eq('done', false)
      .is('deleted_at', null)

    // Count missing evidence (jobs without documents)
    const { data: jobsWithoutEvidence } = await supabase
      .from('jobs')
      .select('id')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
    
    const jobIds = (jobsWithoutEvidence || []).map(j => j.id)
    
    const { data: jobsWithEvidence } = await supabase
      .from('documents')
      .select('job_id')
      .in('job_id', jobIds)
      .is('deleted_at', null)
    
    const jobsWithEvidenceSet = new Set((jobsWithEvidence || []).map(d => d.job_id))
    const missingEvidenceCount = jobIds.length - jobsWithEvidenceSet.size

    // Count unsigned items (jobs without signoffs)
    const { data: jobsWithoutSignoffs } = await supabase
      .from('jobs')
      .select('id')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
    
    const jobIdsForSignoffs = (jobsWithoutSignoffs || []).map(j => j.id)
    
    const { data: jobsWithSignoffs } = await supabase
      .from('job_signoffs')
      .select('job_id')
      .in('job_id', jobIdsForSignoffs)
      .eq('status', 'signed')
    
    const jobsWithSignoffsSet = new Set((jobsWithSignoffs || []).map(s => s.job_id))
    const unsignedItemsCount = jobIdsForSignoffs.length - jobsWithSignoffsSet.size

    return {
      organization_id: organizationId,
      total_events: totalEvents || 0,
      violations: violations || 0,
      jobs_touched: jobsTouchedCount,
      proof_packs: proofPacks || 0,
      signoffs: signoffs || 0,
      access_changes: accessChanges || 0,
      open_incidents: openIncidentsCount,
      overdue_controls: overdueControls || 0,
      missing_evidence: missingEvidenceCount,
      unsigned_items: unsignedItemsCount,
      last_updated: new Date().toISOString(),
    }
  } catch (error) {
    console.error('Failed to compute readiness projection:', error)
    return null
  }
}

/**
 * Compute category projections for an organization
 */
export async function computeCategoryProjections(
  organizationId: string
): Promise<CategoryProjection[]> {
  try {
    const categories: Array<LedgerCategory> = [
      'governance',
      'operations',
      'access',
      'review_queue',
      'incident_review',
      'attestations',
      'access_review',
      'system',
    ]

    const projections: CategoryProjection[] = []

    for (const category of categories) {
      const { count, data } = await supabase
        .from('audit_logs')
        .select('created_at')
        .eq('organization_id', organizationId)
        .eq('category', category)
        .order('created_at', { ascending: false })
        .limit(1)

      projections.push({
        organization_id: organizationId,
        category,
        event_count: count || 0,
        last_event_at: data && data.length > 0 ? data[0].created_at : '',
        last_updated: new Date().toISOString(),
      })
    }

    return projections
  } catch (error) {
    console.error('Failed to compute category projections:', error)
    return []
  }
}

/**
 * Invalidate projections for an organization
 * 
 * Called when material events occur (violations, flags, sign-offs, etc.)
 */
export async function invalidateProjections(organizationId: string): Promise<void> {
  // In a real implementation, you might:
  // 1. Delete cached projections
  // 2. Queue a background job to recompute
  // 3. Update a "dirty" flag
  
  // For now, projections are computed on-demand
  // In production, consider caching with Redis or a materialized view
  console.log(`Projections invalidated for organization: ${organizationId}`)
}

import type { LedgerCategory } from '../../../lib/ledger/contracts'

