/**
 * Regression tests for job activity feed: include audit events with metadata.job_id
 * (e.g. document.uploaded) in addition to target_type=job / target_id=jobId.
 */

import {
  getJobActivityChannelId,
  getJobActivityRealtimeFilter,
  isJobActivityRow,
} from '@/lib/realtime/jobActivityFilters'
import * as fs from 'fs'
import * as path from 'path'

const JOB_ID = '11111111-2222-4333-8444-555566667777'
const ORG_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const DOC_ID = 'dddddddd-eeee-4fff-8000-111122223333'

describe('Job activity feed: metadata.job_id and realtime', () => {
  describe('getJobActivityRealtimeFilter', () => {
    it('includes organization_id and or(and(target_type.eq.job,target_id.eq.jobId),metadata->>job_id.eq.jobId) for realtime subscription', () => {
      const filter = getJobActivityRealtimeFilter(ORG_ID, JOB_ID)
      expect(filter).toContain(`organization_id=eq.${ORG_ID}`)
      expect(filter).toContain('or=(')
      expect(filter).toContain(`and(target_type.eq.job,target_id.eq.${JOB_ID})`)
      expect(filter).toContain(`metadata->>job_id.eq.${JOB_ID}`)
    })
  })

  describe('getJobActivityChannelId', () => {
    it('returns stable channel id for subscribe route', () => {
      expect(getJobActivityChannelId(ORG_ID, JOB_ID)).toBe(
        `job-activity-${ORG_ID}-${JOB_ID}`
      )
    })
  })

  describe('isJobActivityRow', () => {
    it('accepts document.uploaded audit row with metadata.job_id equal to job', () => {
      const row = {
        target_type: 'document',
        target_id: DOC_ID,
        event_name: 'document.uploaded',
        metadata: { job_id: JOB_ID },
        organization_id: ORG_ID,
      }
      expect(isJobActivityRow(row, JOB_ID)).toBe(true)
    })

    it('accepts audit row with target_type=job and target_id=jobId', () => {
      const row = {
        target_type: 'job',
        target_id: JOB_ID,
        event_name: 'job.updated',
        organization_id: ORG_ID,
      }
      expect(isJobActivityRow(row, JOB_ID)).toBe(true)
    })

    it('rejects row with unrelated metadata and target', () => {
      const row = {
        target_type: 'document',
        target_id: DOC_ID,
        metadata: { job_id: 'other-job-id' },
        organization_id: ORG_ID,
      }
      expect(isJobActivityRow(row, JOB_ID)).toBe(false)
    })

    it('rejects undefined row', () => {
      expect(isJobActivityRow(undefined, JOB_ID)).toBe(false)
    })
  })

  describe('GET /api/jobs/[id]/activity route', () => {
    it('uses combined or predicate (target_type/target_id and metadata->>job_id)', () => {
      const routePath = path.join(
        process.cwd(),
        'app',
        'api',
        'jobs',
        '[id]',
        'activity',
        'route.ts'
      )
      const source = fs.readFileSync(routePath, 'utf-8')
      expect(source).toContain('.or(')
      expect(source).toContain('metadata->>job_id.eq.')
      expect(source).toContain('target_type.eq.job')
      expect(source).toContain('target_id.eq.')
    })
  })
})
