'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { buttonStyles } from '@/lib/styles/design-system';

type EvidenceWidgetProps = {
  totalJobs: number;
  jobsWithEvidence: number;
  evidenceCount: number;
  avgTimeToFirstEvidenceHours: number;
  isLoading?: boolean;
  // Explicit backend fields
  jobs_total?: number;
  jobs_with_photo_evidence?: number;
  jobs_missing_required_evidence?: number;
  required_evidence_policy?: string;
  avg_time_to_first_photo_minutes?: number | null;
  timeRange?: string;
};

const formatHoursToHuman = (hours: number) => {
  if (!Number.isFinite(hours) || hours <= 0) return '<1 hr';
  const days = Math.floor(hours / 24);
  const remHours = Math.round(hours % 24);
  if (days > 0) {
    return `${days}d ${remHours}h`;
  }
  return `${Math.round(hours)}h`;
};

export function EvidenceWidget({
  totalJobs,
  jobsWithEvidence,
  evidenceCount,
  avgTimeToFirstEvidenceHours,
  isLoading = false,
  jobs_total,
  jobs_with_photo_evidence,
  jobs_missing_required_evidence,
  required_evidence_policy,
  avg_time_to_first_photo_minutes,
  timeRange = '30d',
}: EvidenceWidgetProps) {
  // Use explicit backend fields if available, fall back to computed values
  const jobsTotal = jobs_total ?? totalJobs;
  const jobsWithPhotoEvidence = jobs_with_photo_evidence ?? jobsWithEvidence;
  const jobsMissingEvidence = jobs_missing_required_evidence ?? Math.max(jobsTotal - jobsWithPhotoEvidence, 0);
  
  const percent = jobsTotal === 0 
    ? 0 
    : Math.round((jobsWithPhotoEvidence / jobsTotal) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative overflow-hidden rounded-[30px] border border-white/10 bg-black/45 p-8 shadow-[0_32px_100px_rgba(8,8,20,0.6)] backdrop-blur-2xl"
    >
      <span className="pointer-events-none absolute -right-36 -top-36 h-64 w-64 rounded-full bg-[#F97316]/25 blur-[180px]" />
      <span className="pointer-events-none absolute -left-28 bottom-[-90px] h-56 w-56 rounded-full bg-[#38BDF8]/20 blur-[150px]" />

      <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.34em] text-white/45">
            Evidence Health
          </p>
          {jobsTotal === 0 ? (
            <>
              <h3 className="mt-4 text-3xl font-semibold text-white md:text-4xl">
                N/A
              </h3>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/65">
                No jobs in selected range.
              </p>
            </>
          ) : (
            <>
              <h3 className="mt-4 text-3xl font-semibold text-white md:text-4xl">
                {isLoading ? '—' : `${percent}%`} of jobs have photo evidence
              </h3>
              <p className="mt-2 text-xs text-white/40">
                ({jobsWithPhotoEvidence}/{jobsTotal})
              </p>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/65">
                {required_evidence_policy || 'Keep crews capturing site photos before work begins. Evidence-rich jobs make your reports inspection-ready.'}
              </p>
            </>
          )}

          <div className="mt-6 flex flex-wrap gap-8 text-sm text-white/65">
            <div>
              <span className="block text-[0.7rem] uppercase tracking-[0.22em] text-white/40">
                Evidence Files
              </span>
              <span className="mt-1 text-xl font-semibold text-white">
                {isLoading ? '—' : evidenceCount}
              </span>
            </div>
            <div>
              <span className="block text-[0.7rem] uppercase tracking-[0.22em] text-white/40">
                Avg time to first photo
              </span>
              <span className="mt-1 text-xl font-semibold text-white">
                {isLoading ? '—' : avg_time_to_first_photo_minutes 
                  ? formatHoursToHuman(avg_time_to_first_photo_minutes / 60)
                  : avgTimeToFirstEvidenceHours > 0
                  ? formatHoursToHuman(avgTimeToFirstEvidenceHours)
                  : 'N/A'}
              </span>
            </div>
            <div>
              <span className="block text-[0.7rem] uppercase tracking-[0.22em] text-white/40">
                Jobs missing evidence
              </span>
              <Link 
                href={`/operations/jobs?missing_evidence=true&time_range=${timeRange}`}
                className="block mt-1 text-xl font-semibold text-white hover:text-[#F97316] transition-colors"
              >
                {isLoading ? '—' : jobsMissingEvidence}
              </Link>
            </div>
          </div>
        </div>

        <div className="relative flex h-36 w-36 items-center justify-center">
          <svg className="h-full w-full" viewBox="0 0 120 120">
            <defs>
              <linearGradient id="evidenceGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F97316" />
                <stop offset="100%" stopColor="#38BDF8" />
              </linearGradient>
            </defs>
            <circle
              cx="60"
              cy="60"
              r="52"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="8"
              fill="none"
            />
            <motion.circle
              cx="60"
              cy="60"
              r="52"
              stroke="url(#evidenceGradient)"
              strokeWidth="8"
              fill="none"
              strokeDasharray={Math.PI * 2 * 52}
              strokeDashoffset={((100 - percent) / 100) * Math.PI * 2 * 52}
              strokeLinecap="round"
              initial={{ strokeDashoffset: Math.PI * 2 * 52 }}
              animate={{
                strokeDashoffset: ((100 - percent) / 100) * Math.PI * 2 * 52,
              }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold text-white">
              {isLoading ? '—' : `${percent}%`}
            </span>
            <span className="text-[0.72rem] uppercase tracking-[0.18em] text-white/50">
              Evidence
            </span>
          </div>

          <div className="absolute inset-0 rounded-full border border-white/10" />
        </div>
      </div>
    </motion.div>
  );
}

export default EvidenceWidget;

