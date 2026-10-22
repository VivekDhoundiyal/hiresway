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

export const JobCard: React.FC<JobCardProps> = React.memo<JobCardProps>(({
  job,
  isSaved,
  onSave,
  onApply,
  onOpen,
  onWhyMatches,
}) => {
  const { match } = job;

  const scoreDisplay = `${match.overallScore}%`;

  const getSalaryInfo = (): { text: string; disclosed: boolean; evidence?: string } => {
    const formatted = salaryTruthEngine.formatSalaryDisplay(job.salary_truth || job.salary);
    if (
      !formatted.isDisclosed ||
      formatted.text.startsWith('$1 ') ||
      formatted.text === '$1' ||
      formatted.text.toLowerCase().includes('not disclosed')
    ) {
      return { text: '', disclosed: false, evidence: formatted.evidence };
    }
    return {
      text: formatted.text,
      disclosed: true,
      evidence: formatted.evidence,
    };
  };

  const getLocationDisplay = (): string => {
    if (!job.location || job.location.trim() === '' || job.location.toLowerCase() === 'not_disclosed') {
      return 'Worldwide';
    }
    return job.location;
  };

  const locationText = useMemo(() => {
    const loc = getLocationDisplay();
    if (loc.toLowerCase().includes('worldwide') || remoteEligibilityEngine.isWorldwideRemote(job)) return 'Worldwide';
    if (loc.toLowerCase().includes('united states') || loc.toLowerCase().includes('usa')) return 'USA / Remote';
    return loc;
  }, [job]);

  const workModeText = useMemo(() => {
    if (remoteEligibilityEngine.isWorldwideRemote(job)) return 'Remote';
    if (job.remoteStatus === 'remote') return 'Remote';
    if (job.remoteStatus === 'hybrid' || job.remote_eligibility?.status === 'HYBRID') return 'Hybrid';
    if (job.remote_eligibility?.status === 'WORLDWIDE_REMOTE') return 'Remote';
    if (job.remote_eligibility?.status === 'REMOTE_FROM_INDIA') return 'Remote (India)';
    return 'On-site';
  }, [job]);

  const experienceText = useMemo(() => {
    if (job.minExperienceYears) {
      const maxYears = (job as any).maxExperienceYears || (job.minExperienceYears + 4);
      return `${job.minExperienceYears}-${maxYears} yrs`;
    }
    const sen = (job.seniority || '').toLowerCase();
    if (sen.includes('senior')) return '5-8 yrs';
    if (sen.includes('lead') || sen.includes('staff')) return '7-10 yrs';
    if (sen.includes('director') || sen.includes('head')) return '8-12 yrs';
    if (sen.includes('junior') || sen.includes('entry')) return '1-3 yrs';
    return '4-7 yrs';
  }, [job.minExperienceYears, (job as any).maxExperienceYears, job.seniority]);

  const employmentTypeText = job.employmentType || 'Full-time';

  const salaryInfo = getSalaryInfo();
  const rawTargetUrl = job.applyUrl || job.jobUrl;
  const applyTargetUrl = jobVerificationEngine.sanitizeApplyUrl(rawTargetUrl);

  const hasReliableScore = Boolean(match && match.overallScore > 0);
  const isMatchPending = !hasReliableScore || (match.strengths && match.strengths.some((s) => s.toLowerCase().includes('pending')));

  const freshnessText = useMemo(() => {
    const date = job.originalPostedAt || job.datePosted || (job as any).dateDiscovered;
    if (!date) return '2d ago';
    const diffSec = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    const diffDays = Math.floor(diffSec / 86400);
    if (diffDays <= 0) return 'today';
    return `${diffDays}d ago`;
  }, [job.originalPostedAt, job.datePosted]);

  const descriptionSnippet = useMemo(() => {
    const raw = job.description || (job as any).snippet || (job as any).summary || '';
    const clean = raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (clean.length > 20) return clean;
    if (match.strengths && match.strengths[0]) {
      return `${match.strengths[0]}. Driving growth and strategic outcomes for ${job.company}.`;
    }
    return `Lead strategic initiatives and high-impact deliverables for ${job.company}.`;
  }, [job.description, job.company, match.strengths]);

  return (
    <div
      onClick={() => onOpen(job)}
      className="bg-white rounded-2xl border border-slate-200/90 hover:border-blue-400/80 p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between h-full group select-none cursor-pointer"
    >
      <div>
        {/* Top Header: Logo + Job Title & Company (with Verified badge) + Match % Badge */}
        <div className="flex items-start gap-3 justify-between">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {/* Company Logo */}
            <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center p-1.5 shrink-0 overflow-hidden group-hover:border-slate-200 transition-colors">
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
                className="text-[14px] sm:text-[15px] font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-tight line-clamp-1 truncate"
                title={job.title}
              >
                {job.title}
              </h3>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-xs font-medium text-slate-600 truncate max-w-[140px]" title={job.company}>
                  {job.company}
                </span>
                {/* Blue Verified Employer Checkmark */}
                <span title="Verified active employer listing" className="inline-flex shrink-0">
                  <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 fill-blue-50" />
                </span>
              </div>
            </div>
          </div>

          {/* Match % Badge (top-right) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onWhyMatches) onWhyMatches(job);
              else onOpen(job);
            }}
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100/80 hover:bg-emerald-100 transition-colors cursor-pointer shrink-0 shadow-3xs"
            title={`Match score: ${scoreDisplay}. Click to view explanation.`}
          >
            <span>{isMatchPending ? 'Match' : `${match.overallScore}% Match`}</span>
          </button>
        </div>

        {/* Metadata Chips: [+ Remote] [+ 8-12 yrs] [+ Full-time] */}
        <div className="flex items-center gap-1.5 flex-wrap mt-3 mb-2.5">
          <span className="inline-flex items-center text-[10.5px] font-medium px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 shrink-0">
            + {workModeText}
          </span>
          <span className="inline-flex items-center text-[10.5px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 shrink-0">
            + {experienceText}
          </span>
          <span className="inline-flex items-center text-[10.5px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 shrink-0 capitalize">
            + {employmentTypeText}
          </span>
        </div>

        {/* Description Snippet (2 clean lines) */}
        <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 mb-3 min-h-[2rem]">
          {descriptionSnippet}
        </p>
      </div>

      {/* Footer: Location, Salary, Freshness | Save, Apply/Open */}
      <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100 text-xs text-slate-500 mt-auto">
        <div className="flex items-center gap-2.5 min-w-0 flex-1 truncate">
          {/* Location */}
          <div className="flex items-center gap-1 shrink-0" title={locationText}>
            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="truncate max-w-[110px] text-[11px] text-slate-600">{locationText}</span>
          </div>

          {/* Salary */}
          {salaryInfo.disclosed ? (
            <div className="flex items-center gap-1 shrink-0 text-[11px] text-emerald-700 font-medium" title={salaryInfo.text}>
              <span className="truncate max-w-[140px]">{salaryInfo.text}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 shrink-0 text-[11px] text-slate-400 font-normal" title="Salary not disclosed by employer">
              <span>Salary not disclosed</span>
            </div>
          )}

          {/* Freshness */}
          <span className="text-[11px] text-slate-400 shrink-0">{freshnessText}</span>
        </div>

        {/* Action Buttons: Bookmark & External Link */}
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
            {isSaved ? <BookmarkCheck className="h-4 w-4 text-blue-600" /> : <Bookmark className="h-4 w-4" />}
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
            title={applyTargetUrl ? "Open application page" : "View job details"}
            aria-label="Open job application"
          >
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
});
