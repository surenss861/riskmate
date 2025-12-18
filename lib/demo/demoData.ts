/**
 * Demo Data Fixtures
 * Complete app state for /demo page - no backend required
 */

export type DemoRole = 'owner' | 'admin' | 'safety_lead' | 'executive' | 'member'
export type DemoScenario = 'normal' | 'audit_review' | 'incident' | 'insurance_packet'

export const demoData = {
  organization: {
    id: 'demo-org-001',
    name: 'Acme Construction Co.',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2025-01-10T14:30:00Z',
  },

  billing: {
    tier: 'pro' as const,
    status: 'active',
    renewal_date: '2025-02-15',
    seats_used: 8,
    seats_limit: 20,
    jobs_limit: null,
    provider_customer_id: 'cus_demo_stripe_123',
    provider_subscription_id: 'sub_demo_stripe_456',
    plan: 'pro',
    current_period_end: '2025-02-15T00:00:00Z',
  },

  profile: {
    id: 'demo-user-001',
    email: 'demo@acmeconstruction.com',
    full_name: 'John Smith',
    phone: '+1 (555) 123-4567',
    role: 'owner' as DemoRole,
    updated_at: '2025-01-10T14:30:00Z',
  },

  teamMembers: [
    {
      id: 'demo-user-001',
      email: 'demo@acmeconstruction.com',
      full_name: 'John Smith',
      role: 'owner',
      created_at: '2024-01-15T10:00:00Z',
      must_reset_password: false,
    },
    {
      id: 'demo-user-002',
      email: 'sarah.jones@acmeconstruction.com',
      full_name: 'Sarah Jones',
      role: 'safety_lead',
      created_at: '2024-02-01T09:00:00Z',
      must_reset_password: false,
    },
    {
      id: 'demo-user-003',
      email: 'mike.wilson@acmeconstruction.com',
      full_name: 'Mike Wilson',
      role: 'admin',
      created_at: '2024-02-10T11:00:00Z',
      must_reset_password: false,
    },
    {
      id: 'demo-user-004',
      email: 'exec@acmeconstruction.com',
      full_name: 'Executive View',
      role: 'executive',
      created_at: '2024-03-01T08:00:00Z',
      must_reset_password: false,
    },
    {
      id: 'demo-user-005',
      email: 'field.worker@acmeconstruction.com',
      full_name: 'Alex Field',
      role: 'member',
      created_at: '2024-03-15T12:00:00Z',
      must_reset_password: false,
    },
  ],

  jobs: [
    {
      id: 'demo-job-001',
      client_name: 'Downtown Office Complex',
      job_type: 'Commercial Renovation',
      location: '123 Main St, City, ST 12345',
      status: 'in_progress',
      risk_score: 87,
      risk_level: 'high',
      created_at: '2025-01-10T08:00:00Z',
      updated_at: '2025-01-15T14:30:00Z',
      applied_template_id: 'demo-template-001',
      applied_template_type: 'job' as const,
      review_flag: true,
      flagged_at: '2025-01-12T10:00:00Z',
    },
    {
      id: 'demo-job-002',
      client_name: 'Residential Deck Installation',
      job_type: 'Residential Construction',
      location: '456 Oak Ave, Suburb, ST 67890',
      status: 'in_progress',
      risk_score: 45,
      risk_level: 'medium',
      created_at: '2025-01-08T09:00:00Z',
      updated_at: '2025-01-14T16:20:00Z',
      applied_template_id: null,
      applied_template_type: null,
      review_flag: false,
      flagged_at: null,
    },
    {
      id: 'demo-job-003',
      client_name: 'Warehouse Electrical Upgrade',
      job_type: 'Electrical Work',
      location: '789 Industrial Blvd, City, ST 11111',
      status: 'completed',
      risk_score: 92,
      risk_level: 'high',
      created_at: '2024-12-20T07:00:00Z',
      updated_at: '2025-01-05T17:00:00Z',
      applied_template_id: 'demo-template-002',
      applied_template_type: 'job' as const,
      review_flag: true,
      flagged_at: '2024-12-22T09:00:00Z',
    },
    {
      id: 'demo-job-004',
      client_name: 'Kitchen Remodel',
      job_type: 'Residential Renovation',
      location: '321 Elm St, Town, ST 22222',
      status: 'draft',
      risk_score: 23,
      risk_level: 'low',
      created_at: '2025-01-12T10:00:00Z',
      updated_at: '2025-01-12T10:00:00Z',
      applied_template_id: null,
      applied_template_type: null,
      review_flag: false,
      flagged_at: null,
    },
    {
      id: 'demo-job-005',
      client_name: 'Roofing Replacement',
      job_type: 'Roofing',
      location: '555 Pine Rd, City, ST 33333',
      status: 'in_progress',
      risk_score: 78,
      risk_level: 'high',
      created_at: '2025-01-05T06:00:00Z',
      updated_at: '2025-01-13T11:45:00Z',
      applied_template_id: 'demo-template-001',
      applied_template_type: 'job' as const,
      review_flag: false,
      flagged_at: null,
    },
  ],

  auditLogs: [
    {
      id: 'demo-audit-001',
      organization_id: 'demo-org-001',
      actor_id: 'demo-user-002',
      event_name: 'job.flagged_for_review',
      target_type: 'job',
      target_id: 'demo-job-001',
      metadata: {
        flagged: true,
        flagged_at: '2025-01-12T10:00:00Z',
      },
      created_at: '2025-01-12T10:00:00Z',
    },
    {
      id: 'demo-audit-002',
      organization_id: 'demo-org-001',
      actor_id: 'demo-user-001',
      event_name: 'auth.role_violation',
      target_type: 'job',
      target_id: 'demo-job-002',
      metadata: {
        role: 'member',
        attempted_action: 'flag_job',
        result: 'denied',
        reason: 'Role does not have flag_job capability',
      },
      created_at: '2025-01-09T14:20:00Z',
    },
    {
      id: 'demo-audit-003',
      organization_id: 'demo-org-001',
      actor_id: 'demo-user-003',
      event_name: 'team.member_removed',
      target_type: 'user',
      target_id: 'demo-user-removed',
      metadata: {
        email: 'former.employee@acmeconstruction.com',
        role: 'member',
      },
      created_at: '2025-01-08T16:00:00Z',
    },
    {
      id: 'demo-audit-004',
      organization_id: 'demo-org-001',
      actor_id: 'demo-user-001',
      event_name: 'account.organization_updated',
      target_type: 'organization',
      target_id: 'demo-org-001',
      metadata: {
        field: 'name',
        old_value: 'Acme Construction',
        new_value: 'Acme Construction Co.',
      },
      created_at: '2025-01-10T14:30:00Z',
    },
  ],

  securityEvents: [
    {
      id: 'demo-security-001',
      user_id: 'demo-user-001',
      event_name: 'password_changed',
      ip_address: '192.168.1.100',
      user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      metadata: {},
      created_at: '2025-01-05T09:00:00Z',
    },
    {
      id: 'demo-security-002',
      user_id: 'demo-user-001',
      event_name: 'login',
      ip_address: '192.168.1.100',
      user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      metadata: {},
      created_at: '2025-01-15T08:30:00Z',
    },
    {
      id: 'demo-security-003',
      user_id: 'demo-user-002',
      event_name: 'login',
      ip_address: '10.0.0.50',
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      metadata: {},
      created_at: '2025-01-15T07:15:00Z',
    },
  ],

  templates: {
    hazard: [
      {
        id: 'demo-template-hazard-001',
        name: 'Electrical Safety Checklist',
        description: 'Standard electrical safety protocols',
        risk_factor_codes: ['ELEC_001', 'ELEC_002'],
        created_at: '2024-11-01T10:00:00Z',
      },
      {
        id: 'demo-template-hazard-002',
        name: 'Fall Protection Protocol',
        description: 'Height work safety requirements',
        risk_factor_codes: ['FALL_001', 'FALL_002'],
        created_at: '2024-11-05T14:00:00Z',
      },
    ],
    job: [
      {
        id: 'demo-template-001',
        name: 'Commercial Renovation Template',
        description: 'Standard template for commercial renovation projects',
        risk_factor_codes: ['COMM_001', 'COMM_002', 'ELEC_001'],
        created_at: '2024-10-15T09:00:00Z',
      },
      {
        id: 'demo-template-002',
        name: 'Electrical Work Template',
        description: 'Template for electrical installation and upgrades',
        risk_factor_codes: ['ELEC_001', 'ELEC_002', 'ELEC_003'],
        created_at: '2024-10-20T11:00:00Z',
      },
    ],
  },

  templateLimitInfo: {
    current: 4,
    limit: 20,
  },
}

export const getDemoDataForRole = (role: DemoRole) => {
  const baseData = { ...demoData }
  
  // Adjust data visibility based on role
  if (role === 'executive') {
    // Executives see read-only view
    return {
      ...baseData,
      profile: {
        ...baseData.profile,
        role: 'executive' as DemoRole,
      },
    }
  }
  
  if (role === 'member') {
    // Members don't see flagged jobs in their default view
    return {
      ...baseData,
      profile: {
        ...baseData.profile,
        role: 'member' as DemoRole,
      },
    }
  }
  
  return {
    ...baseData,
    profile: {
      ...baseData.profile,
      role,
    },
  }
}

