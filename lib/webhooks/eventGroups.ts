import { WEBHOOK_EVENT_TYPES } from './eventTypes'

/** UI grouping derived from WEBHOOK_EVENT_TYPES so new event types appear automatically. */
export const EVENT_GROUPS: { label: string; events: string[] }[] = [
  { label: 'Jobs', events: [...WEBHOOK_EVENT_TYPES.filter((e) => e.startsWith('job.'))] },
  { label: 'Hazards', events: [...WEBHOOK_EVENT_TYPES.filter((e) => e.startsWith('hazard.'))] },
  { label: 'Other', events: [...WEBHOOK_EVENT_TYPES.filter((e) => !e.startsWith('job.') && !e.startsWith('hazard.'))] },
]
