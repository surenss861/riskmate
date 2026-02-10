/**
 * API client for Riskmate backend
 */

import { JobReportData } from '@/types/report'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { fetchWithIdempotency, generateBulkIdempotencyKey } from './api/fetchWithIdempotency'
import { BACKEND_URL } from '@/lib/config'

// Use centralized backend URL - always call backend directly (like iOS)
// This ensures consistency and avoids hitting Next.js API routes
const API_URL = BACKEND_URL

// Debug log in development to verify API URL is set correctly
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('[API] API_BASE:', API_URL)
}

export interface ApiError {
  message: string;
  code?: string;
}

// Readiness API types
export interface ReadinessItem {
  id: string
  rule_code: string
  rule_name: string
  category: 'evidence' | 'controls' | 'attestations' | 'incidents' | 'access'
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
  fix_action_type: 'upload_evidence' | 'request_attestation' | 'complete_controls' | 'resolve_incident' | 'review_item' | 'create_evidence' | 'create_control' | 'mark_resolved'
  metadata?: any
  created_at?: string
  updated_at?: string
}

export interface ReadinessSummary {
  total_items: number
  critical_blockers: number
  material: number
  info: number
  resolved: number
  audit_ready_score: number
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

export interface ReadinessResponse {
  ok: true
  data: {
    summary: ReadinessSummary
    items: ReadinessItem[]
  }
  requestId?: string
}

/**
 * Get stable device ID (localStorage UUID, generates if missing)
 */
function getStableDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  
  const key = 'riskmate_device_id';
  let deviceId = localStorage.getItem(key);
  
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(key, deviceId);
  }
  
  return deviceId;
}

/**
 * Get client metadata for audit logging
 */
function getClientMetadata(): { client: string; appVersion: string; deviceId: string } {
  const deviceId = getStableDeviceId();
  
  // Get app version from env or git sha (fallback to 'unknown')
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || 
                     process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || 
                     'unknown';
  
  return {
    client: 'web',
    appVersion,
    deviceId,
  };
}

async function getAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  
  try {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    
    // Handle refresh token errors gracefully (treat as logged out)
    if (sessionError?.message?.toLowerCase().includes('refresh token')) {
      console.warn('[API] Invalid refresh token - signing out locally:', sessionError.message);
      // Sign out locally only (don't trigger global signout)
      await supabase.auth.signOut({ scope: 'local' });
      return null;
    }
    
    if (sessionError) {
      console.warn('[API] Session error (non-fatal):', sessionError.message);
      return null;
    }
    
    if (!session) {
      // No session is normal for public pages - don't log as error
      return null;
    }
    
    const token = session.access_token;
    
    // Verify token is not an anon token (basic check)
    if (token && token.length < 100) {
      console.warn('[API] Token appears invalid (too short)');
      return null;
    }
    
    // Log token info in dev (first 20 chars only for security)
    if (process.env.NODE_ENV === 'development') {
      console.log('[API] Using auth token:', token ? `${token.substring(0, 20)}...` : 'none');
    }
    
    return token || null;
  } catch (error) {
    console.error('[API] Failed to get auth token:', error);
    return null;
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();
  
  // Always use BACKEND_URL - ensure endpoint starts with / if it doesn't already
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_URL}${normalizedEndpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  // Extract request ID from response headers for correlation
  const requestId = response.headers.get('x-request-id') || response.headers.get('X-Request-ID')

  if (!response.ok) {
    const message = isJson ? (data?.detail || data?.message || data?.error) : data || response.statusText;
    const error: Error & ApiError = new Error(message || 'API request failed') as Error & ApiError;
    if (isJson && data?.code) {
      error.code = data.code;
    }
    // Store request ID for debugging
    if (requestId || (isJson && data?.requestId)) {
      (error as any).requestId = requestId || data?.requestId;
    }
    
    // Special handling for 401: Check if session is actually invalid before treating as fatal
    if (response.status === 401 && typeof window !== 'undefined') {
      const supabase = createSupabaseBrowserClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      // Only treat as fatal if session is actually invalid
      if (sessionError?.message?.toLowerCase().includes('refresh token')) {
        console.warn('[API] 401 + invalid refresh token - session is dead, will be handled by auth listener');
        // Don't force logout here - let auth listener handle it
      } else if (!session) {
        console.warn('[API] 401 + no session - user is logged out');
        // Session is gone - this is expected, don't force logout
      } else {
        // Session exists but API returned 401 - might be:
        // - Token expired but refreshable
        // - Backend auth issue
        // - Route-specific auth failure
        console.warn('[API] 401 but session exists - may be transient. Endpoint:', endpoint);
        // Try refreshing token once for GET requests
        if (options.method === 'GET' || !options.method) {
          try {
            // Trigger token refresh
            await supabase.auth.refreshSession();
            const { data: { session: newSession } } = await supabase.auth.getSession();
            if (newSession?.access_token) {
              // Retry with new token
              console.log('[API] Retrying request with refreshed token');
              const retryResponse = await fetch(url, {
                ...options,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${newSession.access_token}`,
                  ...options.headers,
                },
              });
              if (retryResponse.ok) {
                const retryContentType = retryResponse.headers.get('content-type');
                const retryIsJson = retryContentType?.includes('application/json');
                const retryData = retryIsJson ? await retryResponse.json() : await retryResponse.text();
                return retryData as T;
              }
            }
          } catch (refreshErr) {
            console.warn('[API] Token refresh failed:', refreshErr);
            // Continue to throw original 401 error
          }
        }
      }
    }
    
    // Log failed request for debugging (only in browser)
    if (typeof window !== 'undefined') {
      import('./utils/clientRequestLogger').then(({ logFailedRequest }) => {
        logFailedRequest(
          endpoint,
          options.method || 'GET',
          response.status,
          {
            code: isJson ? data?.code : undefined,
            message: message,
            requestId: requestId || (isJson ? data?.requestId : undefined),
          }
        )
      }).catch(() => {
        // Silently fail if logger can't be imported (shouldn't happen but be safe)
      })
    }
    
    // Include full error details in development
    if (isJson && data?.error && process.env.NODE_ENV === 'development') {
      console.error('API Error Details:', data.error);
    }
    
    // Auto-retry for read operations (GET) on network errors (status 0 or 5xx)
    if (options.method === 'GET' && (response.status === 0 || response.status >= 500)) {
      // Retry once after short delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      try {
        const retryResponse = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...options.headers,
          },
        })
        if (retryResponse.ok) {
          const retryContentType = retryResponse.headers.get('content-type')
          const retryIsJson = retryContentType?.includes('application/json')
          const retryData = retryIsJson ? await retryResponse.json() : await retryResponse.text()
          return retryData as T
        }
      } catch (retryErr) {
        // If retry also fails, throw original error
      }
    }
    
    throw error;
  }

  return data as T;
}

// Jobs API
export const jobsApi = {
  list: async (params?: { 
    page?: number; 
    limit?: number; 
    page_size?: number;
    status?: string; 
    risk_level?: string;
    include_archived?: boolean;
    sort?: string;
    cursor?: string;
    q?: string;
    time_range?: string;
    missing_evidence?: boolean;
    debug?: boolean;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.page_size) queryParams.set('page_size', params.page_size.toString());
    if (params?.status) queryParams.set('status', params.status);
    if (params?.risk_level) queryParams.set('risk_level', params.risk_level);
    if (params?.include_archived) queryParams.set('include_archived', 'true');
    if (params?.sort) queryParams.set('sort', params.sort);
    if (params?.cursor) queryParams.set('cursor', params.cursor);
    if (params?.q) queryParams.set('q', params.q);
    if (params?.time_range) queryParams.set('time_range', params.time_range);
    if (params?.missing_evidence === true) queryParams.set('missing_evidence', 'true');
    if (params?.debug && process.env.NODE_ENV === 'development') {
      queryParams.set('debug', '1');
    }
    
    return apiRequest<{ 
      data: Array<{
        id: string;
        client_name: string;
        job_type: string;
        location: string;
        status: string;
        risk_score: number | null;
        risk_level: string | null;
        created_at: string;
        updated_at: string;
        readiness_score?: number | null;
        readiness_basis?: string;
        readiness_empty_reason?: string | null;
        mitigations_total?: number;
        mitigations_complete?: number;
        blockers_count?: number;
        missing_evidence?: boolean;
        pending_attestations?: number;
        [key: string]: any;
      }>; 
      pagination: {
        page?: number;
        page_size?: number;
        limit: number;
        total: number;
        total_pages?: number;
        totalPages?: number;
        cursor?: string;
        hasMore?: boolean;
      };
      _meta?: {
        source: string;
        include_archived: boolean;
        organization_id: string;
        sort_field?: string;
        sort_direction?: string;
      };
    }>(`/api/jobs?${queryParams}`);
  },

  get: async (id: string) => {
    return apiRequest<{ data: any }>(`/api/jobs/${id}`);
  },

  create: async (jobData: {
    client_name: string;
    client_type: string;
    job_type: string;
    location: string;
    description?: string;
    start_date?: string;
    end_date?: string;
    risk_factor_codes?: string[];
    has_subcontractors?: boolean;
    subcontractor_count?: number;
    insurance_status?: string;
    applied_template_id?: string | null;
    applied_template_type?: 'hazard' | 'job' | null;
  }) => {
    return apiRequest<{ data: any }>('/api/jobs', {
      method: 'POST',
      body: JSON.stringify(jobData),
    });
  },

  update: async (id: string, updates: any) => {
    return apiRequest<{ data: any }>(`/api/jobs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  getDocuments: async (id: string) => {
    return apiRequest<{ data: any[] }>(`/api/jobs/${id}/documents`);
  },

  /** Register an already-uploaded file (e.g. in evidence bucket) without re-uploading. */
  registerDocument: async (
    id: string,
    metadata: { name: string; type?: string; file_path: string; file_size: number; mime_type: string; description?: string | null; category?: 'before' | 'during' | 'after' }
  ) => {
    const isPhoto = metadata.type === 'photo'
    const photoCategory = isPhoto ? metadata.category : undefined
    return apiRequest<{ data: any }>(`/api/jobs/${id}/documents`, {
      method: 'POST',
      body: JSON.stringify({
        name: metadata.name,
        type: metadata.type || 'photo',
        file_path: metadata.file_path,
        file_size: metadata.file_size,
        mime_type: metadata.mime_type,
        description: metadata.description ?? null,
        ...(isPhoto && photoCategory ? { category: photoCategory } : {}),
      }),
    })
  },

  uploadDocument: async (id: string, file: File, metadata: { name: string; type?: string; description?: string; category?: 'before' | 'during' | 'after' }) => {
    const supabase = createSupabaseBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Get user's organization_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.organization_id) {
      throw new Error('Failed to get organization ID')
    }

    const organizationId = userData.organization_id

    // Upload to Supabase storage - path must start with organization_id for RLS
    const fileExt = file.name.split('.').pop()
    const fileName = `${organizationId}/${id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) throw uploadError
    if (!uploadData?.path) throw new Error('Upload failed')

    // Save metadata via backend (category for photos: before/during/after; always include when type is photo)
    const isPhoto = metadata.type === 'photo'
    const photoCategory = isPhoto ? (metadata.category ?? 'during') : undefined
    return apiRequest<{ data: any }>(`/api/jobs/${id}/documents`, {
      method: 'POST',
      body: JSON.stringify({
        name: metadata.name || file.name,
        type: metadata.type || 'photo',
        file_path: uploadData.path,
        file_size: file.size,
        mime_type: file.type,
        description: metadata.description || null,
        ...(isPhoto && photoCategory ? { category: photoCategory } : {}),
      }),
    })
  },

  updateDocumentCategory: async (jobId: string, docId: string, category: 'before' | 'during' | 'after') => {
    return apiRequest<{ ok: boolean; data: any }>(`/api/jobs/${jobId}/documents/${docId}`, {
      method: 'PATCH',
      body: JSON.stringify({ category }),
    })
  },

  full: async (id: string) =>
    apiRequest<JobReportData>(`/api/jobs/${id}/full`),

  generatePermitPack: async (id: string) => {
    return apiRequest<{
      success: boolean;
      data: {
        downloadUrl: string;
        filePath: string;
        size: number;
      };
    }>(`/api/jobs/${id}/permit-pack`, {
      method: 'POST',
    });
  },

  getPermitPacks: async (id: string) => {
    return apiRequest<{
      data: Array<{
        id: string;
        version: number;
        file_path: string;
        generated_at: string;
        generated_by: string | null;
        downloadUrl: string | null;
      }>;
    }>(`/api/jobs/${id}/permit-packs`);
  },

  assignWorker: async (jobId: string, workerId: string) => {
    return apiRequest<{ data: any }>(`/api/jobs/${jobId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ worker_id: workerId }),
    });
  },

  unassignWorker: async (jobId: string, workerId: string) => {
    return apiRequest<{ success: boolean; message: string }>(`/api/jobs/${jobId}/assign`, {
      method: 'DELETE',
      body: JSON.stringify({ worker_id: workerId }),
    });
  },

  verifyEvidence: async (jobId: string, docId: string, status: 'approved' | 'rejected', reason?: string) => {
    return apiRequest<{ success: boolean; data: any }>(`/api/jobs/${jobId}/evidence/${docId}/verify`, {
      method: 'POST',
      body: JSON.stringify({ status, reason }),
    });
  },

  getAuditLog: async (jobId: string) => {
    try {
      return await apiRequest<{ data: any[] }>(`/api/jobs/${jobId}/audit`);
    } catch (err: any) {
      // Silently handle plan-gate 403s (expected for starter plan)
      if (err?.code === 'FEATURE_RESTRICTED' || err?.code === 'PLAN_TIER_INSUFFICIENT') {
        // Return empty data so UI doesn't break, but also doesn't spam errors
        return { data: [] } as { data: any[] };
      }
      // Re-throw other errors
      throw err;
    }
  },

  /**
   * GET /api/jobs/[id]/activity - paginated job activity with optional filters.
   * Params: limit, offset, actor_id, event_type, category, start_date, end_date.
   */
  getJobActivity: async (
    jobId: string,
    params?: {
      limit?: number;
      offset?: number;
      actor_id?: string;
      event_type?: string;
      event_types?: string[];
      category?: string;
      start_date?: string;
      end_date?: string;
    }
  ) => {
    const searchParams = new URLSearchParams();
    if (params?.limit != null) searchParams.set('limit', String(params.limit));
    if (params?.offset != null) searchParams.set('offset', String(params.offset));
    if (params?.actor_id) searchParams.set('actor_id', params.actor_id);
    if (params?.event_type) searchParams.set('event_type', params.event_type);
    if (params?.category) searchParams.set('category', params.category);
    if (params?.start_date) searchParams.set('start_date', params.start_date);
    if (params?.end_date) searchParams.set('end_date', params.end_date);
    if (params?.event_types?.length) searchParams.set('event_types', params.event_types.join(','));
    const qs = searchParams.toString();
    const url = qs ? `/api/jobs/${jobId}/activity?${qs}` : `/api/jobs/${jobId}/activity`;
    return apiRequest<{ data: { events: any[]; total: number; has_more: boolean } }>(url);
  },

  /**
   * POST /api/jobs/[id]/activity/subscribe - get channelId and organizationId for realtime.
   * Returns null on 404 or 403 so caller can skip subscribing.
   */
  subscribeJobActivity: async (
    jobId: string
  ): Promise<{ channelId: string; organizationId: string } | null> => {
    const token = await getAuthToken();
    const url = `${API_URL}/api/jobs/${jobId}/activity/subscribe`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
    if (res.status === 404 || res.status === 403) return null;
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.message || data?.detail || res.statusText);
    }
    const json = await res.json();
    const data = json?.data ?? json;
    return { channelId: data.channelId, organizationId: data.organizationId };
  },

  exportProofPack: async (jobId: string, packType: 'insurance' | 'audit' | 'incident' | 'compliance') => {
    // Use the new Packet Engine endpoint
    return apiRequest<{
      data: {
        report_run_id: string
        pdf_url: string | null
        pdf_base64: string
        storage_path: string
        data_hash: string
        generated_at: string
        status: string
        packet_type: string
        requestId?: string
      }
    }>(`/api/reports/generate/${jobId}`, {
      method: 'POST',
      body: JSON.stringify({ 
        status: 'draft',
        packetType: packType === 'compliance' ? 'client_compliance' : packType,
      }),
    });
  },

  getSignoffs: async (jobId: string) => {
    return apiRequest<{ data: any[] }>(`/api/jobs/${jobId}/signoffs`);
  },

  createSignoff: async (jobId: string, signoffType: string, comments: string, role: string) => {
    return apiRequest<{ data: any }>(`/api/jobs/${jobId}/signoffs`, {
      method: 'POST',
      body: JSON.stringify({ signoff_type: signoffType, comments, role }),
    });
  },

  archive: async (jobId: string) => {
    return apiRequest<{
      data: {
        id: string;
        archived_at: string;
        status: string;
      };
    }>(`/api/jobs/${jobId}/archive`, {
      method: 'POST',
    });
  },

  flag: async (jobId: string, flagged: boolean) => {
    return apiRequest<{ id: string; review_flag: boolean; flagged_at: string | null }>(`/api/jobs/${jobId}/flag`, {
      method: 'PATCH',
      body: JSON.stringify({ flagged }),
    });
  },

  delete: async (jobId: string) => {
    return apiRequest<{
      data: {
        id: string;
        deleted_at: string;
      };
    }>(`/api/jobs/${jobId}`, {
      method: 'DELETE',
    });
  },
};

// Risk API
export const riskApi = {
  getFactors: async () => {
    return apiRequest<{ data: any[] }>('/api/risk/factors');
  },

  getSummary: async () => {
    return apiRequest<{ hazards: any[] }>('/api/risk/summary');
  },
};

// Subscriptions API
export const subscriptionsApi = {
  get: async () => {
    return apiRequest<{
      data: {
        id: string | null;
        organization_id: string;
        tier: string | null;
        status: string | null;
        current_period_start: string | null;
        current_period_end: string | null;
        cancel_at_period_end: boolean | null;
        stripe_subscription_id: string | null;
        stripe_customer_id: string | null;
        usage: number | null;
        jobsLimit: number | null;
        resetDate: string | null;
      };
    }>('/api/subscriptions');
  },

  createPortalSession: async () => {
    return apiRequest<{ url: string }>('/api/subscriptions/portal', {
      method: 'POST',
    });
  },

  createCheckoutSession: async (payload: { plan: 'starter' | 'pro' | 'business'; success_url?: string; cancel_url?: string; idempotency_key?: string }) => {
    return apiRequest<{ url: string }>('/api/subscriptions/checkout', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  confirmCheckout: async (sessionId: string) => {
    return apiRequest<{ status: string }>('/api/subscriptions/confirm', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    });
  },

  switchPlan: async (plan: 'starter' | 'pro' | 'business') => {
    return apiRequest<{ success: boolean; message?: string; plan?: string; url?: string }>('/api/subscriptions/switch', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    });
  },

  cancel: async (mode: 'immediate' | 'period_end' = 'immediate') => {
    return apiRequest<{ 
      success: boolean; 
      message: string; 
      cancel_at_period_end: boolean;
      current_period_end?: number;
      noop?: boolean;
      alreadyCanceled?: boolean;
      alreadyScheduled?: boolean;
      canceled_immediately?: boolean;
    }>('/api/subscriptions/cancel', {
      method: 'POST',
      body: JSON.stringify({ mode }),
    });
  },

  resume: async () => {
    return apiRequest<{ 
      success: boolean; 
      message: string; 
      cancel_at_period_end: boolean;
      current_period_end: number;
      noop?: boolean;
      alreadyResumed?: boolean;
    }>('/api/subscriptions/resume', {
      method: 'POST',
    });
  },
};

// Team API
export const teamApi = {
  get: async () =>
    apiRequest<{
      members: Array<{
        id: string;
        email: string;
        full_name: string | null;
        role: string;
        created_at: string;
        must_reset_password: boolean;
      }>;
      invites: Array<{
        id: string;
        email: string;
        role: string;
        created_at: string;
        invited_by?: string | null;
        user_id?: string | null;
      }>;
      seats: { limit: number | null; used: number; pending: number; available: number | null };
      risk_coverage?: {
        owner: number;
        admin: number;
        safety_lead: number;
        executive: number;
        member: number;
      };
      current_user_role: string;
      plan: string;
    }>('/api/team'),
  invite: async (payload: { email: string; role: 'owner' | 'admin' | 'safety_lead' | 'executive' | 'member' }) =>
    apiRequest<{
      data: { id: string; email: string; role: string; created_at: string; user_id?: string | null } | null;
      temporary_password: string;
      seats_remaining: number | null;
    }>('/api/team/invite', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  revokeInvite: async (inviteId: string) =>
    apiRequest(`/api/team/invite/${inviteId}`, { method: 'DELETE' }),
  removeMember: async (memberId: string) =>
    apiRequest(`/api/team/member/${memberId}`, { method: 'DELETE' }),
  acknowledgeReset: async () =>
    apiRequest('/api/team/acknowledge-reset', { method: 'POST' }),
};

// Reports API
export type ReportResponse = {
  data: {
    id: string | null
    pdf_url: string | null
    storage_path: string | null
    hash: string | null
    pdf_base64?: string | null
    generated_at: string
    snapshot_id?: string | null
  }
}

export const reportsApi = {
  generate: async (jobId: string) => {
    return apiRequest<ReportResponse>(`/api/reports/generate/${jobId}`, { method: 'POST' });
  },

  get: async (jobId: string) => apiRequest<{ data: any }>(`/api/reports/${jobId}`),

  share: async (jobId: string) =>
    apiRequest<{ data: { url: string; token: string; expires_at: string } }>(
      `/api/reports/share/${jobId}`,
      { method: 'POST' }
    ),
};

// Analytics API
export const analyticsApi = {
  mitigations: async (params?: { orgId?: string; range?: string; crewId?: string }) => {
    const query = new URLSearchParams();
    if (params?.orgId) query.set('org_id', params.orgId);
    if (params?.range) query.set('range', params.range);
    if (params?.crewId) query.set('crew_id', params.crewId);

    const qs = query.toString();
    const endpoint = qs ? `/api/analytics/mitigations?${qs}` : `/api/analytics/mitigations`;

    return apiRequest<{
      org_id: string;
      range_days: number;
      completion_rate: number;
      avg_time_to_close_hours: number;
      high_risk_jobs: number;
      evidence_count: number;
      jobs_with_evidence: number;
      jobs_without_evidence: number;
      avg_time_to_first_evidence_hours: number;
      trend: Array<{ date: string; completion_rate: number }>;
      // Explicit evidence denominators
      jobs_total?: number;
      jobs_scored?: number;
      jobs_with_any_evidence?: number;
      jobs_with_photo_evidence?: number;
      jobs_missing_required_evidence?: number;
      required_evidence_policy?: string;
      avg_time_to_first_photo_minutes?: number | null;
      // Empty state reasons
      trend_empty_reason?: 'no_jobs' | 'no_events' | null;
    }>(endpoint);
  },
};

// Legal API - uses Next.js API routes (relative paths)
async function nextApiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken();
  
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message = isJson ? (data?.detail || data?.message) : data || response.statusText;
    const error: Error & ApiError = new Error(message || 'API request failed') as Error & ApiError;
    if (isJson && data?.code) {
      error.code = data.code;
    }
    throw error;
  }

  return data as T;
}

export const legalApi = {
  getVersion: async () =>
    nextApiRequest<{ version: string; updated_at: string }>('/api/legal/version'),
  getStatus: async () =>
    nextApiRequest<{ accepted: boolean; accepted_at: string | null; version: string }>(
      '/api/legal/status'
    ),
  accept: async () =>
    nextApiRequest<{ accepted: boolean; accepted_at: string; version: string }>(
      '/api/legal/accept',
      { method: 'POST' }
    ),
};

// Account API
export const accountApi = {
  updateProfile: async (updates: { full_name?: string | null; phone?: string | null }) => {
    return apiRequest<{ data: any; message: string }>('/api/account/profile', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  updateOrganization: async (name: string) => {
    return apiRequest<{ data: any; message: string }>('/api/account/organization', {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  },

  getBilling: async () => {
    return apiRequest<{
      data: {
        tier: string | null;
        status: string;
        stripe_customer_id: string | null;
        stripe_subscription_id: string | null;
        current_period_start: string | null;
        current_period_end: string | null;
        cancel_at_period_end: boolean | null;
        renewal_date: string | null;
        seats_used: number;
        seats_limit: number | null;
        jobs_limit: number | null;
        managed_by: 'stripe' | 'internal';
      };
    }>('/api/account/billing');
  },

  revokeSessions: async () => {
    return apiRequest<{ message: string }>('/api/account/security/revoke-sessions', {
      method: 'POST',
    });
  },

  getSecurityEvents: async (limit?: number) => {
    const params = limit ? `?limit=${limit}` : '';
    return apiRequest<{ data: any[] }>(`/api/account/security/events${params}`);
  },

  deactivateAccount: async (confirmation: string, reason?: string, transfer_to_user_id?: string) => {
    return apiRequest<{ message: string; retention_days: number }>('/api/account/deactivate', {
      method: 'POST',
      body: JSON.stringify({ confirmation, reason, transfer_to_user_id }),
    });
  },

  getEntitlements: async () => {
    return apiRequest<{
      ok: boolean;
      data: {
        organization_id: string;
        user_id: string;
        role: string;
        plan_code: 'none' | 'starter' | 'pro' | 'business';
        status: string;
        limits: {
          seats: {
            limit: number | null;
            used: number;
            available: number | null;
          };
          jobs_monthly: {
            limit: number | null;
          };
        };
        features: string[];
        flags: {
          cancel_at_period_end: boolean;
          current_period_end: string | null;
          legal_accepted: boolean;
          must_reset_password: boolean;
        };
      };
    }>('/api/account/entitlements');
  },
};

export const executiveApi = {
  getRiskPosture: async (params?: { time_range?: '7d' | '30d' | '90d' | 'all' }) => {
    const queryParams = params?.time_range ? `?time_range=${params.time_range}` : ''
    return apiRequest<{
      data: {
        exposure_level: 'low' | 'moderate' | 'high'
        unresolved_violations: number
        open_reviews: number
        high_risk_jobs: number
        open_incidents: number
        pending_signoffs: number
        signed_signoffs: number
        proof_packs_generated: number
        last_material_event_at: string | null
        confidence_statement: string
        ledger_integrity: 'verified' | 'error' | 'not_verified'
        ledger_integrity_last_verified_at: string | null
        ledger_integrity_verified_through_event_id: string | null
        ledger_integrity_error_details?: {
          failingEventId?: string
          expectedHash?: string
          gotHash?: string
          eventIndex?: number
        }
        flagged_jobs: number
        signed_jobs: number
        unsigned_jobs: number
        recent_violations: number
        drivers: {
          highRiskJobs: Array<{ key: string; label: string; count: number; href?: string }>
          openIncidents: Array<{ key: string; label: string; count: number; href?: string }>
          violations: Array<{ key: string; label: string; count: number; href?: string }>
          flagged: Array<{ key: string; label: string; count: number; href?: string }>
          pending: Array<{ key: string; label: string; count: number; href?: string }>
          signed: Array<{ key: string; label: string; count: number; href?: string }>
          proofPacks: Array<{ key: string; label: string; count: number; href?: string }>
        }
        deltas: {
          high_risk_jobs: number
          open_incidents: number
          violations: number
          flagged_jobs: number
          pending_signoffs: number
          signed_signoffs: number
          proof_packs: number
        }
        recommended_actions: Array<{
          priority: number
          action: string
          href: string
          reason: string
        }>
      }
    }>(`/api/executive/risk-posture${queryParams}`)
  },
}

export const auditApi = {
  /**
   * Get audit readiness data
   */
  getReadiness: async (params?: {
    category?: 'evidence' | 'controls' | 'attestations' | 'incidents' | 'access'
    time_range?: '24h' | '7d' | '30d' | '90d' | 'all'
    severity?: 'critical' | 'material' | 'info'
    status?: 'open' | 'in_progress' | 'waived' | 'resolved'
    job_id?: string
    site_id?: string
    owner_id?: string
  }) => {
    const queryParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value))
        }
      })
    }
    return apiRequest<ReadinessResponse>(`/api/audit/readiness${queryParams.toString() ? `?${queryParams.toString()}` : ''}`)
  },

  /**
   * Resolve a single readiness item
   */
  resolveReadiness: async (params: {
    readiness_item_id: string;
    rule_code: string;
    action_type: 'create_evidence' | 'request_attestation' | 'create_control' | 'mark_resolved';
    payload?: any;
    idempotencyKey?: string;
  }) => {
    return fetchWithIdempotency<{
      success: boolean;
      message: string;
      ledger_entry_id: string;
      action_type: string;
      result: any;
    }>('/api/audit/readiness/resolve', {
      method: 'POST',
      body: JSON.stringify({
        readiness_item_id: params.readiness_item_id,
        rule_code: params.rule_code,
        action_type: params.action_type,
        payload: params.payload,
      }),
      idempotencyKey: params.idempotencyKey,
    });
  },

  /**
   * Bulk resolve multiple readiness items
   */
  bulkResolveReadiness: async (params: {
    items: Array<{
      readiness_item_id: string;
      rule_code: string;
      action_type: 'create_evidence' | 'request_attestation' | 'create_control' | 'mark_resolved';
      payload?: any;
      idempotency_key?: string;
    }>;
    baseIdempotencyKey?: string; // Optional base key (will generate if not provided)
  }) => {
    // Generate base key if not provided
    const baseKey = params.baseIdempotencyKey ?? crypto.randomUUID();
    
    // Add per-item idempotency keys
    const itemsWithKeys = params.items.map(item => ({
      ...item,
      idempotency_key: item.idempotency_key || generateBulkIdempotencyKey(baseKey, item.readiness_item_id),
    }));

    return fetchWithIdempotency<{
      success: boolean;
      total: number;
      successful: number;
      failed: number;
      results: Array<{
        readiness_item_id: string;
        rule_code: string;
        success: boolean;
        result?: any;
        error?: string;
      }>;
      failed_items: Array<{
        readiness_item_id: string;
        rule_code: string;
        action_type: string;
        error: string;
      }>;
    }>('/api/audit/readiness/bulk-resolve', {
      method: 'POST',
      body: JSON.stringify({ items: itemsWithKeys }),
      idempotencyKey: baseKey, // Use base key for the bulk request itself
    });
  },

  getEvents: async (params?: {
    category?: 'governance' | 'operations' | 'access'
    site_id?: string
    job_id?: string
    actor_id?: string
    severity?: 'info' | 'material' | 'critical'
    outcome?: 'allowed' | 'blocked'
    time_range?: '24h' | '7d' | '30d' | 'all' | 'custom'
    start_date?: string
    end_date?: string
    view?: 'review-queue' | 'insurance-ready' | 'governance-enforcement' | 'incident-review' | 'access-review'
    cursor?: string
    limit?: number
    debug?: boolean
  }) => {
    const queryParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value))
        }
      })
    }
    const token = await getAuthToken()
    // Use centralized BACKEND_URL - always call backend directly
    const url = `${API_URL}/api/audit/events?${queryParams.toString()}`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    })
    
    if (!response.ok) {
      // Check if we got HTML (404 page) instead of JSON
      const contentType = response.headers.get('content-type')
      if (contentType?.includes('text/html')) {
        throw new Error(`Backend API not found. Please check NEXT_PUBLIC_BACKEND_URL is set correctly. Attempted: ${url}`)
      }
      const error = await response.json().catch(() => ({ message: 'Failed to fetch ledger events' }))
      throw new Error(error.message || 'Failed to fetch ledger events')
    }
    
    return response.json()
  },
  export: async (params: {
    format: 'pdf' | 'csv' | 'json'
    category?: 'governance' | 'operations' | 'access'
    site_id?: string
    job_id?: string
    actor_id?: string
    severity?: 'info' | 'material' | 'critical'
    outcome?: 'allowed' | 'blocked'
    time_range?: '24h' | '7d' | '30d' | 'all' | 'custom'
    start_date?: string
    end_date?: string
    view?: 'review-queue' | 'insurance-ready' | 'governance-enforcement' | 'incident-review' | 'access-review'
    export_type?: 'ledger' | 'controls' | 'attestations'
  }) => {
    const endpoint = params.export_type === 'controls' 
      ? '/api/audit/export/controls'
      : params.export_type === 'attestations'
      ? '/api/audit/export/attestations'
      : '/api/audit/export'
    
    const token = await getAuthToken()
    // Use centralized BACKEND_URL - always call backend directly
    const apiUrl = `${API_URL}${endpoint}`
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify(params),
    })

    if (!response.ok) {
      // Check if we got HTML (404/405 page) instead of JSON
      const contentType = response.headers.get('content-type')
      if (contentType?.includes('text/html')) {
        throw new Error(`Backend API not found. Please check NEXT_PUBLIC_BACKEND_URL is set correctly. Attempted: ${apiUrl}`)
      }
      const error = await response.json().catch(() => ({ message: 'Export failed' }))
      throw new Error(error.message || 'Export failed')
    }

    // Handle file download
    const blob = await response.blob()
    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    
    const contentDisposition = response.headers.get('Content-Disposition')
    const filename = contentDisposition 
      ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || 'export'
      : `export.${params.format}`
    
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(downloadUrl)
    
    return { success: true }
  },
}

