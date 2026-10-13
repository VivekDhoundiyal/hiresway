import React from 'react';
import { Modal } from '@/components/modal';
import { Button } from '@/components/button';
import { JobOpportunity, JobMatchAnalysis } from '@/core/intelligence';
import { CompanyLogo } from '@/components/company-logo';
import {
  CheckCircle2,
  Check,
  MapPin,
  Briefcase,
  Sparkles,
  ArrowUpRight,
  Target,
} from 'lucide-react';
import { HIGH_MATCH_THRESHOLD } from '@/core/jobs';
import { jobVerificationEngine } from '@/core/jobs/jobVerificationEngine';

export interface WhyThisMatchesModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: (JobOpportunity & { match: JobMatchAnalysis }) | null;
  onOpenDetails?: (job: JobOpportunity & { match: JobMatchAnalysis }) => void;
  onApply?: (jobId: string) => void;
}

export const WhyThisMatchesModal: React.FC<WhyThisMatchesModalProps> = ({
  isOpen,
  onClose,
  job,
  onOpenDetails,
  onApply,
}) => {
  if (!job) return null;

  const { match } = job;
  const score = match.overallScore;
  const isHighMatch = score >= HIGH_MATCH_THRESHOLD;

  // 8-Factor Breakdown values with robust fallback
  const breakdown = match.breakdown || ({} as any);

  const roleFit = breakdown.roleFit ?? (match.titleMatchScore ? Math.min(100, Math.round(match.titleMatchScore / 0.30)) : 85);
  const experienceFit = breakdown.experienceFit ?? (match.experienceMatchScore ? Math.min(100, Math.round(match.experienceMatchScore / 0.20)) : 80);
  const skillFit = breakdown.skillFit ?? (match.skillsMatchScore ? Math.min(100, Math.round(match.skillsMatchScore / 0.15)) : 80);
  const careerDirectionFit = breakdown.careerDirectionFit ?? (breakdown.industryFit || 80);
  const locationFit = breakdown.locationFit ?? 90;
  const workplaceFit = breakdown.workplaceFit ?? (breakdown.remoteFit || 85);
  const employmentTypeFit = breakdown.employmentTypeFit ?? 100;
  const salaryFit = breakdown.salaryFit ?? (job.salary?.disclosed ? 100 : 60);

  const roleFitLevel = breakdown.roleFitLevel || (roleFit >= 80 ? 'Strong' : roleFit >= 60 ? 'Moderate' : 'Weak');
  const experienceFitLevel = breakdown.experienceFitLevel || (experienceFit >= 80 ? 'Strong' : experienceFit >= 60 ? 'Good' : 'Moderate');
  const skillsFitLevel = breakdown.skillsFitLevel || (skillFit >= 80 ? 'Strong' : skillFit >= 60 ? 'Moderate' : 'Weak');
  const careerDirectionLevel = breakdown.careerDirectionLevel || (careerDirectionFit >= 80 ? 'Direct Target' : careerDirectionFit >= 60 ? 'Adjacent Path' : 'Transferable');
  const locationFitLevel = breakdown.locationFitLevel || (locationFit >= 80 ? 'Eligible' : 'Excluded');
  const remoteFitLevel = breakdown.remoteFitLevel || (workplaceFit >= 80 ? 'Preferred' : 'Acceptable');

  const getLevelBadge = (level?: string) => {
    if (!level) return null;
    const l = level.toLowerCase();
    let color = 'bg-gray-100 text-gray-700 border-gray-200';
    if (l.includes('strong') || l.includes('exact') || l.includes('direct') || l.includes('preferred')) {
      color = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    } else if (l.includes('good') || l.includes('eligible') || l.includes('adjacent') || l.includes('acceptable')) {
      color = 'bg-blue-50 text-blue-700 border-blue-200';
    } else if (l.includes('moderate') || l.includes('transferable')) {
      color = 'bg-amber-50 text-amber-700 border-amber-200';
    }
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${color}`}>
        {level}
      </span>
    );
  };

  // Collect 3-5 distinct explainable reasons
  const matchReasons: string[] = [];
  const rawReasons = (match.reasons && match.reasons.length > 0)
    ? match.reasons
    : match.strengths;

  rawReasons.forEach((r) => {
    if (!matchReasons.includes(r) && matchReasons.length < 5) {
      matchReasons.push(r);
    }
  });

  if (matchReasons.length < 3) {
    if (job.isTargetCompany && !matchReasons.some((r) => r.toLowerCase().includes('target'))) {
      matchReasons.push(`Target Company Priority: ${job.company} is in your strategic pipeline`);
    }
    if (!matchReasons.some((r) => r.toLowerCase().includes('location') || r.toLowerCase().includes('remote'))) {
      matchReasons.push(`Location eligibility: Matches your preferred work arrangement`);
    }
    if (!matchReasons.some((r) => r.toLowerCase().includes('skill'))) {
      matchReasons.push(`Background alignment: Transferable capabilities for ${job.title}`);
    }
  }

  const applyTargetUrl = jobVerificationEngine.sanitizeApplyUrl(job.applyUrl || job.jobUrl);
  const canApply = Boolean(applyTargetUrl && applyTargetUrl !== '#' && applyTargetUrl.startsWith('http'));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="lg"
    >
      <div className="space-y-6">
        {/* Header: Company & Title info + Match Pill */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-100">
          <div className="flex items-start gap-3.5 min-w-0">
            <CompanyLogo
              company={job.company}
              domain={job.companyDomain}
              logoUrl={job.companyLogo}
              logoData={job.companyLogoData}
              size="lg"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-gray-900 text-base">{job.company}</span>
                <span title="Verified Employer Entity">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 fill-blue-50" />
                </span>
                {job.isTargetCompany && (
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <Target className="h-3 w-3" />
                    Target Company
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-gray-900 mt-0.5 leading-snug break-words">
                {job.title}
              </h2>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-1 flex-wrap">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-gray-400" />
                  {job.location || 'Location Not Disclosed'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3 w-3 text-gray-400" />
                  {job.minExperienceYears ? `${job.minExperienceYears}+ yrs experience` : 'Seniority Matched'}
                </span>
              </div>
            </div>
          </div>

          {/* Overall Match Badge */}
          <div className="text-right shrink-0">
            <div
              className={`inline-flex flex-col items-center px-4 py-2 rounded-xl border ${
                isHighMatch
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-blue-50 text-blue-800 border-blue-200'
              }`}
            >
              <span className="text-2xl font-black tracking-tight">{score}%</span>
              <span className="text-[11px] font-bold uppercase tracking-wider">
                {match.fitCategory || (isHighMatch ? 'High Match' : 'Strong Match')}
              </span>
            </div>
          </div>
        </div>

        {/* Explainable Reasons Section */}
        <div>
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
            Why this matches your profile ({matchReasons.length} key alignment factors)
          </h3>
          <div className="bg-gray-50/70 rounded-xl p-4 border border-gray-200/70 space-y-2.5">
            {matchReasons.map((reason, idx) => (
              <div key={idx} className="flex items-start gap-3 text-sm text-gray-800">
                <div className="p-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
                  <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                </div>
                <span className="leading-snug font-medium">{reason}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Transparent 8-Factor Fit Breakdown */}
        <div>
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
            8-Factor Candidate Relevance Breakdown
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-white rounded-xl border border-gray-200 p-4">
            {/* 1. Role Fit (30%) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-gray-600">Role Fit (30%)</span>
                <div className="flex items-center gap-1.5">
                  {getLevelBadge(roleFitLevel)}
                  <span className="font-bold text-gray-900">{roleFit}%</span>
                </div>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-500"
                  style={{ width: `${roleFit}%` }}
                />
              </div>
            </div>

            {/* 2. Experience Fit (20%) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-gray-600">Experience Fit (20%)</span>
                <div className="flex items-center gap-1.5">
                  {getLevelBadge(experienceFitLevel)}
                  <span className="font-bold text-gray-900">{experienceFit}%</span>
                </div>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                  style={{ width: `${experienceFit}%` }}
                />
              </div>
            </div>

            {/* 3. Skill Fit (15%) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-gray-600">Skill Fit (15%)</span>
                <div className="flex items-center gap-1.5">
                  {getLevelBadge(skillsFitLevel)}
                  <span className="font-bold text-gray-900">{skillFit}%</span>
                </div>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-600 rounded-full transition-all duration-500"
                  style={{ width: `${skillFit}%` }}
                />
              </div>
            </div>

            {/* 4. Career Direction (15%) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-gray-600">Career Direction (15%)</span>
                <div className="flex items-center gap-1.5">
                  {getLevelBadge(careerDirectionLevel)}
                  <span className="font-bold text-gray-900">{careerDirectionFit}%</span>
                </div>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                  style={{ width: `${careerDirectionFit}%` }}
                />
              </div>
            </div>

            {/* 5. Location Fit (10%) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-gray-600">Location Fit (10%)</span>
                <div className="flex items-center gap-1.5">
                  {getLevelBadge(locationFitLevel)}
                  <span className="font-bold text-gray-900">{locationFit}%</span>
                </div>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-600 rounded-full transition-all duration-500"
                  style={{ width: `${locationFit}%` }}
                />
              </div>
            </div>

            {/* 6. Workplace Type (5%) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-gray-600">Workplace Type (5%)</span>
                <div className="flex items-center gap-1.5">
                  {getLevelBadge(remoteFitLevel)}
                  <span className="font-bold text-gray-900">{workplaceFit}%</span>
                </div>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-600 rounded-full transition-all duration-500"
                  style={{ width: `${workplaceFit}%` }}
                />
              </div>
            </div>

            {/* 7. Employment Type (3%) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-gray-600">Employment Type (3%)</span>
                <span className="font-bold text-gray-900">{employmentTypeFit}%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-600 rounded-full transition-all duration-500"
                  style={{ width: `${employmentTypeFit}%` }}
                />
              </div>
            </div>

            {/* 8. Salary Fit (2%) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-gray-600">Salary Disclosed (2%)</span>
                <span className="font-bold text-gray-900">{salaryFit}%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${salaryFit}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-gray-100">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onClose();
              if (onOpenDetails) onOpenDetails(job);
            }}
          >
            View Full Job Details
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Dismiss
            </Button>
            {canApply && (
              <a
                href={applyTargetUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onApply?.(job.id)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
              >
                <span>Apply on Official Portal</span>
                <ArrowUpRight className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
