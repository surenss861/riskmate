'use client';

import Link from 'next/link';

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
    <div className="relative">
      <div className="mb-6">
        <h3 className="text-xl font-bold font-display text-white mb-2">Evidence Health</h3>
      </div>
      <div className="flex flex-col gap-8">
        <div>
          {jobsTotal === 0 ? (
            <>
              <div className="text-3xl font-bold font-display text-white mb-3">
                N/A
              </div>
              <p className="text-sm text-white/60">
                No jobs in selected range.
              </p>
            </>
          ) : (
            <>
              <div className="text-3xl font-bold font-display text-white mb-2">
                {isLoading ? '—' : `${percent}%`}
              </div>
              <p className="text-sm text-white/60 mb-4">
                {jobsWithPhotoEvidence} of {jobsTotal} jobs have photo evidence
              </p>
              <p className="text-sm text-white/60">
                {required_evidence_policy || 'Keep crews capturing site photos before work begins. Evidence-rich jobs make your reports inspection-ready.'}
              </p>
            </>
          )}

          <div className="mt-8 pt-8 border-t border-white/10 flex flex-wrap gap-8 text-sm">
            <div>
              <span className="block text-xs text-white/50 mb-1">
                Evidence Files
              </span>
              <span className="text-xl font-semibold text-white">
                {isLoading ? '—' : evidenceCount}
              </span>
            </div>
            <div>
              <span className="block text-xs text-white/50 mb-1">
                Avg time to first photo
              </span>
              <span className="text-xl font-semibold text-white">
                {isLoading ? '—' : avg_time_to_first_photo_minutes 
                  ? formatHoursToHuman(avg_time_to_first_photo_minutes / 60)
                  : avgTimeToFirstEvidenceHours > 0
                  ? formatHoursToHuman(avgTimeToFirstEvidenceHours)
                  : 'N/A'}
              </span>
            </div>
            <div>
              <span className="block text-xs text-white/50 mb-1">
                Jobs missing evidence
              </span>
              <Link 
                href={`/operations/jobs?missing_evidence=true&time_range=${timeRange}`}
                className="text-xl font-semibold text-white hover:text-[#F97316] transition-colors"
              >
                {isLoading ? '—' : jobsMissingEvidence}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EvidenceWidget;

