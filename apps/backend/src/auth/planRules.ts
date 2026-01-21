export type PlanCode = 'starter' | 'pro' | 'business';

export type PlanFeature = 
  | 'share_links'
  | 'branded_pdfs'
  | 'notifications'
  | 'analytics'
  | 'permit_pack'
  | 'audit_logs'
  | 'priority_support';

export interface PlanLimits {
  seats: number | null;
  jobsMonthly: number | null;
  features: PlanFeature[];
}

export function limitsFor(plan: PlanCode): PlanLimits {
  switch (plan) {
    case 'starter':
      return { 
        seats: 1, 
        jobsMonthly: 10, 
        features: ['share_links'] 
      };
    case 'pro':
      return { 
        seats: 5, 
        jobsMonthly: null, 
        features: ['branded_pdfs', 'share_links', 'notifications'] 
      };
    case 'business':
      return { 
        seats: null, 
        jobsMonthly: null, 
        features: [
          'branded_pdfs', 
          'share_links', 
          'notifications', 
          'analytics', 
          'permit_pack', 
          'audit_logs', 
          'priority_support'
        ] 
      };
  }
}

export const STRIPE_PLAN_MAP: Record<string, PlanCode> = {
  'prod_TpcwqnpnlA9keA': 'starter',   // Starter
  'prod_TpcyAbLnS5VDz7': 'pro',       // Pro
  'prod_TpczVi0pxfQhfH': 'business',  // Business
};

