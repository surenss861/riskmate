"use strict";
/**
 * Ledger Projections
 *
 * Precomputed views for fast UI queries.
 * These are disposable - if projections are wrong, rebuild from ledger.
 *
 * Ledger stays immutable; projections are just performance optimizations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeReadinessProjection = computeReadinessProjection;
exports.computeCategoryProjections = computeCategoryProjections;
exports.invalidateProjections = invalidateProjections;
const supabaseClient_1 = require("../lib/supabaseClient");
/**
 * Compute readiness projection for an organization
 *
 * This aggregates ledger events to provide fast "audit readiness" metrics
 */
async function computeReadinessProjection(organizationId) {
    try {
        // Count total events
        const { count: totalEvents } = await supabaseClient_1.supabase
            .from('audit_logs')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', organizationId);
        // Count violations
        const { count: violations } = await supabaseClient_1.supabase
            .from('audit_logs')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
            .eq('category', 'governance')
            .eq('outcome', 'blocked');
        // Count unique jobs touched
        const { data: jobsTouched } = await supabaseClient_1.supabase
            .from('audit_logs')
            .select('work_record_id')
            .eq('organization_id', organizationId)
            .not('work_record_id', 'is', null);
        const uniqueJobs = new Set((jobsTouched || []).map(j => j.work_record_id).filter(Boolean));
        const jobsTouchedCount = uniqueJobs.size;
        // Count proof packs
        const { count: proofPacks } = await supabaseClient_1.supabase
            .from('audit_logs')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
            .eq('event_name', 'export.pack.generated');
        // Count signoffs
        const { count: signoffs } = await supabaseClient_1.supabase
            .from('audit_logs')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
            .eq('event_name', 'attestation.created');
        // Count access changes
        const { count: accessChanges } = await supabaseClient_1.supabase
            .from('audit_logs')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
            .eq('category', 'access_review');
        // Count open incidents (incident.closed not yet called)
        const { data: incidentEvents } = await supabaseClient_1.supabase
            .from('audit_logs')
            .select('work_record_id, event_name')
            .eq('organization_id', organizationId)
            .in('event_name', ['incident.corrective_action.created', 'security.incident.opened', 'incident.closed'])
            .not('work_record_id', 'is', null);
        const openIncidents = new Set();
        const closedIncidents = new Set();
        (incidentEvents || []).forEach((e) => {
            if (e.event_name === 'incident.closed') {
                closedIncidents.add(e.work_record_id);
            }
            else {
                openIncidents.add(e.work_record_id);
            }
        });
        // Remove closed incidents from open set
        closedIncidents.forEach(id => openIncidents.delete(id));
        const openIncidentsCount = openIncidents.size;
        // Count overdue controls (mitigation_items with due_date < today and not done)
        const today = new Date().toISOString().split('T')[0];
        const { count: overdueControls } = await supabaseClient_1.supabase
            .from('mitigation_items')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
            .lt('due_date', today)
            .eq('done', false)
            .is('deleted_at', null);
        // Count missing evidence (jobs without documents)
        const { data: jobsWithoutEvidence } = await supabaseClient_1.supabase
            .from('jobs')
            .select('id')
            .eq('organization_id', organizationId)
            .is('deleted_at', null);
        const jobIds = (jobsWithoutEvidence || []).map(j => j.id);
        const { data: jobsWithEvidence } = await supabaseClient_1.supabase
            .from('documents')
            .select('job_id')
            .in('job_id', jobIds)
            .is('deleted_at', null);
        const jobsWithEvidenceSet = new Set((jobsWithEvidence || []).map(d => d.job_id));
        const missingEvidenceCount = jobIds.length - jobsWithEvidenceSet.size;
        // Count unsigned items (jobs without signoffs)
        const { data: jobsWithoutSignoffs } = await supabaseClient_1.supabase
            .from('jobs')
            .select('id')
            .eq('organization_id', organizationId)
            .is('deleted_at', null);
        const jobIdsForSignoffs = (jobsWithoutSignoffs || []).map(j => j.id);
        const { data: jobsWithSignoffs } = await supabaseClient_1.supabase
            .from('job_signoffs')
            .select('job_id')
            .in('job_id', jobIdsForSignoffs)
            .eq('status', 'signed');
        const jobsWithSignoffsSet = new Set((jobsWithSignoffs || []).map(s => s.job_id));
        const unsignedItemsCount = jobIdsForSignoffs.length - jobsWithSignoffsSet.size;
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
        };
    }
    catch (error) {
        console.error('Failed to compute readiness projection:', error);
        return null;
    }
}
/**
 * Compute category projections for an organization
 */
async function computeCategoryProjections(organizationId) {
    try {
        const categories = [
            'governance',
            'operations',
            'access',
            'review_queue',
            'incident_review',
            'attestations',
            'access_review',
            'system',
        ];
        const projections = [];
        for (const category of categories) {
            const { count, data } = await supabaseClient_1.supabase
                .from('audit_logs')
                .select('created_at')
                .eq('organization_id', organizationId)
                .eq('category', category)
                .order('created_at', { ascending: false })
                .limit(1);
            projections.push({
                organization_id: organizationId,
                category,
                event_count: count || 0,
                last_event_at: data && data.length > 0 ? data[0].created_at : '',
                last_updated: new Date().toISOString(),
            });
        }
        return projections;
    }
    catch (error) {
        console.error('Failed to compute category projections:', error);
        return [];
    }
}
/**
 * Invalidate projections for an organization
 *
 * Called when material events occur (violations, flags, sign-offs, etc.)
 */
async function invalidateProjections(organizationId) {
    // In a real implementation, you might:
    // 1. Delete cached projections
    // 2. Queue a background job to recompute
    // 3. Update a "dirty" flag
    // For now, projections are computed on-demand
    // In production, consider caching with Redis or a materialized view
    console.log(`Projections invalidated for organization: ${organizationId}`);
}
//# sourceMappingURL=projections.js.map