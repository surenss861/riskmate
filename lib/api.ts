/**
 * API client for RiskMate backend
 */

import { JobReportData } from '@/types/report'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

// Use relative paths for Next.js API routes
// In production (Vercel), always use relative paths regardless of env var
// Only use backend URL in local development
const getApiUrl = () => {
  if (typeof window === 'undefined') return '' // Server-side: always relative
  
  // Check if we're on Vercel production domain
  const isProduction = window.location.hostname.includes('vercel.app') || 
                       window.location.hostname.includes('riskmate.vercel.app')
  
  // Force relative paths in production
  if (isProduction) return ''
  
  // In development, use env var or default to empty (relative)
  return process.env.NEXT_PUBLIC_BACKEND_URL || ''
}

const API_URL = getApiUrl()

export interface ApiError {
  message: string;
  code?: string;
}

async function getAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  
  return session?.access_token || null;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();
  
  // Use API_URL if set, otherwise use relative path (Next.js API routes)
  const url = API_URL ? `${API_URL}${endpoint}` : endpoint;
  
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

  if (!response.ok) {
    const message = isJson ? (data?.detail || data?.message) : data || response.statusText;
    const error: Error & ApiError = new Error(message || 'API request failed') as Error & ApiError;
    if (isJson && data?.code) {
      error.code = data.code;
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
    status?: string; 
    risk_level?: string;
    include_archived?: boolean;
    sort?: string;
    cursor?: string;
    debug?: boolean;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.status) queryParams.set('status', params.status);
    if (params?.risk_level) queryParams.set('risk_level', params.risk_level);
    if (params?.include_archived) queryParams.set('include_archived', 'true');
    if (params?.sort) queryParams.set('sort', params.sort);
    if (params?.cursor) queryParams.set('cursor', params.cursor);
    if (params?.debug && process.env.NODE_ENV === 'development') {
      queryParams.set('debug', '1');
    }
    
    return apiRequest<{ 
      data: any[]; 
      pagination: {
        page?: number;
        limit: number;
        total: number;
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

  uploadDocument: async (id: string, file: File, metadata: { name: string; type?: string; description?: string }) => {
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

    // Save metadata via backend
    return apiRequest<{ data: any }>(`/api/jobs/${id}/documents`, {
      method: 'POST',
      body: JSON.stringify({
        name: metadata.name || file.name,
        type: metadata.type || 'photo',
        file_path: uploadData.path,
        file_size: file.size,
        mime_type: file.type,
        description: metadata.description || null,
      }),
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
    return apiRequest<{ data: any[] }>(`/api/jobs/${jobId}/audit`);
  },

  exportProofPack: async (jobId: string, packType: 'insurance' | 'audit' | 'incident' | 'compliance') => {
    return apiRequest<{
      data: {
        id: string | null
        pdf_url: string
        pdf_base64: string
        hash: string
        generated_at: string
      }
    }>(`/api/jobs/${jobId}/proof-pack`, {
      method: 'POST',
      body: JSON.stringify({ pack_type: packType }),
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

  createCheckoutSession: async (payload: { plan: 'starter' | 'pro' | 'business'; success_url?: string; cancel_url?: string }) => {
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

  deactivateAccount: async (confirmation: string, reason?: string) => {
    return apiRequest<{ message: string; retention_days: number }>('/api/account/deactivate', {
      method: 'POST',
      body: JSON.stringify({ confirmation, reason }),
    });
  },
};

