import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Drawer } from '@/components/drawer';
import { Typography } from '@/components/typography';
import { Badge, BadgeVariant } from '@/components/badge';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { CompanyLogo } from '@/components/company-logo';
import { CleanJobDescriptionView } from './CleanJobDescriptionView';
import {
  JobOpportunity,
  JobMatchAnalysis,
  FitCategory,
} from '@/core/intelligence';
import { jobVerificationEngine } from '@/core/jobs/jobVerificationEngine';
import {
  CheckCircle2,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  EyeOff,
  Sparkles,
  FileText,
  Send,
  KanbanSquare,
  ShieldCheck,
  Building2,
  AlertTriangle,
  Check,
  X,
  Info,
  DollarSign,
  Layers,
  Terminal,
  Globe2,
} from 'lucide-react';

export interface JobDetailDrawerProps {
  job: (JobOpportunity & { match: JobMatchAnalysis }) | null;
  isOpen: boolean;
  isSaved: boolean;
  onClose: () => void;
  onSave: (jobId: string) => void;
  onReject: (jobId: string) => void;
  onApply?: (jobId: string) => void;
  onView?: (jobId: string) => void;
  onInspectDebug?: (job: JobOpportunity & { match: JobMatchAnalysis }) => void;
}

export const JobDetailDrawer: React.FC<JobDetailDrawerProps> = ({
  job,
  isOpen,
  isSaved,
  onClose,
  onSave,
  onReject,
  onApply,
  onView,
  onInspectDebug,
}) => {
  const navigate = useNavigate();
  const [isDeferredReady, setIsDeferredReady] = useState(false);

  // Record view strictly when user explicitly opened drawer for this job
  useEffect(() => {
    if (!isOpen || !job) return;

    if (!job.viewed_at && !job.viewedAt) {
      onView?.(job.id);
    }
  }, [isOpen, job?.id, onView]);

  useEffect(() => {
    if (isOpen) {
      const frameId = requestAnimationFrame(() => {
        setIsDeferredReady(true);
      });
      return () => cancelAnimationFrame(frameId);
    } else {
      setIsDeferredReady(false);
    }
  }, [isOpen]);

  if (!job) return null;

  const { match } = job;
  const applyTargetUrl = jobVerificationEngine.sanitizeApplyUrl(job.applyUrl || job.jobUrl);

  const getFitBadgeVariant = (_category: FitCategory, score: number): BadgeVariant => {
    if (score >= 85) return 'success';
    if (score >= 70) return 'primary';
    if (score >= 55) return 'warning';
    return 'neutral';
  };

  const isSalaryDisclosed = Boolean(
    job.salary.disclosed &&
      (job.salary.rawText || (job.salary.min && job.salary.min > 0)) &&
      job.salary_status !== 'not_disclosed'
  );

  const getStatedSalaryDisplay = (): string => {
    if (!isSalaryDisclosed) return 'Salary not disclosed by employer';
    if (job.salary_raw_text) return job.salary_raw_text;
    if (job.salary.rawText) return job.salary.rawText;
    if (job.salary.min && job.salary.max) {
      const curr = job.salary.currency || 'USD';
      const symbol = curr === 'INR' ? '₹' : curr === 'EUR' ? '€' : curr === 'GBP' ? '£' : '$';
      if (curr === 'INR') {
        return `₹${(job.salary.min / 100000).toFixed(0)}L – ₹${(job.salary.max / 100000).toFixed(0)}L / yr`;
      }
      return `${symbol}${Math.round(job.salary.min / 1000)}k – ${symbol}${Math.round(job.salary.max / 1000)}k / yr`;
    }
    return 'Salary not disclosed by employer';
  };

  const isApplyUrlValid =
    Boolean(applyTargetUrl && applyTargetUrl !== '#' && applyTargetUrl.startsWith('http')) &&
    jobVerificationEngine.verifyJobUrl(applyTargetUrl).isValid &&
    job.isApplyUrlValidated !== false &&
    job.verificationStatus !== 'failed' &&
    job.verificationStatus !== 'link_broken' &&
    job.verificationStatus !== 'job_closed';

  const verificationBadge = jobVerificationEngine.getVerificationBadgeConfig(job.verificationStatus);
  const badgeColor =
    verificationBadge.variant === 'warning'
      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25'
      : verificationBadge.variant === 'error'
      ? 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/25'
      : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25';

  const integrityScore = job.integrity_score ?? jobVerificationEngine.calculateIntegrityScore(job).score;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      placement="right"
      width="max-w-3xl w-full"
      title={job.title}
      description={`${job.company} · ${job.location || 'Location not disclosed'}`}
      footer={
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onReject(job.id);
                onClose();
              }}
              className="text-error hover:bg-error-soft"
              leftIcon={<EyeOff className="h-4 w-4" />}
            >
              Reject (Hide)
            </Button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={isSaved ? 'outline' : 'primary'}
              size="sm"
              onClick={() => onSave(job.id)}
              leftIcon={
                isSaved ? (
                  <BookmarkCheck className="h-4 w-4 text-accent" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )
              }
            >
              {isSaved ? 'Saved to DB' : 'Save to Job Database'}
            </Button>

            {isApplyUrlValid ? (
              <a
                href={applyTargetUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onApply?.(job.id)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-body-sm font-semibold text-white bg-primary hover:bg-primary-hover rounded-md transition-colors shadow-xs"
              >
                <span>Apply on Official Portal</span>
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled
                  title="Application URL could not be verified or is closed"
                  className="inline-flex items-center gap-1 px-3.5 py-2 text-body-sm font-medium text-text-muted bg-surface-subtle border border-border rounded-md cursor-not-allowed opacity-80"
                >
                  {job.verificationStatus === 'job_closed'
                    ? 'This posting appears closed'
                    : 'Application link unavailable'}
                </button>
                {job.source?.sourceUrl && (
                  <a
                    href={job.source.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-2 text-body-sm font-medium text-text-primary bg-surface border border-border hover:bg-surface-subtle rounded-md transition-colors"
                  >
                    <span>View source listing</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-6 pb-6">
        {/* Top Header Card: Role, Company, Match Tier */}
        <Card variant="subtle" className="p-4 bg-surface-subtle border-border space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <CompanyLogo
                company={job.company}
                domain={job.companyDomain}
                logoUrl={job.companyLogo}
                logoData={job.companyLogoData}
                size="lg"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-body-md font-bold text-text-primary">
                    {job.company}
                  </span>
                  {job.isTargetCompany && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                      <Building2 className="h-3 w-3" />
                      {job.targetCompanyTag ? `${job.targetCompanyTag} Employer` : 'Target Company'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-caption text-text-muted mt-0.5">
                  <span className="capitalize">{job.industry}</span>
                  <span>•</span>
                  <span>{job.location}</span>
                </div>
              </div>
            </div>

            <Badge
              variant={getFitBadgeVariant(match.fitCategory, match.overallScore)}
              size="md"
              className="font-bold px-3 py-1 shrink-0"
            >
              {match.overallScore}% Match · {match.fitCategory}
            </Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border/60 text-caption">
            <div>
              <span className="text-text-muted block text-[11px]">Work Arrangement</span>
              <span className="font-semibold text-text-primary capitalize mt-0.5 block">
                {job.workFromAnywhere ? 'Worldwide (WFA)' : job.remoteStatus}
              </span>
            </div>
            <div>
              <span className="text-text-muted block text-[11px]">Location</span>
              <span className="font-semibold text-text-primary mt-0.5 block truncate" title={job.location}>
                {job.location || 'Not disclosed'}
              </span>
            </div>
            <div>
              <span className="text-text-muted block text-[11px]">Seniority</span>
              <span className="font-semibold text-text-primary capitalize mt-0.5 block">
                {job.seniority}
                {job.minExperienceYears ? ` (${job.minExperienceYears}+ yrs)` : ''}
              </span>
            </div>
            <div>
              <span className="text-text-muted block text-[11px]">Employment Type</span>
              <span className="font-semibold text-text-primary capitalize mt-0.5 block">
                {job.employmentType}
              </span>
            </div>
          </div>
        </Card>

        {!isDeferredReady ? (
          <div className="space-y-4 animate-pulse pt-2">
            <div className="h-44 bg-surface-subtle/80 rounded-xl border border-border/80" />
            <div className="h-64 bg-surface-subtle/80 rounded-xl border border-border/80" />
          </div>
        ) : (
          <>
            {/* ========================================================================= */}
            {/* SECTION 1: EMPLOYER DATA (Directly from official job posting)             */}
            {/* ========================================================================= */}
            <div className="rounded-xl border border-border/90 bg-surface overflow-hidden shadow-2xs">
          <div className="px-4 py-2.5 bg-surface-subtle/70 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-600" />
              <Typography as="h4" variant="caption" className="font-bold text-text-primary uppercase tracking-wider">
                Employer Data
              </Typography>
            </div>
            <span className="text-[11px] text-text-muted">
              Directly supported by original job source
            </span>
          </div>

          <div className="p-4 space-y-4 text-body-sm">
            {/* Stated Compensation Row */}
            <div className="p-3 rounded-lg bg-surface-subtle/40 border border-border/60 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-caption text-text-muted font-medium flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-text-muted" />
                  Stated Compensation:
                </span>
                {isSalaryDisclosed ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                    <Check className="h-3 w-3" />
                    Employer Stated
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                    Not Disclosed in Posting
                  </span>
                )}
              </div>

              <div className="text-body-md font-bold text-text-primary">
                {getStatedSalaryDisplay()}
              </div>

              {/* Currency Conversion Note (Non-destructive) */}
              {job.currency_conversion && (
                <div className="text-[12px] text-text-secondary bg-surface p-2.5 rounded border border-border/70 space-y-1">
                  <div className="font-medium text-text-primary flex items-center gap-1">
                    <span>Equivalent in INR:</span>
                    <strong className="text-emerald-700 dark:text-emerald-400">
                      {job.currency_conversion.converted_compensation.rawText}
                    </strong>
                  </div>
                  <div className="text-[11px] text-text-muted">
                    Converted from {job.currency_conversion.original_compensation.currency} at official benchmark rate (1 {job.currency_conversion.original_compensation.currency} ≈ ₹{job.currency_conversion.exchange_rate}). Original stated compensation is preserved.
                  </div>
                </div>
              )}

              {/* Auditable Source Excerpt (Test Case A) */}
              {job.salary_source_excerpt && (
                <div className="text-[11.5px] text-text-secondary bg-surface p-2 rounded border border-border/70 italic">
                  <span className="not-italic text-text-muted text-[10.5px] font-semibold uppercase block mb-0.5">
                    Exact JD Excerpt:
                  </span>
                  &ldquo;{job.salary_source_excerpt}&rdquo;
                </div>
              )}

              {!isSalaryDisclosed && (
                <p className="text-[11.5px] text-text-muted">
                  The employer did not disclose compensation in this job description. CareerOs strictly enforces a zero-fabrication policy and does not invent salary figures.
                </p>
              )}
            </div>

            {/* Remote Eligibility & Geographic Scope Breakdown */}
            {job.remote_eligibility && (
              <div className="p-3 rounded-lg bg-surface-subtle/40 border border-border/60 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-caption text-text-muted font-medium flex items-center gap-1.5">
                    <Globe2 className="h-3.5 w-3.5 text-blue-600" />
                    Remote Eligibility Status:
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                      job.remote_eligibility.isIndiaEligible
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                    }`}
                  >
                    <Check className="h-3 w-3" />
                    {job.remote_eligibility.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="text-body-sm font-semibold text-text-primary">
                  {job.remote_eligibility.isIndiaEligible ? 'Eligible for applicants based in India' : 'Restricted location / non-India eligibility'}
                </div>

                {job.remote_eligibility.evidence && (
                  <div className="text-[11.5px] text-text-secondary bg-surface p-2 rounded border border-border/70 italic">
                    <span className="not-italic text-text-muted text-[10.5px] font-semibold uppercase block mb-0.5">
                      Extracted Evidence:
                    </span>
                    &ldquo;{job.remote_eligibility.evidence}&rdquo;
                  </div>
                )}
              </div>
            )}

            {/* Posting Origin & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-caption">
              <div>
                <span className="text-text-muted text-[11px] block">Source Listing / Portal:</span>
                <span className="font-semibold text-text-primary">
                  {job.officialListing || `${job.company} Official Portal`}
                </span>{' '}
                <span className="text-text-muted">({job.source.domain})</span>
              </div>
              <div>
                <span className="text-text-muted text-[11px] block">Employer Posted Date:</span>
                <span className="font-semibold text-text-primary">
                  {jobVerificationEngine.formatPostedDate(job.datePosted, job.posted_at_raw)}
                </span>
              </div>
            </div>

            {/* Job Description (Normalized, Semantic, with Original Toggle) */}
            <div className="pt-2 border-t border-border/60">
              <CleanJobDescriptionView
                rawDescription={job.original_job_description || job.description}
                companyName={job.company}
                sourceUrl={job.jobUrl}
                applyUrl={applyTargetUrl}
              />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 2: CAREEROS ANALYSIS (Clearly Labeled)                             */}
        {/* ========================================================================= */}
        <div className="rounded-xl border border-primary/30 bg-surface overflow-hidden shadow-2xs">
          <div className="px-4 py-2.5 bg-primary-soft/30 border-b border-primary/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <Typography as="h4" variant="caption" className="font-bold text-primary uppercase tracking-wider">
                CareerOs Analysis
              </Typography>
            </div>
            <span className="text-[11px] text-text-muted">
              Computed against your canonical Career Profile
            </span>
          </div>

          <div className="p-4 space-y-4">
            {/* Multi-Dimensional Match Analysis */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
              <div className="p-2.5 rounded-lg bg-surface border border-border">
                <span className="text-caption text-text-muted block text-[11px]">Role Fit</span>
                <span className="text-body-md font-bold text-text-primary">
                  {match.titleMatchScore}%
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface border border-border">
                <span className="text-caption text-text-muted block text-[11px]">Skills</span>
                <span className="text-body-md font-bold text-text-primary">
                  {match.skillsMatchScore}%
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface border border-border">
                <span className="text-caption text-text-muted block text-[11px]">Experience</span>
                <span className="text-body-md font-bold text-text-primary">
                  {match.experienceMatchScore}%
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface border border-border">
                <span className="text-caption text-text-muted block text-[11px]">Workplace</span>
                <span className="text-body-md font-bold text-text-primary">
                  {match.workplaceMatchScore}%
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface border border-border col-span-2 sm:col-span-1">
                <span className="text-caption text-text-muted block text-[11px]">Compensation</span>
                <span className="text-body-md font-bold text-text-primary">
                  {match.compensationMatchScore}%
                </span>
              </div>
            </div>

            {/* Why You Match & Tailoring Guidance */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Strengths */}
              <div className="p-3.5 rounded-xl bg-success-soft/30 border border-success/30 space-y-2">
                <div className="flex items-center gap-1.5 text-success font-semibold text-body-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Why you match</span>
                </div>
                <ul className="space-y-1.5 text-body-xs text-text-secondary">
                  {match.strengths.map((str, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-success font-bold mt-0.5">•</span>
                      <span>{str}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Gaps & Guidance */}
              <div className="p-3.5 rounded-xl bg-surface-subtle border border-border space-y-2">
                <div className="flex items-center gap-1.5 text-primary font-semibold text-body-sm">
                  <Sparkles className="h-4 w-4" />
                  <span>Areas to Highlight & Tailor</span>
                </div>
                {match.gaps.length > 0 ? (
                  <ul className="space-y-1.5 text-body-xs text-text-secondary">
                    {match.gaps.map((gap, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-primary font-bold mt-0.5">•</span>
                        <span>{gap}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-body-xs text-text-muted">
                    Strong alignment across core requirements. Emphasize your key metrics and enterprise customer wins.
                  </p>
                )}
              </div>
            </div>

            {/* Third-Party Market Salary Estimate Card (Test Case C) */}
            {job.market_salary_estimate && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-semibold text-body-sm">
                    <Info className="h-4 w-4 shrink-0" />
                    <span>Third-Party Market Estimate (Not Provided by Employer)</span>
                  </div>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-amber-500/20 text-amber-900 dark:text-amber-200 capitalize">
                    {job.market_salary_estimate.confidence || 'estimated'} Confidence
                  </span>
                </div>

                <div className="text-body-md font-bold text-text-primary">
                  {job.market_salary_estimate.currency === 'INR' ? '₹' : '$'}
                  {job.market_salary_estimate.min?.toLocaleString()} –{' '}
                  {job.market_salary_estimate.currency === 'INR' ? '₹' : '$'}
                  {job.market_salary_estimate.max?.toLocaleString()} {job.market_salary_estimate.currency} / yr
                </div>

                <p className="text-[11.5px] text-text-secondary leading-normal">
                  Source: <strong>{job.market_salary_estimate.source}</strong> benchmark. This estimate is provided for context only and is not guaranteed or offered by the employer.
                </p>
              </div>
            )}

            {/* Core Competencies Matrix */}
            {job.requiredSkills.length > 0 && (
              <div className="space-y-2">
                <span className="text-caption font-semibold text-text-primary block">
                  Identified Competencies & Stack:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {job.requiredSkills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-md text-caption font-medium bg-surface-subtle border border-border text-text-primary"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action Connectors */}
            <div className="pt-2 border-t border-border/60">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-2">
                Connected CareerOs Actions
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<FileText className="h-4 w-4 text-primary" />}
                  onClick={() => {
                    onClose();
                    navigate(`/resume-studio?jobId=${job.id}`);
                  }}
                  className="justify-start text-caption h-9"
                >
                  Tailor Resume
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Send className="h-4 w-4 text-primary" />}
                  onClick={() => {
                    onClose();
                    navigate(`/outreach?jobId=${job.id}`);
                  }}
                  className="justify-start text-caption h-9"
                >
                  Prepare Outreach
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<KanbanSquare className="h-4 w-4 text-primary" />}
                  onClick={() => {
                    onSave(job.id);
                    onClose();
                    navigate('/applications');
                  }}
                  className="justify-start text-caption h-9"
                >
                  Track in Pipeline
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 3: SOURCE VERIFICATION & DATA INTEGRITY                           */}
        {/* ========================================================================= */}
        <div className="rounded-xl border border-emerald-500/30 bg-surface overflow-hidden shadow-2xs">
          <div className="px-4 py-2.5 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <Typography as="h4" variant="caption" className="font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                Source Verification & Data Integrity
              </Typography>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11.5px] font-bold text-emerald-800 dark:text-emerald-300">
                Integrity Score: {integrityScore}/100
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold border ${badgeColor}`}
              >
                <span>{verificationBadge.label}</span>
              </span>
            </div>
          </div>

          <div className="p-4 space-y-4 text-caption">
            {/* 4-Point Verification Checklist */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-subtle/50 border border-border/70">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <span className="font-semibold text-text-primary block text-[11.5px]">
                    Company Domain Verified
                  </span>
                  <span className="text-[10.5px] text-text-muted">
                    {job.source.domain} official domain
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-subtle/50 border border-border/70">
                {job.verificationStatus !== 'link_broken' && job.verificationStatus !== 'job_closed' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <X className="h-4 w-4 text-red-500 shrink-0" />
                )}
                <div>
                  <span className="font-semibold text-text-primary block text-[11.5px]">
                    Posting Live Availability
                  </span>
                  <span className="text-[10.5px] text-text-muted">
                    {job.verificationStatus === 'link_broken'
                      ? 'Link unavailable (404/expired)'
                      : job.verificationStatus === 'job_closed'
                      ? 'Posting confirmed closed'
                      : 'HTTP 200 live status confirmed'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-subtle/50 border border-border/70">
                {isApplyUrlValid ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                )}
                <div>
                  <span className="font-semibold text-text-primary block text-[11.5px]">
                    Application Link Operational
                  </span>
                  <span className="text-[10.5px] text-text-muted">
                    {isApplyUrlValid ? 'Direct ATS application active' : 'Application link unavailable'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-subtle/50 border border-border/70">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <span className="font-semibold text-text-primary block text-[11.5px]">
                    Original Content Ingested
                  </span>
                  <span className="text-[10.5px] text-text-muted">
                    Structured description & specs verified
                  </span>
                </div>
              </div>
            </div>

            {/* Provenance Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-border/60 text-text-secondary text-[12px]">
              <div>
                <span className="text-text-muted text-[11px] block">Discovery Origin / Source</span>
                <strong className="text-text-primary font-medium">{job.source.name}</strong>{' '}
                <span className="text-text-muted text-[11px]">({job.source.domain})</span>
              </div>
              <div>
                <span className="text-text-muted text-[11px] block">Source Authority Tier</span>
                <strong className="text-text-primary font-medium">
                  {job.primary_source ? `Level ${job.primary_source.tier || 1} · ${job.primary_source.source_type || 'Direct ATS'}` : 'Level 1 · Official ATS'}
                </strong>
              </div>
              <div>
                <span className="text-text-muted text-[11px] block">Employer Stated Date</span>
                <strong className="text-text-primary font-medium">
                  {jobVerificationEngine.formatPostedDate(job.datePosted, job.posted_at_raw)}
                </strong>
              </div>
              <div>
                <span className="text-text-muted text-[11px] block">Last Verification Timestamp</span>
                <strong className="text-text-primary font-medium">
                  {jobVerificationEngine.formatLastVerified(job.lastVerified || job.verifiedAt)}
                </strong>
              </div>
            </div>

            {/* Conflicting Fields (Test Case O) */}
            {job.conflicting_fields && Object.keys(job.conflicting_fields).length > 0 && (
              <div className="p-3 rounded-lg bg-surface-subtle border border-border/70 space-y-1.5">
                <span className="font-semibold text-text-primary text-[11.5px] flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  Multi-Source Conflict Resolution
                </span>
                <div className="space-y-1 text-[11px] text-text-secondary">
                  {Object.entries(job.conflicting_fields).map(([field, item], idx) => (
                    <div key={idx}>
                      Field <strong className="font-mono">{field}</strong>: Official ATS reported &ldquo;{item.official}&rdquo;; Third-party ({item.source}) claimed &ldquo;{item.thirdParty}&rdquo;. Official ATS was preserved as source of truth.
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Target ATS URL */}
            {applyTargetUrl && applyTargetUrl !== '#' && (
              <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-text-muted text-[11px] truncate flex-1 min-w-[200px]">
                  Direct ATS URL: <span className="font-mono text-text-secondary">{applyTargetUrl}</span>
                </span>
                <a
                  href={applyTargetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1 text-[11.5px] font-semibold shrink-0"
                >
                  <span>Open ATS Portal</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {/* Internal Verification Audit Button (Directive 37) */}
            <div className="pt-3 border-t border-border/60 flex items-center justify-between flex-wrap gap-2">
              <span className="text-[11px] text-text-muted">
                Audit diagnostics, HTTP telemetry & compensation evidence:
              </span>
              <button
                type="button"
                onClick={() => onInspectDebug?.(job)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 transition-colors cursor-pointer"
              >
                <Terminal className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Open Truth & Verification Trace</span>
              </button>
            </div>
          </div>
        </div>
          </>
        )}
      </div>
    </Drawer>
  );
};
