import React, { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useProfile } from '@/core/profile';
import {
  generateTailoredResume,
  mockJobCatalog,
  TailoredResumeBlueprint,
  JobPosting,
  jobRepository,
  opportunityToJobPosting,
} from '@/core/intelligence';
import { Card } from '@/components/card';
import { Typography } from '@/components/typography';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  Download,
  Building2,
  ChevronRight,
  Lock,
} from 'lucide-react';

export const ResumeStudioPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryJobId = searchParams.get('jobId');
  const navigate = useNavigate();
  const { profile } = useProfile();

  const availableJobs: JobPosting[] = useMemo(() => {
    const dbOpps = jobRepository.getDatabaseOpportunities();
    const activeOpps = jobRepository.getActiveOpportunities();
    const combined = [...dbOpps, ...activeOpps];

    if (queryJobId) {
      const specific = jobRepository.getOpportunityById(queryJobId);
      if (specific && !combined.some((j) => j.id === queryJobId)) {
        combined.unshift(specific);
      }
    }

    if (combined.length > 0) {
      return combined.map(opportunityToJobPosting);
    }
    return mockJobCatalog;
  }, [queryJobId]);

  const [selectedJobId, setSelectedJobId] = useState<string>(
    queryJobId || (availableJobs.length > 0 ? availableJobs[0].id : '')
  );

  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tailored' | 'canonical'>('tailored');

  const selectedJob = useMemo(() => {
    return availableJobs.find((j) => j.id === selectedJobId) || availableJobs[0];
  }, [availableJobs, selectedJobId]);

  const blueprint: TailoredResumeBlueprint = useMemo(() => {
    return generateTailoredResume(profile, selectedJob);
  }, [profile, selectedJob]);

  const handleCopyText = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    setTimeout(() => setCopiedSection(null), 2500);
  };

  const handleDownloadFullResume = () => {
    const lines: string[] = [];
    lines.push(`# ${profile.personalInfo.fullName || 'Candidate'}`);
    lines.push(`**${blueprint.customHeadline}**`);
    lines.push(
      `${profile.personalInfo.email} | ${profile.personalInfo.phone} | ${profile.personalInfo.city}, ${profile.personalInfo.country}`
    );
    if (profile.personalInfo.linkedinUrl)
      lines.push(`LinkedIn: ${profile.personalInfo.linkedinUrl}`);
    lines.push('\n---\n');

    lines.push('## Professional Summary');
    lines.push(blueprint.customSummary);
    lines.push('\n---\n');

    lines.push('## Core Competencies & Keywords');
    lines.push(blueprint.highlightedSkills.join(' • '));
    lines.push('\n---\n');

    lines.push('## Work Experience');
    blueprint.prioritizedExperiences.forEach(
      ({ experience, highlightedAchievements }) => {
        lines.push(
          `### ${experience.title} - ${experience.company} (${experience.startDate} to ${experience.isCurrent ? 'Present' : experience.endDate})`
        );
        highlightedAchievements.forEach((b: string) => lines.push(`- ${b}`));
        lines.push('');
      }
    );

    lines.push('## Education');
    profile.education.forEach((edu) => {
      lines.push(
        `- ${edu.degree} in ${edu.fieldOfStudy}, ${edu.institution} (${edu.startDate} - ${edu.endDate})`
      );
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Resume_${(profile.personalInfo.fullName || 'Candidate').replace(/\s+/g, '_')}_${selectedJob.company}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* 1. Header */}
      <div className="space-y-3 pb-5 border-b border-border/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Typography
                as="h1"
                variant="h2"
                color="primary"
                className="text-2xl sm:text-3xl font-bold tracking-tight"
              >
                Resume Studio
              </Typography>
              <Badge variant="primary" size="sm" icon={<Sparkles className="h-3 w-3" />}>
                ATS Precision Tailoring
              </Badge>
            </div>
            <Typography as="p" variant="body-md" color="secondary" className="mt-1">
              Generate role-specific resume blueprints from your canonical profile without
              ever inventing facts or compromising integrity.
            </Typography>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadFullResume}
              leftIcon={<Download className="h-4 w-4" />}
            >
              Export Markdown
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleCopyText(blueprint.customSummary, 'full')}
              leftIcon={
                copiedSection === 'full' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )
              }
            >
              {copiedSection === 'full' ? 'Copied Summary!' : 'Copy Summary'}
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Guardrail Banner */}
      <div className="p-4 rounded-xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-surface flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-emerald-600 text-white shadow-xs shrink-0 mt-0.5">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-text-primary text-body-sm">
                Single Source of Truth Integrity Guarantee
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                Zero Hallucinations
              </span>
            </div>
            <p className="text-text-secondary text-caption mt-0.5">
              Your canonical profile remains 100% immutable. CareerOs reorganizes and
              highlights your genuine achievements to maximize ATS keyword relevance for
              each target role.
            </p>
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate('/profile')}
          rightIcon={<ChevronRight className="h-3.5 w-3.5" />}
          className="shrink-0 self-end md:self-center"
        >
          View Base Profile
        </Button>
      </div>

      {/* 3. Selector Bar */}
      <Card variant="default" padding="sm" className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            <Building2 className="h-4 w-4 text-text-muted shrink-0" />
            <span className="text-body-sm font-medium text-text-secondary shrink-0">
              Tailor for Role:
            </span>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              aria-label="Tailor for Role"
              className="w-full sm:max-w-md h-9 rounded-md bg-surface text-body-sm text-text-primary border border-border px-3 font-medium focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {availableJobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} — {job.company}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex rounded-md border border-border bg-surface p-0.5 text-caption">
              <button
                onClick={() => setActiveTab('tailored')}
                className={`px-2.5 py-1 rounded ${
                  activeTab === 'tailored'
                    ? 'bg-primary-soft text-primary font-bold'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                Tailored Blueprint
              </button>
              <button
                onClick={() => setActiveTab('canonical')}
                className={`px-2.5 py-1 rounded ${
                  activeTab === 'canonical'
                    ? 'bg-primary-soft text-primary font-bold'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                Base Profile
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* 4. Blueprint Display */}
      {activeTab === 'tailored' ? (
        <div className="space-y-6">
          <Card variant="default" padding="lg" className="space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-3">
              <div>
                <div className="text-caption font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  ATS-Optimized Target Headline
                </div>
                <Typography
                  as="h3"
                  variant="h3"
                  color="primary"
                  className="font-bold text-xl mt-1"
                >
                  {blueprint.customHeadline}
                </Typography>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopyText(blueprint.customHeadline, 'headline')}
                leftIcon={
                  copiedSection === 'headline' ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )
                }
              >
                {copiedSection === 'headline' ? 'Copied' : 'Copy'}
              </Button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-caption font-semibold uppercase tracking-wider text-text-muted">
                  Tailored Executive Summary
                </span>
                <button
                  onClick={() => handleCopyText(blueprint.customSummary, 'summary')}
                  className="text-caption text-primary hover:underline flex items-center gap-1 font-medium"
                >
                  {copiedSection === 'summary' ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copiedSection === 'summary' ? 'Copied' : 'Copy Section'}
                </button>
              </div>
              <p className="text-body-md text-text-primary leading-relaxed bg-surface-subtle/60 p-4 rounded-lg border border-border/70">
                {blueprint.customSummary}
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <span className="text-caption font-semibold uppercase tracking-wider text-text-muted">
                Targeted ATS Keywords (Verified from your profile)
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {blueprint.highlightedSkills.map((skill: string) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1 text-caption font-semibold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200"
                  >
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </Card>

          <Card variant="default" padding="lg" className="space-y-6">
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <div>
                <Typography as="h3" variant="h3" color="primary" className="font-bold">
                  Prioritized Work Experience Bullets
                </Typography>
                <p className="text-caption text-text-muted mt-0.5">
                  Bullet points re-ranked based on direct relevance to {selectedJob.title}{' '}
                  at {selectedJob.company}
                </p>
              </div>

              <span className="text-caption px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                {blueprint.prioritizedExperiences.length} Roles Tailored
              </span>
            </div>

            <div className="space-y-6">
              {blueprint.prioritizedExperiences.map(
                ({ experience, highlightedAchievements }) => (
                  <div
                    key={experience.id}
                    className="space-y-2.5 border-b border-border/40 pb-5 last:border-0 last:pb-0"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-text-primary text-body-md">
                          {experience.title}
                        </span>
                        <span className="text-text-muted">·</span>
                        <span className="font-semibold text-text-secondary text-body-md">
                          {experience.company}
                        </span>
                      </div>
                      <span className="text-caption text-text-muted">
                        {experience.startDate} –{' '}
                        {experience.isCurrent ? 'Present' : experience.endDate}
                      </span>
                    </div>

                    <ul className="space-y-2 pl-4 list-disc text-body-sm text-text-primary leading-relaxed marker:text-primary">
                      {highlightedAchievements.map((bullet: string, idx: number) => (
                        <li key={idx} className="hover:text-text-primary">
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              )}
            </div>
          </Card>
        </div>
      ) : (
        <Card variant="default" padding="lg" className="space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              <Typography as="h3" variant="h3" color="primary">
                Canonical Base Profile (Read-Only Foundation)
              </Typography>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/profile')}>
              Edit Canonical Data
            </Button>
          </div>

          <div className="space-y-4 text-body-sm">
            <div>
              <span className="font-semibold text-text-secondary">Full Name:</span>{' '}
              {profile.personalInfo.fullName}
            </div>
            <div>
              <span className="font-semibold text-text-secondary">Headline:</span>{' '}
              {profile.personalInfo.headline}
            </div>
            <div>
              <span className="font-semibold text-text-secondary">Summary:</span>
              <p className="mt-1 text-text-secondary">
                {profile.professionalSummary.summaryText}
              </p>
            </div>
            <div>
              <span className="font-semibold text-text-secondary">Skills:</span>
              <div className="flex gap-1.5 flex-wrap mt-1">
                {profile.skills.technicalSkills.map((s: string) => (
                  <span
                    key={s}
                    className="px-2 py-0.5 rounded bg-surface-subtle text-caption border border-border"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
