import React, { useMemo } from 'react';
import {
  JobOpportunity,
  JobMatchAnalysis,
} from '@/core/intelligence';
import { jobVerificationEngine } from '@/core/jobs/jobVerificationEngine';
import {
  MapPin,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ArrowUpRight,
  Clock,
} from 'lucide-react';
import { CompanyLogo } from '@/components/company-logo';
import { salaryTruthEngine } from '@/core/jobs/salaryTruthEngine';
import { remoteEligibilityEngine } from '@/core/jobs/remoteEligibilityEngine';

export interface JobCardProps {
  job: JobOpportunity & { match: JobMatchAnalysis };
  isSaved: boolean;
  onSave: (jobId: string) => void;
  onReject: (jobId: string) => void;
  onApply?: (jobId: string) => void;
  onOpen: (job: JobOpportunity & { match: JobMatchAnalysis }) => void;
  onWhyMatches?: (job: JobOpportunity & { match: JobMatchAnalysis }) => void;
  onInspectDebug?: (job: JobOpportunity & { match: JobMatchAnalysis }) => void;
}

function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export const JobCard: React.FC<JobCardProps> = React.memo<JobCardProps>(({
  job,
  isSaved,
  onSave,
  onApply,
  onOpen,
  onWhyMatches,
}) => {
  const { match } = job;

  const hasValidMatchScore = Boolean(
    match &&
    typeof match.overallScore === 'number' &&
    match.overallScore > 0 &&
    !isNaN(match.overallScore)
  );

  const locationText = useMemo(() => {
    if (!job.location || job.location.trim() === '' || job.location.toLowerCase() === 'not_disclosed') {
      return 'Location not specified';
    }
    const loc = job.location.trim();
    if (loc.toLowerCase().includes('worldwide') || remoteEligibilityEngine.isWorldwideRemote(job)) return 'Worldwide';
    if (loc.toLowerCase().includes('united states') || loc.toLowerCase().includes('usa')) return 'USA';
    return loc;
  }, [job]);

  const workplaceText = useMemo(() => {
    if (
      remoteEligibilityEngine.isWorldwideRemote(job) ||
      job.remoteStatus === 'remote' ||
      job.remote_eligibility?.status === 'WORLDWIDE_REMOTE'
    ) {
      return 'Remote';
    }
    if (job.remoteStatus === 'hybrid' || job.remote_eligibility?.status === 'HYBRID') {
      return 'Hybrid';
    }
    if (job.remote_eligibility?.status === 'REMOTE_FROM_INDIA') {
      return 'Remote (India)';
    }
    if (job.remoteStatus === 'on-site' || (job.remoteStatus as string) === 'onsite' || job.workplace_type === 'on-site' || (job as any).workplaceType === 'onsite') {
      return 'On-site';
    }
    return job.location?.toLowerCase().includes('remote') ? 'Remote' : 'On-site';
  }, [job]);

  const experienceText = useMemo(() => {
    if (job.minExperienceYears !== undefined && job.minExperienceYears !== null && job.minExperienceYears > 0) {
      const maxYears = (job as any).maxExperienceYears;
      return maxYears && maxYears > job.minExperienceYears
        ? `${job.minExperienceYears}–${maxYears} yrs`
        : `${job.minExperienceYears}+ yrs`;
    }
    if (job.seniority) {
      return job.seniority;
    }
    return 'Experience not specified';
  }, [job]);

  const employmentTypeText = job.employmentType || 'Full-time';

  const descriptionSnippet = useMemo(() => {
    const raw = job.description || (job as any).snippet || (job as any).summary || '';
    const stripped = raw.replace(/<[^>]*>/g, ' ');
    const decoded = decodeHtmlEntities(stripped).replace(/\s+/g, ' ').trim();
    if (decoded.length >= 20) return decoded;
    return 'Description unavailable';
  }, [job]);

  const freshnessText = useMemo(() => {
    const date = job.originalPostedAt || job.datePosted || (job as any).dateDiscovered;
    if (!date || date === 'not_disclosed' || date === 'unknown') return 'Date not provided';
    const parsedTime = new Date(date).getTime();
    if (isNaN(parsedTime)) return 'Date not provided';
    const diffSec = Math.floor((Date.now() - parsedTime) / 1000);
    if (diffSec < 0) return 'today';
    const diffDays = Math.floor(diffSec / 86400);
    if (diffDays <= 0) return 'today';
    return `${diffDays}d ago`;
  }, [job]);

  const salaryInfo = useMemo(() => {
    const formatted = salaryTruthEngine.formatSalaryDisplay(job.salary_truth || job.salary);
    if (!formatted.isDisclosed || !formatted.text || formatted.text.toLowerCase().includes('not disclosed')) {
      return { text: 'Salary not disclosed', disclosed: false };
    }
    return { text: formatted.text, disclosed: true };
  }, [job.salary_truth, job.salary]);

  const rawTargetUrl = job.applyUrl || job.jobUrl;
  const applyTargetUrl = jobVerificationEngine.sanitizeApplyUrl(rawTargetUrl);
  const sourceName = job.source?.name || job.sourceName || (job as any).sourceId;

  return (
    <div
      onClick={() => onOpen(job)}
      className="bg-white rounded-xl border border-slate-200/80 hover:border-blue-400 p-4 shadow-3xs hover:shadow-xs transition-all duration-150 flex flex-col justify-between h-full group select-none cursor-pointer"
    >
      <div>
        {/* Header: Logo + Job Title & Company (with verified employer mark) + Match Badge */}
        <div className="flex items-start gap-3 justify-between">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {/* Company Logo Container */}
            <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center p-1 shrink-0 overflow-hidden group-hover:border-slate-200 transition-colors">
              <CompanyLogo
                company={job.company}
                domain={job.companyDomain}
                logoUrl={job.companyLogo}
                logoData={job.companyLogoData}
                size="md"
              />
            </div>

            {/* Title & Company */}
            <div className="min-w-0 flex-1 pr-1">
              <h3
                className="text-[13.5px] font-semibold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug line-clamp-1"
                title={job.title}
              >
                {job.title}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs font-medium text-slate-600 truncate max-w-[150px]" title={job.company}>
                  {job.company}
                </span>
                <span title="Verified active employer listing" className="inline-flex shrink-0">
                  <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 fill-blue-50" />
                </span>
              </div>
            </div>
          </div>

          {/* Match Score Badge (only shown when validly computed) */}
          {hasValidMatchScore && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onWhyMatches) onWhyMatches(job);
                else onOpen(job);
              }}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 hover:bg-emerald-100 transition-colors cursor-pointer shrink-0 shadow-3xs"
              title={`Match score: ${match.overallScore}%. Click to view explanation.`}
            >
              <span>{`${match.overallScore}%`}</span>
            </button>
          )}
        </div>

        {/* Metadata Chips: Workplace, Experience, Employment Type */}
        <div className="flex items-center gap-1.5 flex-wrap mt-2.5 mb-2">
          <span
            className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-md border shrink-0 ${
              workplaceText === 'Remote'
                ? 'bg-emerald-50/70 text-emerald-700 border-emerald-200/60'
                : 'bg-slate-50 text-slate-600 border-slate-200/60'
            }`}
          >
            {workplaceText}
          </span>
          {experienceText !== 'Experience not specified' ? (
            <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200/60 shrink-0">
              {experienceText}
            </span>
          ) : (
            <span className="inline-flex items-center text-[10px] text-slate-400 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-100 shrink-0">
              Exp not specified
            </span>
          )}
          <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200/60 shrink-0 capitalize">
            {employmentTypeText}
          </span>
        </div>

        {/* Description Snippet: Clean, sanitized 2-line preview */}
        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-2.5 min-h-[2.4rem]">
          {descriptionSnippet}
        </p>
      </div>

      {/* Footer: Location, Salary, Freshness, Source | Actions */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500 mt-auto">
        <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
          {/* Location */}
          <div className="flex items-center gap-1 shrink-0" title={locationText}>
            <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
            <span className="truncate max-w-[105px] text-[11px] text-slate-600">{locationText}</span>
          </div>

          {/* Salary */}
          {salaryInfo.disclosed ? (
            <div className="flex items-center gap-1 shrink-0 text-[11px] text-emerald-700 font-semibold" title={salaryInfo.text}>
              <span className="truncate max-w-[130px]">{salaryInfo.text}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 shrink-0 text-[11px] text-slate-400 font-normal" title="Salary not disclosed by employer">
              <span>Salary not disclosed</span>
            </div>
          )}

          {/* Freshness & Source badge */}
          <div className="flex items-center gap-1 text-[11px] text-slate-400 shrink-0">
            <Clock className="h-3 w-3 text-slate-300" />
            <span>{freshnessText}</span>
            {sourceName && (
              <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-100 px-1 py-0.2 rounded hidden sm:inline truncate max-w-[70px]">
                {sourceName}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons: Save & External Link */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onSave(job.id)}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isSaved
                ? 'border-blue-200 bg-blue-50 text-blue-600'
                : 'border-slate-200/80 bg-white text-slate-400 hover:text-slate-700 hover:bg-slate-50'
            }`}
            title={isSaved ? 'Remove from Saved' : 'Save opportunity'}
            aria-label={isSaved ? 'Saved' : 'Save'}
          >
            {isSaved ? <BookmarkCheck className="h-3.5 w-3.5 text-blue-600" /> : <Bookmark className="h-3.5 w-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => {
              if (applyTargetUrl) {
                window.open(applyTargetUrl, '_blank', 'noopener,noreferrer');
              }
              if (onApply) {
                onApply(job.id);
              } else if (!applyTargetUrl) {
                onOpen(job);
              }
            }}
            className="p-1.5 rounded-lg border border-slate-200/80 bg-white text-slate-400 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-colors cursor-pointer"
            title={applyTargetUrl ? 'Open application page' : 'View job details'}
            aria-label="Open job application"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
});
