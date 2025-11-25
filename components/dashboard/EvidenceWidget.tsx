'use client';

import { motion } from 'framer-motion';

type EvidenceWidgetProps = {
  totalJobs: number;
  jobsWithEvidence: number;
  evidenceCount: number;
  avgTimeToFirstEvidenceHours: number;
  isLoading?: boolean;
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
}: EvidenceWidgetProps) {
  const percent =
    totalJobs === 0 ? 0 : Math.round((jobsWithEvidence / totalJobs) * 100);

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
          <h3 className="mt-4 text-3xl font-semibold text-white md:text-4xl">
            {isLoading ? '—' : `${percent}%`} of jobs have photo evidence
          </h3>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/65">
            Keep crews capturing site photos before work begins. Evidence-rich jobs
            make your reports inspection-ready.
          </p>

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
                {isLoading ? '—' : formatHoursToHuman(avgTimeToFirstEvidenceHours)}
              </span>
            </div>
            <div>
              <span className="block text-[0.7rem] uppercase tracking-[0.22em] text-white/40">
                Jobs missing evidence
              </span>
              <span className="mt-1 text-xl font-semibold text-white">
                {isLoading ? '—' : Math.max(totalJobs - jobsWithEvidence, 0)}
              </span>
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

