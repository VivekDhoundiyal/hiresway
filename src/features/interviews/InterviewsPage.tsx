import React, { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useProfile } from '@/core/profile';
import {
  generateInterviewBrief,
  InterviewBrief,
  JobPosting,
  jobRepository,
  opportunityToJobPosting,
  createTargetJobFromProfile,
} from '@/core/intelligence';
import { Card } from '@/components/card';
import { Typography } from '@/components/typography';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import {
  Sparkles,
  Building2,
  HelpCircle,
  Award,
  FileText,
  Clock,
  BookOpen,
  MessageSquare,
  Save,
} from 'lucide-react';

import { interviewPrepEngine } from '@/core/interviews';

export const InterviewsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useProfile();

  const queryJobId = searchParams.get('jobId');

  const availableJobs: JobPosting[] = useMemo(() => {
    const opps = [
      ...jobRepository.getSavedOpportunities(),
      ...jobRepository.getActiveOpportunities(),
    ];
    return opps.map(opportunityToJobPosting);
  }, []);

  const fallbackJob: JobPosting = useMemo(
    () => createTargetJobFromProfile(profile),
    [profile]
  );

  const [selectedJobId, setSelectedJobId] = useState<string>(
    queryJobId || (availableJobs.length > 0 ? availableJobs[0].id : 'profile-target-role')
  );

  const [notes, setNotes] = useState<string>('');
  const [isSavedNotice, setIsSavedNotice] = useState(false);

  const selectedJob = useMemo(() => {
    return availableJobs.find((j) => j.id === selectedJobId) || availableJobs[0] || fallbackJob;
  }, [availableJobs, selectedJobId, fallbackJob]);

  const brief: InterviewBrief = useMemo(() => {
    return generateInterviewBrief(profile, selectedJob);
  }, [profile, selectedJob]);

  // Hydrate saved notes for current job if present
  React.useEffect(() => {
    const existing = interviewPrepEngine.getSessionsSync().find((s) => s.jobId === selectedJobId);
    if (existing) {
      setNotes(existing.notes || '');
    } else {
      setNotes('');
    }
  }, [selectedJobId]);

  const handleSaveNotes = async () => {
    await interviewPrepEngine.saveSession({
      jobId: selectedJob.id,
      roleTitle: selectedJob.title,
      company: selectedJob.company,
      briefData: brief,
      notes: notes,
    });
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 2500);
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
                Interview Intelligence & STAR Briefs
              </Typography>
              <Badge variant="primary" size="sm" icon={<Sparkles className="h-3 w-3" />}>
                Profile Story Mapping
              </Badge>
            </div>
            <Typography as="p" variant="body-md" color="secondary" className="mt-1">
              Role-specific behavioral prep mapping anticipated recruiter questions
              directly to your genuine profile milestones.
            </Typography>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/resume-studio?jobId=${selectedJob.id}`)}
              leftIcon={<FileText className="h-4 w-4" />}
            >
              Resume Blueprint
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveNotes}
              leftIcon={<Save className="h-4 w-4" />}
            >
              {isSavedNotice ? 'Notes Saved!' : 'Save Practice Notes'}
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Job Selection Bar */}
      <Card variant="default" padding="sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            <Building2 className="h-4 w-4 text-text-muted shrink-0" />
            <span className="text-body-sm font-medium text-text-secondary shrink-0">
              Interviewing for:
            </span>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              aria-label="Interviewing for role"
              className="w-full sm:max-w-md h-9 rounded-md bg-surface text-body-sm text-text-primary border border-border px-3 font-medium focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {availableJobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} — {job.company}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-caption text-text-muted">
            <Clock className="h-3.5 w-3.5" />
            <span>Target Stage: Hiring Committee Panel</span>
          </div>
        </div>
      </Card>

      {/* 3. Role Strategic Context */}
      <Card
        variant="default"
        padding="md"
        className="space-y-3 bg-gradient-to-r from-surface to-surface-subtle/60"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <Typography as="h3" variant="body-md" color="primary" className="font-semibold">
            Hiring Team's Target Profile & Core Focus
          </Typography>
        </div>
        <p className="text-body-sm text-text-secondary leading-relaxed">
          Evaluating proven candidates for {brief.jobTitle} at {brief.companyName} with
          direct strengths in execution, pipeline acceleration, and strategic consultative
          alignment.
        </p>
      </Card>

      {/* 4. STAR Stories Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Typography
            as="h2"
            variant="h3"
            color="primary"
            className="font-bold text-lg flex items-center gap-2"
          >
            <Award className="h-5 w-5 text-amber-500" />
            Mapped Profile Stories (STAR Method)
          </Typography>
          <span className="text-caption text-text-muted">
            Synthesized directly from your work experience
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {brief.predictedQuestions.map((q) => (
            <Card
              key={q.id}
              variant="default"
              padding="md"
              className="space-y-3.5 hover:border-border-strong hover:shadow-xs transition-all"
            >
              <div className="border-b border-border/70 pb-2.5">
                <span className="text-[11px] font-bold text-primary uppercase tracking-wider capitalize">
                  {q.category} Question
                </span>
                <h4 className="text-body-md font-bold text-text-primary mt-0.5">
                  {q.question}
                </h4>
                <div className="text-caption text-text-muted mt-0.5">
                  Why Asked: {q.whyAsked}
                </div>
              </div>

              {/* S-T-A-R Breakdown */}
              <div className="space-y-2 text-body-sm">
                <div className="p-2 rounded bg-surface-subtle border border-border/60">
                  <span className="font-bold text-blue-700 text-caption">
                    Situation & Context:
                  </span>
                  <p className="text-text-primary text-[13px] mt-0.5">
                    {q.recommendedStory.situation}
                  </p>
                </div>

                <div className="p-2 rounded bg-surface-subtle border border-border/60">
                  <span className="font-bold text-indigo-700 text-caption">
                    Action from Profile:
                  </span>
                  <p className="text-text-primary text-[13px] mt-0.5">
                    {q.recommendedStory.actionFromProfile}
                  </p>
                </div>

                <div className="p-2 rounded bg-emerald-50 border border-emerald-200">
                  <span className="font-bold text-emerald-800 text-caption">
                    Quantified Result:
                  </span>
                  <p className="text-emerald-950 font-medium text-[13px] mt-0.5">
                    {q.recommendedStory.achievementQuote}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* 5. Strategic Questions to Ask */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card variant="default" padding="lg" className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border/70 pb-3">
            <MessageSquare className="h-5 w-5 text-emerald-600" />
            <div>
              <Typography
                as="h3"
                variant="body-md"
                color="primary"
                className="font-semibold"
              >
                Strategic Questions to Ask Interviewers
              </Typography>
              <span className="text-caption text-text-muted">
                Stand out with commercial depth
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {brief.strategicQuestionsToAsk.map((q: string, idx: number) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-emerald-50/50 border border-emerald-200/70 flex items-start gap-2.5 text-body-sm"
              >
                <span className="text-emerald-700 font-bold shrink-0">#{idx + 1}</span>
                <span className="text-text-primary font-medium text-[13px]">{q}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Practice Scratchpad */}
        <Card variant="default" padding="lg" className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border/70 pb-3">
            <HelpCircle className="h-5 w-5 text-primary" />
            <div>
              <Typography
                as="h3"
                variant="body-md"
                color="primary"
                className="font-semibold"
              >
                Personal Interview Prep Scratchpad
              </Typography>
              <span className="text-caption text-text-muted">
                Jot down talking points and interviewer notes
              </span>
            </div>
          </div>

          <textarea
            rows={8}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Jot down notes on key talking points, interviewer names, or metrics to remember..."
            className="w-full rounded-md bg-surface text-body-sm text-text-primary p-3 border border-border focus:outline-none focus:ring-1 focus:ring-primary resize-y"
          />
        </Card>
      </div>
    </div>
  );
};
