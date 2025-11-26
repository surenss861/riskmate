export type PlanCode = 'starter' | 'pro' | 'business'

export interface PlanLimits {
  seats: number | null
  jobsMonthly: number | null
}

export function limitsFor(plan: PlanCode): PlanLimits {
  switch (plan) {
    case 'starter':
      return {
        seats: 1,
        jobsMonthly: 10,
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

