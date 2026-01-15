"use strict";
/**
 * Pack Builder - Centralized logic for building proof pack data
 * Ensures all PDFs use the same source of truth
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPackData = buildPackData;
const supabaseClient_1 = require("../lib/supabaseClient");
const audit_1 = require("../routes/audit");
const supabase = (0, supabaseClient_1.getSupabaseAdmin)();
/**
 * Build pack data from organization and filters
 * This is the single source of truth for all pack PDFs
 */
async function buildPackData(organizationId, userId, packId, filters, requestId) {
    // Fetch organization and user data
    const { data: orgData } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .single();
    const { data: userData } = await supabase
        .from('users')
        .select('full_name, role, email')
        .eq('id', userId)
        .single();
    // Build context (will be completed after PDFs are generated)
    const context = {
        packId,
        organizationId,
        organizationName: orgData?.name || 'Unknown',
        generatedAt: new Date().toISOString(),
        generatedBy: {
            userId,
            name: userData?.full_name || 'Unknown',
            email: userData?.email || 'Unknown',
            role: userData?.role || 'Unknown',
        },
        timeRange: filters.time_range || '30d',
        filters,
        requestId,
        stats: {
            ledger_events: 0,
            controls: 0,
            controls_completed: 0,
            controls_pending: 0,
            controls_overdue: 0,
            controls_high_severity: 0,
            attestations: 0,
            attestations_completed: 0,
            attestations_pending: 0,
        },
        payloadFiles: [], // Will be filled after PDFs are generated
    };
    // Fetch ledger events
    let eventsQuery = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);
    // Apply unified filters
    try {
        eventsQuery = (0, audit_1.applyAuditFilters)(eventsQuery, {
            organizationId,
            ...(filters.category && { category: filters.category }),
            ...(filters.job_id && { job_id: filters.job_id }),
            ...(filters.site_id && { site_id: filters.site_id }),
            ...(filters.actor_id && { actor_id: filters.actor_id }),
            ...(filters.severity && { severity: filters.severity }),
            ...(filters.outcome && { outcome: filters.outcome }),
            ...(filters.time_range && { time_range: filters.time_range }),
            ...(filters.start_date && { start_date: filters.start_date }),
            ...(filters.end_date && { end_date: filters.end_date }),
            ...(filters.view && { view: filters.view }),
        });
    }
    catch (filterError) {
        throw filterError;
    }
    const { data: eventsData, error: eventsError } = await eventsQuery;
    if (eventsError) {
        throw new Error(`Database query failed: ${eventsError.message}`);
    }
    const events = eventsData || [];
    // Enrich events with actor and job info
    const enrichedEvents = await Promise.all(events.map(async (e) => {
        const enriched = { ...e };
        if (e.actor_id) {
            const { data: actorData } = await supabase
                .from('users')
                .select('full_name, role')
                .eq('id', e.actor_id)
                .single();
            if (actorData) {
                enriched.actor_name = actorData.full_name || 'Unknown';
                enriched.actor_role = actorData.role || 'member';
            }
        }
        if (e.job_id) {
            const { data: jobData } = await supabase
                .from('jobs')
                .select('client_name')
                .eq('id', e.job_id)
                .single();
            if (jobData) {
                enriched.job_title = jobData.client_name;
            }
        }
        return enriched;
    }));
    const ledgerEvents = enrichedEvents.map((e) => ({
        id: e.id,
        event_name: e.event_name || e.event_type,
        created_at: e.created_at,
        category: e.category || 'operations',
        outcome: e.outcome || 'allowed',
        severity: e.severity || 'info',
        actor_name: e.actor_name || 'System',
        actor_role: e.actor_role || '',
        job_id: e.job_id,
        job_title: e.job_title,
        target_type: e.target_type,
        summary: e.summary,
    }));
    // Fetch controls data
    let jobsQuery = supabase
        .from('jobs')
        .select('id, client_name, risk_score, risk_level, status, site_name')
        .eq('organization_id', organizationId)
        .is('deleted_at', null);
    if (filters.job_id)
        jobsQuery = jobsQuery.eq('id', filters.job_id);
    if (filters.site_id)
        jobsQuery = jobsQuery.eq('site_id', filters.site_id);
    const { data: jobs } = await jobsQuery;
    const jobIds = jobs?.map(j => j.id) || [];
    if (jobIds.length === 0) {
        // No jobs found - return empty controls/attestations
        context.stats.ledger_events = ledgerEvents.length;
        return {
            context,
            ledgerEvents,
            controls: [],
            attestations: [],
        };
    }
    // Fetch mitigations (controls)
    const { data: mitigations } = await supabase
        .from('mitigation_items')
        .select('id, job_id, title, description, done, is_completed, created_at, owner_id, due_date, verification_method, updated_at')
        .in('job_id', jobIds);
    // Fetch control details
    const allControlIds = (mitigations || []).map(m => m.id);
    const { data: controlsWithDetails } = await supabase
        .from('mitigation_items')
        .select('id, owner_id, due_date, verification_method, created_at, updated_at')
        .in('id', allControlIds);
    const controlDetailsMap = new Map((controlsWithDetails || []).map(c => [c.id, c]));
    // Fetch owner emails
    const ownerIds = [...new Set((controlsWithDetails || []).map(c => c.owner_id).filter(Boolean))];
    const { data: owners } = await supabase
        .from('users')
        .select('id, email')
        .in('id', ownerIds);
    const ownerMap = new Map((owners || []).map(o => [o.id, o.email]));
    // Fetch ledger entries for controls
    const { data: ledgerEntriesWithType } = await supabase
        .from('audit_logs')
        .select('target_id, id as ledger_entry_id, event_name as ledger_event_type')
        .in('target_id', allControlIds)
        .eq('target_type', 'mitigation')
        .order('created_at', { ascending: false });
    const ledgerTypeMap = new Map();
    ledgerEntriesWithType?.forEach((entry) => {
        if (!ledgerTypeMap.has(entry.target_id)) {
            ledgerTypeMap.set(entry.target_id, {
                ledger_entry_id: entry.ledger_entry_id,
                ledger_event_type: entry.ledger_event_type,
            });
        }
    });
    // Fetch site IDs
    const { data: jobsWithSites } = await supabase
        .from('jobs')
        .select('id, site_id')
        .in('id', jobIds);
    const siteMap = new Map((jobsWithSites || []).map(j => [j.id, j.site_id || '']));
    const jobMap = new Map((jobs || []).map(j => [j.id, j]));
    // Build controls rows
    const controls = [];
    const now = new Date();
    (mitigations || []).forEach((mitigation) => {
        const job = jobMap.get(mitigation.job_id);
        const ledgerInfo = ledgerTypeMap.get(mitigation.id);
        const details = controlDetailsMap.get(mitigation.id);
        const ownerEmail = details?.owner_id ? ownerMap.get(details.owner_id) : '';
        const siteId = siteMap.get(mitigation.job_id) || '';
        const status = mitigation.done || mitigation.is_completed ? 'completed' : 'pending';
        const severity = job?.risk_level || 'info';
        const isOverdue = details?.due_date && new Date(details.due_date) < now && status !== 'completed';
        const isHighSeverity = severity === 'high' || severity === 'critical';
        controls.push({
            control_id: mitigation.id,
            ledger_entry_id: ledgerInfo?.ledger_entry_id || '',
            ledger_event_type: ledgerInfo?.ledger_event_type || '',
            work_record_id: mitigation.job_id,
            site_id: siteId,
            org_id: organizationId,
            status_at_export: status,
            severity,
            title: mitigation.title || 'Untitled',
            owner_user_id: details?.owner_id || '',
            owner_email: ownerEmail || '',
            due_date: details?.due_date ? new Date(details.due_date).toISOString().split('T')[0] : '',
            verification_method: details?.verification_method || '',
            created_at: details?.created_at ? new Date(details.created_at).toISOString() : '',
            updated_at: details?.updated_at ? new Date(details.updated_at).toISOString() : '',
        });
        // Update stats
        if (status === 'completed') {
            context.stats.controls_completed++;
        }
        else {
            context.stats.controls_pending++;
        }
        if (isOverdue) {
            context.stats.controls_overdue++;
        }
        if (isHighSeverity) {
            context.stats.controls_high_severity++;
        }
    });
    // Fetch attestations (signoffs)
    const { data: signoffs } = await supabase
        .from('job_signoffs')
        .select('id, job_id, signoff_type, status, signed_by, signed_at, ip_address, user_agent, comments')
        .in('job_id', jobIds);
    // Enrich signoffs with signer info
    const enrichedSignoffs = await Promise.all((signoffs || []).map(async (signoff) => {
        if (signoff.signed_by) {
            const { data: signerData } = await supabase
                .from('users')
                .select('full_name, role, email')
                .eq('id', signoff.signed_by)
                .single();
            if (signerData) {
                signoff.signer_name = signerData.full_name || 'Unknown';
                signoff.signer_role = signerData.role || 'member';
                signoff.signer_email = signerData.email || '';
            }
        }
        return signoff;
    }));
    // Fetch attestation ledger entries
    const signoffIds = enrichedSignoffs.map((s) => s.id);
    const { data: attestationLedgerEntriesWithType } = await supabase
        .from('audit_logs')
        .select('target_id, id as ledger_entry_id, event_name as ledger_event_type')
        .in('target_id', signoffIds)
        .eq('target_type', 'system')
        .order('created_at', { ascending: false });
    const attestationLedgerTypeMap = new Map();
    attestationLedgerEntriesWithType?.forEach((entry) => {
        if (!attestationLedgerTypeMap.has(entry.target_id)) {
            attestationLedgerTypeMap.set(entry.target_id, {
                ledger_entry_id: entry.ledger_entry_id,
                ledger_event_type: entry.ledger_event_type,
            });
        }
    });
    // Build attestations rows
    const attestations = [];
    enrichedSignoffs.forEach((signoff) => {
        const ledgerInfo = attestationLedgerTypeMap.get(signoff.id);
        const siteId = siteMap.get(signoff.job_id) || '';
        const status = signoff.status || 'pending';
        attestations.push({
            attestation_id: signoff.id,
            ledger_entry_id: ledgerInfo?.ledger_entry_id || '',
            ledger_event_type: ledgerInfo?.ledger_event_type || '',
            work_record_id: signoff.job_id,
            site_id: siteId,
            org_id: organizationId,
            status_at_export: status,
            title: `Attestation ${signoff.id.substring(0, 8)}`,
            description: signoff.comments || '',
            attested_by_user_id: signoff.signed_by || '',
            attested_by_email: signoff.signer_email || '',
            attested_at: signoff.signed_at ? new Date(signoff.signed_at).toISOString() : '',
            created_at: signoff.signed_at ? new Date(signoff.signed_at).toISOString() : '',
        });
        // Update stats
        if (status === 'signed' || status === 'completed') {
            context.stats.attestations_completed++;
        }
        else {
            context.stats.attestations_pending++;
        }
    });
    // Update final stats
    context.stats.ledger_events = ledgerEvents.length;
    context.stats.controls = controls.length;
    context.stats.attestations = attestations.length;
    return {
        context,
        ledgerEvents,
        controls,
        attestations,
    };
}
//# sourceMappingURL=packBuilder.js.map