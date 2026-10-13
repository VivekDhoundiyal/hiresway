import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography } from '@/components/typography';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { JobOpportunity, CRMJobStatus, NextActionRecord } from '@/core/jobs/types';
import { JobMatchAnalysis } from '@/core/intelligence';
import { jobVerificationEngine } from '@/core/jobs/jobVerificationEngine';
import { jobRepository } from '@/core/jobs/jobRepository';
import {
  X,
  Building2,
  MapPin,
  DollarSign,
  Briefcase,
  ExternalLink,
  ShieldCheck,
  FileText,
  Send,
  RefreshCw,
  AlertTriangle,
  BookmarkCheck,
  CheckCircle2,
  Check,
  Info,
  Sparkles,
  Layers,
  Clock,
  ListTodo,
  Save,
  Database,
} from 'lucide-react';

const CRM_STATUS_OPTIONS: CRMJobStatus[] = [
  'Interested',
  'Shortlisted',
  'Saved',
  'Viewed',
  'To Apply',
  'Applied',
  'Application Submitted',
  'Assessment',
  'Assignment',
  'Recruiter Screen',
  'HR Interview',
  'Hiring Manager Interview',
  'Technical Interview',
  'Final Interview',
  'Offer',
  'Negotiation',
  'Accepted',
  'Rejected',
  'Withdrawn',
  'On Hold',
  'Closed',
  'Archived',
];

const NEXT_ACTION_OPTIONS: NextActionRecord['action'][] = [
  'Apply',
  'Complete assignment',
  'Follow up with recruiter',
  'Prepare interview',
  'Send thank-you email',
  'Negotiate offer',
  'Wait for response',
  'Custom',
];

interface JobInspectDrawerProps {
  job: JobOpportunity & { match: JobMatchAnalysis };
  isOpen: boolean;
  onClose: () => void;
  onJobUpdated?: (updatedJob: JobOpportunity) => void;
}

export const JobInspectDrawer: React.FC<JobInspectDrawerProps> = ({
  job: initialJob,
  isOpen,
  onClose,
  onJobUpdated,
}) => {
  const navigate = useNavigate();
  const [job, setJob] = useState(initialJob);
  const [isVerifying, setIsVerifying] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [notesText, setNotesText] = useState(initialJob?.notes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [noteSuccess, setNoteSuccess] = useState(false);

  useEffect(() => {
    setJob(initialJob);
    setNotesText(initialJob?.notes || '');
  }, [initialJob]);

  if (!isOpen) return null;

  const handleSaveNotes = () => {
    setIsSavingNotes(true);
    const updated = jobRepository.updateJobNotes(job.id, notesText);
    if (updated) {
      setJob({ ...updated, match: job.match });
      if (onJobUpdated) onJobUpdated(updated);
      setNoteSuccess(true);
      setTimeout(() => setNoteSuccess(false), 2500);
    }
    setIsSavingNotes(false);
  };

  const handleVerifyNow = () => {
    setIsVerifying(true);
    setTimeout(() => {
      const updated = jobRepository.verifyDatabaseJob(job.id);
      if (updated) {
        setJob({ ...updated, match: job.match });
        if (onJobUpdated) onJobUpdated(updated);
        setNotification('Live verification check completed!');
        setTimeout(() => setNotification(null), 3000);
      }
      setIsVerifying(false);
    }, 400);
  };

  const handleTrackApplication = () => {
    jobRepository.markApplied(job.id);
    setNotification('Tracked in Applications Pipeline!');
    setTimeout(() => {
      setNotification(null);
      navigate('/applications');
    }, 600);
  };

  const handleStatusChange = (status: CRMJobStatus) => {
    const updated = jobRepository.updateCRMStatus(job.id, status);
    if (updated) {
      setJob({ ...updated, match: job.match });
      if (onJobUpdated) onJobUpdated(updated);
      setNotification(`Status updated to ${status}`);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleNextActionChange = (action: NextActionRecord['action']) => {
    const updated = jobRepository.updateNextAction(job.id, { action, completed: false });
    if (updated) {
      setJob({ ...updated, match: job.match });
      if (onJobUpdated) onJobUpdated(updated);
      setNotification(`Next action set to ${action}`);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const verificationBadge = jobVerificationEngine.getVerificationBadgeConfig(job.verificationStatus);

  const verificationBadgeClass =
    verificationBadge.variant === 'warning'
      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25'
      : verificationBadge.variant === 'error'
      ? 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/25'
      : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25';

  const isStale = jobVerificationEngine.isVerificationStale(job.lastVerified, 14);

  const isSalaryDisclosed = Boolean(
    job.salary.disclosed &&
      (job.salary.rawText || (job.salary.min && job.salary.min > 0)) &&
      job.salary_status !== 'not_disclosed'
  );

  const formatStatedSalary = () => {
    if (!isSalaryDisclosed) return 'Salary not disclosed by employer';
    if (job.salary_raw_text) return job.salary_raw_text;
    if (job.salary.rawText) return job.salary.rawText;
    if (job.salary.min && job.salary.max) {
      const curr = job.salary.currency || 'USD';
      const sym = curr === 'INR' ? '₹' : curr === 'EUR' ? '€' : curr === 'GBP' ? '£' : '$';
      if (curr === 'INR') {
        return `₹${(job.salary.min / 100000).toFixed(0)}L – ₹${(job.salary.max / 100000).toFixed(0)}L / yr`;
      }
      return `${sym}${Math.round(job.salary.min / 1000)}k – ${sym}${Math.round(job.salary.max / 1000)}k / yr`;
    }
    return 'Salary not disclosed by employer';
  };

  // Safe Apply Button Configuration
  const isBroken = job.verificationStatus === 'link_broken' || job.verificationStatus === 'failed';
  const isClosed = job.verificationStatus === 'job_closed';
  const rawTargetUrl = job.applyUrl || job.jobUrl || job.originalUrl || '';
  const targetUrl = jobVerificationEngine.sanitizeApplyUrl(rawTargetUrl);
  const sourceListingUrl = jobVerificationEngine.sanitizeApplyUrl(job.source?.sourceUrl || '');

  const isApplyUrlValid =
    Boolean(targetUrl && targetUrl !== '#' && targetUrl.startsWith('http')) &&
    jobVerificationEngine.verifyJobUrl(targetUrl).isValid &&
    job.isApplyUrlValidated !== false &&
    !isBroken &&
    !isClosed;

  const integrityScore = job.integrity_score ?? jobVerificationEngine.calculateIntegrityScore(job).score;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-surface border-l border-border shadow-2xl flex flex-col justify-between overflow-y-auto">
          {/* Top Sticky Header */}
          <div className="p-6 border-b border-border/80 sticky top-0 bg-surface/95 backdrop-blur-md z-10 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-caption font-semibold border ${verificationBadgeClass}`}
                  >
                    <span>{verificationBadge.label}</span>
                  </span>

                  <Badge
                    variant={
                      job.match.overallScore >= 85
                        ? 'success'
                        : job.match.overallScore >= 70
                        ? 'primary'
                        : job.match.overallScore >= 55
                        ? 'warning'
                        : 'neutral'
                    }
                    size="sm"
                  >
                    {job.match.overallScore}% · {job.match.fitCategory}
                  </Badge>

                  {job.isTargetCompany && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                      <Building2 className="h-3 w-3" />
                      <span>{job.targetCompanyTag ? `${job.targetCompanyTag} Target` : 'Target Company'}</span>
                    </span>
                  )}

                  <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 ml-auto">
                    Integrity: {integrityScore}/100
                  </span>
                </div>

                <Typography as="h2" variant="h3" className="font-bold text-text-primary pt-1 leading-snug">
                  {job.title}
                </Typography>

                <div className="flex items-center gap-2 text-body-sm text-text-secondary">
                  <span className="font-semibold text-text-primary">{job.company}</span>
                  <span>•</span>
                  <span>{job.department || job.industry}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-subtle transition-colors cursor-pointer shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {notification && (
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-body-sm text-emerald-800 dark:text-emerald-200 flex items-center justify-between animate-in fade-in">
                <span>{notification}</span>
                <button
                  type="button"
                  onClick={() => setNotification(null)}
                  className="text-emerald-700 text-caption underline cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>

          {/* Drawer Body Content */}
          <div className="p-6 space-y-6 flex-1">
            {/* Key Role Attributes Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-surface-subtle/50 border border-border text-body-sm">
              <div>
                <span className="text-[11.5px] text-text-muted flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> Compensation
                </span>
                <span className="font-semibold text-text-primary block mt-0.5 truncate" title={formatStatedSalary()}>
                  {formatStatedSalary()}
                </span>
              </div>
              <div>
                <span className="text-[11.5px] text-text-muted flex items-center gap-1">
                  <Briefcase className="h-3 w-3" /> Arrangement
                </span>
                <span className="font-semibold text-text-primary block mt-0.5 capitalize">
                  {job.workFromAnywhere ? 'Worldwide (WFA)' : job.remoteStatus}
                </span>
              </div>
              <div>
                <span className="text-[11.5px] text-text-muted flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Location
                </span>
                <span className="font-semibold text-text-primary block mt-0.5 truncate" title={job.location}>
                  {job.location || 'Not disclosed'}
                </span>
              </div>
              <div>
                <span className="text-[11.5px] text-text-muted flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> Seniority
                </span>
                <span className="font-semibold text-text-primary block mt-0.5 capitalize">
                  {job.seniority}
                </span>
              </div>
            </div>

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
                  Official posting provenance
                </span>
              </div>

              <div className="p-4 space-y-3.5 text-body-sm">
                {/* Stated Compensation */}
                <div className="p-3 rounded-lg bg-surface-subtle/40 border border-border/60 space-y-1.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-caption text-text-muted font-medium">Stated Compensation:</span>
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
                    {formatStatedSalary()}
                  </div>

                  {job.currency_conversion && (
                    <div className="text-[12px] text-text-secondary bg-surface p-2 rounded border border-border/70 space-y-0.5">
                      <div className="font-medium text-text-primary">
                        INR Benchmark: <strong className="text-emerald-700 dark:text-emerald-400">{job.currency_conversion.converted_compensation.rawText}</strong>
                      </div>
                      <div className="text-[11px] text-text-muted">
                        Converted from {job.currency_conversion.original_compensation.currency} at official rate (1 {job.currency_conversion.original_compensation.currency} ≈ ₹{job.currency_conversion.exchange_rate}). Original stated compensation is preserved.
                      </div>
                    </div>
                  )}

                  {job.salary_source_excerpt && (
                    <div className="text-[11.5px] text-text-secondary bg-surface p-2 rounded border border-border/70 italic">
                      <span className="not-italic text-text-muted text-[10.5px] font-semibold uppercase block mb-0.5">
                        Exact JD Excerpt:
                      </span>
                      &ldquo;{job.salary_source_excerpt}&rdquo;
                    </div>
                  )}
                </div>

                {/* Recruiter & Source Metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-caption">
                  <div>
                    <span className="text-text-muted block text-[11px]">Discovery Origin / Source:</span>
                    <span className="font-semibold text-text-primary">{job.sourceName || job.source?.name}</span>
                  </div>
                  <div>
                    <span className="text-text-muted block text-[11px]">Official Portal:</span>
                    <span className="font-semibold text-text-primary">
                      {job.officialListing || `${job.company} Careers Portal`}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted block text-[11px]">Recruiter Posted Date:</span>
                    <span className="font-semibold text-text-primary">
                      {jobVerificationEngine.formatPostedDate(job.datePosted || job.postingDate, job.posted_at_raw)}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted block text-[11px]">Last Verified:</span>
                    <span className="font-semibold text-text-primary">
                      {jobVerificationEngine.formatLastVerified(job.lastVerified)}
                    </span>
                  </div>
                </div>

                {/* Official Job Description */}
                <div className="space-y-1 pt-2 border-t border-border/60">
                  <span className="text-caption font-semibold text-text-primary uppercase tracking-wider block">
                    Official Job Description
                  </span>
                  <div className="p-3.5 rounded-lg bg-surface-subtle/30 border border-border/60 text-body-sm text-text-secondary whitespace-pre-line leading-relaxed max-h-64 overflow-y-auto font-sans">
                    {job.description || 'No detailed description available.'}
                  </div>
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
                  Canonical Career Profile Match
                </span>
              </div>

              <div className="p-4 space-y-3.5">
                {/* Strengths */}
                <div className="space-y-2">
                  <span className="text-caption font-semibold text-emerald-700 dark:text-emerald-400 block">
                    Why this matches your profile:
                  </span>
                  <div className="space-y-1.5">
                    {job.match.strengths.map((str: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 text-body-sm text-text-primary">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span>{str}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Gaps */}
                {job.match.gaps && job.match.gaps.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border/50">
                    <span className="text-caption font-semibold text-amber-700 dark:text-amber-400 block">
                      Potential gaps or considerations:
                    </span>
                    <div className="space-y-1.5">
                      {job.match.gaps.map((gap: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-2 text-body-sm text-text-secondary">
                          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <span>{gap}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Third-Party Market Salary Estimate */}
                {job.market_salary_estimate && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-semibold text-body-sm">
                        <Info className="h-4 w-4 shrink-0" />
                        <span>Third-Party Market Estimate (Not From Employer)</span>
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

                    <p className="text-[11.5px] text-text-secondary">
                      Source: <strong>{job.market_salary_estimate.source}</strong> benchmark. Provided for context only.
                    </p>
                  </div>
                )}

                {/* Required Skills */}
                {job.requiredSkills && job.requiredSkills.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-border/50">
                    <span className="text-caption font-semibold text-text-primary block">
                      Required Skills & Competencies:
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {job.requiredSkills.map((s: string) => (
                        <span
                          key={s}
                          className="text-caption px-2.5 py-1 rounded-md bg-surface-subtle border border-border text-text-primary font-medium"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleVerifyNow}
                  disabled={isVerifying}
                  leftIcon={<RefreshCw className={`h-3.5 w-3.5 ${isVerifying ? 'animate-spin text-primary' : ''}`} />}
                  className="h-7 text-[11.5px]"
                >
                  {isVerifying ? 'Checking...' : 'Verify Now'}
                </Button>
              </div>

              <div className="p-4 space-y-3.5 text-caption">
                {/* 4-Check Verification Checklist */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-subtle/50 border border-border/70">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <span className="font-semibold text-text-primary block text-[11px]">Company Verified</span>
                      <span className="text-[10px] text-text-muted">{job.company} official entity</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-subtle/50 border border-border/70">
                    {!isBroken && !isClosed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <X className="h-4 w-4 text-red-500 shrink-0" />
                    )}
                    <div>
                      <span className="font-semibold text-text-primary block text-[11px]">Posting Active</span>
                      <span className="text-[10px] text-text-muted">
                        {isBroken ? 'Link unavailable' : isClosed ? 'Closed posting' : 'HTTP 200 confirmed live'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-subtle/50 border border-border/70">
                    {isApplyUrlValid ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    )}
                    <div>
                      <span className="font-semibold text-text-primary block text-[11px]">Apply Link Operational</span>
                      <span className="text-[10px] text-text-muted">
                        {isApplyUrlValid ? 'Direct application active' : 'Application link unavailable'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-subtle/50 border border-border/70">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <span className="font-semibold text-text-primary block text-[11px]">Original Content Ingested</span>
                      <span className="text-[10px] text-text-muted">Job specs verified</span>
                    </div>
                  </div>
                </div>

                {isStale && (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11.5px] text-amber-800 dark:text-amber-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      Verification check is older than 14 days. Re-verify to confirm posting is still live.
                    </span>
                    <button
                      type="button"
                      onClick={handleVerifyNow}
                      className="font-bold underline ml-2 cursor-pointer"
                    >
                      Verify
                    </button>
                  </div>
                )}

                <div className="pt-2 border-t border-border/50 text-[11.5px] space-y-1">
                  <div className="flex items-center justify-between text-text-muted">
                    <span>Canonical URL:</span>
                    {targetUrl && targetUrl !== '#' ? (
                      <a
                        href={targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1 font-mono truncate max-w-[320px]"
                      >
                        <span className="truncate">{targetUrl}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    ) : (
                      <span className="italic text-text-muted">Private / Offline (No public URL)</span>
                    )}
                  </div>

                  {job.verificationReason && (
                    <p className="text-text-muted italic pt-1">
                      Note: {job.verificationReason}
                    </p>
                  )}
                </div>

                {/* Conflicting Fields */}
                {job.conflicting_fields && Object.keys(job.conflicting_fields).length > 0 && (
                  <div className="p-2.5 rounded-lg bg-surface-subtle border border-border/70 space-y-1">
                    <span className="font-semibold text-text-primary text-[11px] flex items-center gap-1">
                      <Layers className="h-3 w-3 text-primary" />
                      Source Discrepancy Resolution
                    </span>
                    <div className="space-y-0.5 text-[10.5px] text-text-secondary">
                      {Object.entries(job.conflicting_fields).map(([field, item], idx) => (
                        <div key={idx}>
                          Field {field}: Official reported &ldquo;{item.official}&rdquo;; Third-party ({item.source}) claimed &ldquo;{item.thirdParty}&rdquo;. Official preserved.
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Recruiter Contact Details */}
            {(job.recruiterName || job.recruiterEmail || job.recruiterLinkedin) && (
              <div className="p-4 rounded-xl border border-border bg-surface-subtle/30 space-y-2 text-caption">
                <Typography as="h4" variant="caption" className="font-bold text-text-primary uppercase tracking-wider">
                  Recruiter Contact
                </Typography>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <span className="text-text-muted block">Contact Name</span>
                    <strong className="text-text-primary">{job.recruiterName || 'Not disclosed'}</strong>
                  </div>
                  <div>
                    <span className="text-text-muted block">Email</span>
                    {job.recruiterEmail ? (
                      <a href={`mailto:${job.recruiterEmail}`} className="text-primary hover:underline truncate block">
                        {job.recruiterEmail}
                      </a>
                    ) : (
                      <span className="text-text-muted">Not disclosed</span>
                    )}
                  </div>
                  <div>
                    <span className="text-text-muted block">LinkedIn</span>
                    {job.recruiterLinkedin ? (
                      <a
                        href={job.recruiterLinkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        <span>View Profile</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-text-muted">Not disclosed</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* SECTION 5: OPPORTUNITY CRM & ACTIVITY TIMELINE                            */}
            {/* ========================================================================= */}
            <div className="rounded-xl border border-blue-500/30 bg-surface overflow-hidden shadow-2xs">
              <div className="px-4 py-2.5 bg-blue-50/50 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListTodo className="h-4 w-4 text-blue-600" />
                  <Typography as="h4" variant="caption" className="font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider">
                    Opportunity CRM & Pipeline Status
                  </Typography>
                </div>
                <span className="text-[11px] text-text-muted">
                  Interactive Lifecycle Tracking
                </span>
              </div>

              <div className="p-4 space-y-4 text-body-sm">
                {/* Status & Next Action Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-caption font-semibold text-text-muted mb-1">
                      CRM Pipeline Status (17 Stages)
                    </label>
                    <select
                      value={job.crm_status || (job.lifecycleState === 'SAVED' ? 'Saved' : job.lifecycleState === 'APPLIED' ? 'Applied' : 'Viewed')}
                      onChange={(e) => handleStatusChange(e.target.value as CRMJobStatus)}
                      className="w-full h-9 px-3 text-xs font-semibold rounded-lg border border-border bg-surface text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-3xs"
                    >
                      {CRM_STATUS_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-caption font-semibold text-text-muted mb-1">
                      Next Scheduled Action
                    </label>
                    <select
                      value={job.next_action?.action || ''}
                      onChange={(e) => handleNextActionChange(e.target.value as any)}
                      className="w-full h-9 px-3 text-xs rounded-lg border border-border/80 bg-surface-subtle text-text-secondary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-3xs"
                    >
                      <option value="">Set Action...</option>
                      {NEXT_ACTION_OPTIONS.map((act) => (
                        <option key={act} value={act}>
                          {act}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Activity Timeline */}
                <div className="pt-3 border-t border-border/60">
                  <div className="flex items-center gap-1.5 text-caption font-semibold text-text-primary mb-2">
                    <Clock className="h-3.5 w-3.5 text-blue-600" />
                    <span>Activity & Verification Timeline</span>
                  </div>

                  {job.activity_timeline && job.activity_timeline.length > 0 ? (
                    <div className="space-y-2 border-l-2 border-blue-200 dark:border-blue-900 ml-2 pl-3 py-1">
                      {job.activity_timeline.map((entry) => (
                        <div key={entry.id} className="relative text-xs">
                          <div className="absolute -left-[19px] top-1 h-2 w-2 rounded-full bg-blue-600" />
                          <div className="font-medium text-text-primary">{entry.action}</div>
                          <div className="text-[10.5px] text-text-muted">
                            {new Date(entry.timestamp).toLocaleString()}
                          </div>
                          {entry.notes && (
                            <div className="text-[11px] text-text-secondary italic mt-0.5">
                              "{entry.notes}"
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted">No historical activity logged yet.</p>
                  )}
                </div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* SECTION 6: CANONICAL PROVENANCE & DEDUPLICATION HASH                     */}
            {/* ========================================================================= */}
            <div className="rounded-xl border border-border/80 bg-surface-subtle/40 p-4 space-y-3 text-caption">
              <div className="flex items-center justify-between">
                <span className="font-bold text-text-primary flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <Database className="h-3.5 w-3.5 text-primary" />
                  Canonical Provenance & Deduplication
                </span>
                <span className="font-mono text-[10px] text-text-muted bg-surface px-1.5 py-0.5 rounded border border-border">
                  ID: {job.id.slice(0, 14)}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-border/60">
                <div>
                  <span className="text-text-muted text-[10.5px] block">First Discovered</span>
                  <span className="font-semibold text-text-primary text-[11px]">
                    {job.discoveredAt || job.dateDiscovered ? new Date(job.discoveredAt || job.dateDiscovered).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted text-[10.5px] block">Original Posted</span>
                  <span className="font-semibold text-text-primary text-[11px]">
                    {job.originalPostedAt || job.datePosted ? jobVerificationEngine.formatPostedDate(job.originalPostedAt || job.datePosted) : 'Not disclosed'}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted text-[10.5px] block">Last Verified</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400 text-[11px]">
                    {jobVerificationEngine.formatLastVerified(job.lastVerifiedAt || job.lastVerified)}
                  </span>
                </div>
              </div>
              {/* Multi-source deduplication info */}
              {((job.secondary_sources && job.secondary_sources.length > 0) || (job.sourcesHistory && job.sourcesHistory.length > 1)) && (
                <div className="pt-2 border-t border-border/60">
                  <span className="text-[11px] font-semibold text-text-secondary block mb-1">
                    Multi-Source Merged History:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-primary/10 text-primary font-medium border border-primary/20">
                      Primary: {job.sourceName || job.source?.name}
                    </span>
                    {job.secondary_sources?.map((s, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded text-[10px] bg-surface text-text-secondary border border-border">
                        Merged: {s.name} ({new Date(s.discoveredAt).toLocaleDateString()})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ========================================================================= */}
            {/* SECTION 7: EDITABLE CANDIDATE NOTES                                       */}
            {/* ========================================================================= */}
            <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-2xs">
              <div className="px-4 py-2.5 bg-surface-subtle/70 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <Typography as="h4" variant="caption" className="font-bold text-text-primary uppercase tracking-wider">
                    Candidate Notes
                  </Typography>
                </div>
                {noteSuccess && (
                  <span className="text-caption text-emerald-600 font-semibold flex items-center gap-1 animate-in fade-in">
                    <Check className="h-3 w-3" /> Saved!
                  </span>
                )}
              </div>
              <div className="p-4 space-y-2.5">
                <textarea
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  placeholder="Add private candidate notes (e.g., recruiter phone screen notes, compensation expectations, referral contacts)..."
                  className="w-full h-24 p-2.5 text-xs rounded-lg border border-border bg-surface-subtle/50 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-y"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-text-muted">
                    Persisted with canonical job record
                  </span>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={isSavingNotes || notesText === (job.notes || '')}
                    onClick={handleSaveNotes}
                    leftIcon={<Save className="h-3.5 w-3.5" />}
                    className="h-7 text-xs"
                  >
                    {isSavingNotes ? 'Saving...' : 'Save Notes'}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Bottom Actions Bar */}
          <div className="p-4 border-t border-border bg-surface/95 backdrop-blur-md sticky bottom-0 z-10 flex items-center justify-between gap-2 flex-wrap">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Apply Button with Strict Safety */}
              {isBroken ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled
                    className="px-3.5 py-2 rounded-md text-caption font-semibold bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400 cursor-not-allowed"
                  >
                    Application link unavailable
                  </button>
                  {sourceListingUrl && (
                    <a
                      href={sourceListingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-2 text-caption font-medium text-text-primary bg-surface border border-border hover:bg-surface-subtle rounded-md transition-colors"
                    >
                      <span>View source listing</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ) : isClosed ? (
                <button
                  type="button"
                  disabled
                  className="px-3.5 py-2 rounded-md text-caption font-semibold bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400 cursor-not-allowed"
                >
                  This posting appears closed
                </button>
              ) : isApplyUrlValid ? (
                <a
                  href={targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-caption font-bold bg-primary hover:bg-primary-hover text-white transition-colors shadow-xs"
                >
                  <span>Apply on Official Portal</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}

              <Button
                variant="secondary"
                onClick={handleTrackApplication}
                leftIcon={<BookmarkCheck className="h-4 w-4" />}
              >
                Track Application
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  onClose();
                  navigate(`/outreach?jobId=${job.id}`);
                }}
                leftIcon={<Send className="h-4 w-4" />}
              >
                Prepare Outreach
              </Button>

              <Button
                variant="primary"
                onClick={() => {
                  onClose();
                  navigate(`/resume-studio?jobId=${job.id}`);
                }}
                leftIcon={<FileText className="h-4 w-4" />}
              >
                Tailor Resume
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
