export type PlanCode = 'none' | 'starter' | 'pro' | 'business'

export interface PlanLimits {
  seats: number | null
  jobsMonthly: number | null
}

export function limitsFor(plan: PlanCode): PlanLimits {
  switch (plan) {
    case 'none':
      return {
        seats: 0,
        jobsMonthly: 0, // No plan: no access
      }
    case 'starter':
      return {
        seats: 1,
        jobsMonthly: 3, // Free plan: 3 jobs/month
      }
    case 'pro':
      return {
        seats: 5,
        jobsMonthly: null, // unlimited
      }
    case 'business':
      return {
        seats: null, // unlimited
        jobsMonthly: null, // unlimited
      }
    default:
      return {
        seats: 0,
        jobsMonthly: 0,
      }
  }
}

