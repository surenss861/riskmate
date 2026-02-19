"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWeeklyDigestWorker = startWeeklyDigestWorker;
exports.stopWeeklyDigestWorker = stopWeeklyDigestWorker;
const supabaseClient_1 = require("../lib/supabaseClient");
const emailQueue_1 = require("./emailQueue");
let workerStarted = false;
let workerTimer = null;
let lastRunWindowKey = null;
async function buildDigestForUser(organizationId) {
    const now = new Date();
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const dueSoonCutoff = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const { count: activeJobs } = await supabaseClient_1.supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .neq('status', 'completed')
        .neq('status', 'archived');
    const { data: completedRows } = await supabaseClient_1.supabase
        .from('jobs')
        .select('client_name, updated_at')
        .eq('organization_id', organizationId)
        .eq('status', 'completed')
        .gte('updated_at', oneWeekAgo.toISOString())
        .order('updated_at', { ascending: false })
        .limit(10);
    const { count: overdueJobs } = await supabaseClient_1.supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .lt('due_date', now.toISOString())
        .neq('status', 'completed')
        .neq('status', 'archived');
    const { data: attentionRows } = await supabaseClient_1.supabase
        .from('jobs')
        .select('client_name, due_date')
        .eq('organization_id', organizationId)
        .not('due_date', 'is', null)
        .lte('due_date', dueSoonCutoff.toISOString())
        .neq('status', 'completed')
        .neq('status', 'archived')
        .order('due_date', { ascending: true })
        .limit(20);
    const needsAttention = (attentionRows || []).map((row) => ({
        title: row.client_name || 'Untitled job',
        status: row.due_date && new Date(row.due_date).getTime() < now.getTime()
            ? 'overdue'
            : 'due_soon',
    }));
    return {
        activeJobs: activeJobs || 0,
        completedJobs: (completedRows || []).length,
        overdueJobs: overdueJobs || 0,
        needsAttention,
        completedThisWeek: (completedRows || []).map((row) => ({
            title: row.client_name || 'Untitled job',
            completedAt: row.updated_at || now.toISOString(),
        })),
    };
}
async function runWeeklyDigestCycle() {
    const now = new Date();
    const isMonday = now.getDay() === 1;
    const inWindow = now.getHours() === 9 && now.getMinutes() <= 1;
    if (!isMonday || !inWindow)
        return;
    const windowKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-09`;
    if (windowKey === lastRunWindowKey)
        return;
    const { data: users, error } = await supabaseClient_1.supabase
        .from('users')
        .select('id, email, full_name, organization_id')
        .not('email', 'is', null)
        .is('archived_at', null);
    if (error) {
        console.error('[WeeklyDigestWorker] Failed to load users:', error);
        return;
    }
    for (const user of users || []) {
        if (!user.email || !user.organization_id)
            continue;
        try {
            const digest = await buildDigestForUser(user.organization_id);
            (0, emailQueue_1.queueEmail)(emailQueue_1.EmailJobType.weekly_digest, user.email, digest, user.id);
        }
        catch (digestError) {
            console.error('[WeeklyDigestWorker] Failed for user:', user.id, digestError);
        }
    }
    lastRunWindowKey = windowKey;
    console.log('[WeeklyDigestWorker] Queued weekly digest emails');
}
function startWeeklyDigestWorker() {
    if (workerStarted) {
        console.log('[WeeklyDigestWorker] Already running');
        return;
    }
    workerStarted = true;
    console.log('[WeeklyDigestWorker] Starting...');
    workerTimer = setInterval(() => {
        runWeeklyDigestCycle().catch((error) => {
            console.error('[WeeklyDigestWorker] Cycle failed:', error);
        });
    }, 60 * 1000);
}
function stopWeeklyDigestWorker() {
    if (workerTimer) {
        clearInterval(workerTimer);
        workerTimer = null;
    }
    workerStarted = false;
}
//# sourceMappingURL=weeklyDigest.js.map