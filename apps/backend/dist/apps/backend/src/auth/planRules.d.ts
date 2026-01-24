export type PlanCode = 'none' | 'starter' | 'pro' | 'business';
export type PlanFeature = 'share_links' | 'branded_pdfs' | 'notifications' | 'analytics' | 'permit_pack' | 'audit_logs' | 'priority_support';
export interface PlanLimits {
    seats: number | null;
    jobsMonthly: number | null;
    features: PlanFeature[];
}
export declare function limitsFor(plan: PlanCode): PlanLimits;
export declare const STRIPE_PLAN_MAP: Record<string, PlanCode>;
//# sourceMappingURL=planRules.d.ts.map