import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '@/core/profile';
import {
  analyzeJobMatch,
  jobRepository,
  opportunityToJobPosting,
} from '@/core/intelligence';
import { applicationEngine } from '@/core/applications';
import { Card } from '@/components/card';
import { Typography } from '@/components/typography';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Modal } from '@/components/modal';
import { CompanyLogo } from '@/components/company-logo';
import { Briefcase, Calendar, Plus, FileText, Send } from 'lucide-react';

export type ApplicationStage =
  | 'saved'
  | 'applied'
  | 'screening'
  | 'interviewing'
  | 'offer'
  | 'rejected';

export interface ApplicationItem {
  id: string;
  jobId: string;
  roleTitle: string;
  company: string;
  location: string;
  salary: string;
  stage: ApplicationStage;
  appliedDate: string;
  lastUpdated: string;
  nextStep: string;
  matchScore: number;
}

const STAGES: { id: ApplicationStage; label: string; color: string }[] = [
  { id: 'saved', label: 'Saved / Target', color: 'border-slate-300' },
  { id: 'applied', label: 'Applied', color: 'border-blue-400' },
  { id: 'screening', label: 'Recruiter Screen', color: 'border-indigo-400' },
  { id: 'interviewing', label: 'Interviewing', color: 'border-amber-400' },
  { id: 'offer', label: 'Offer Received', color: 'border-emerald-500' },
];

export const ApplicationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useProfile();

  const availableJobs = useMemo(() => {
    const opps = [
      ...jobRepository.getDatabaseOpportunities(),
      ...jobRepository.getActiveOpportunities(),
    ];
    return opps.map(opportunityToJobPosting);
  }, []);

  // Persisted Applications connected to canonical applicationEngine
  const [applications, setApplications] = useState<ApplicationItem[]>(() => {
    return applicationEngine.getApplicationsSync();
  });

  // Subscribe to canonical applicationEngine updates
  useEffect(() => {
    const unsubscribe = applicationEngine.subscribe((apps) => {
      if (apps.length > 0) {
        setApplications(apps);
      }
    });
    return unsubscribe;
  }, []);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCatalogJobId, setSelectedCatalogJobId] = useState(
    availableJobs[0]?.id || ''
  );

  const handleMoveStage = async (appId: string, direction: 'forward' | 'backward') => {
    const app = applications.find((a) => a.id === appId);
    if (!app) return;
    const currentIndex = STAGES.findIndex((s) => s.id === app.stage);
    const nextIndex = direction === 'forward' ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex >= 0 && nextIndex < STAGES.length) {
      await applicationEngine.updateStage(appId, STAGES[nextIndex].id);
    }
  };

  const handleAddApplication = async () => {
    const catJob = availableJobs.find((j) => j.id === selectedCatalogJobId);

    if (catJob) {
      const match = analyzeJobMatch(profile, catJob);
      const salaryDisplay =
        catJob.salaryMin && catJob.salaryMax
          ? `${catJob.currency || '$'}${Math.round(catJob.salaryMin / 1000)}k - ${catJob.currency || '$'}${Math.round(catJob.salaryMax / 1000)}k`
          : 'Competitive';
      await applicationEngine.createApplication({
        jobId: catJob.id,
        roleTitle: catJob.title,
        company: catJob.company,
        location: catJob.location,
        salary: salaryDisplay,
        stage: 'saved',
        appliedDate: new Date().toISOString().split('T')[0],
        nextStep: 'Tailor resume and prepare outreach',
        matchScore: match.overallScore,
      });
    } else {
      await applicationEngine.createApplication({
        jobId: '',
        roleTitle: 'Target Role',
        company: 'Target Employer',
        location: 'Remote',
        salary: 'Competitive',
        stage: 'saved',
        appliedDate: new Date().toISOString().split('T')[0],
        nextStep: 'Initial preparation',
        matchScore: 80,
      });
    }

    setIsAddModalOpen(false);
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
                Applications Pipeline
              </Typography>
              <Badge variant="primary" size="sm">
                Active Career Funnel
              </Badge>
            </div>
            <Typography as="p" variant="body-md" color="secondary" className="mt-1">
              Track candidate pipeline velocity with linked resume blueprints, outreach
              notes, and interview prep.
            </Typography>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/job-feed')}
              leftIcon={<Briefcase className="h-4 w-4" />}
            >
              Explore Job Feed
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Track New Application
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Pipeline Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card variant="subtle" padding="sm" className="space-y-0.5">
          <div className="text-caption text-text-muted">Total Opportunities</div>
          <div className="text-2xl font-bold text-text-primary">
            {applications.length}
          </div>
          <div className="text-[11px] text-text-secondary">Across all active stages</div>
        </Card>
        <Card variant="subtle" padding="sm" className="space-y-0.5">
          <div className="text-caption text-text-muted">Active In Review</div>
          <div className="text-2xl font-bold text-blue-600">
            {
              applications.filter((a) => a.stage === 'applied' || a.stage === 'screening')
                .length
            }
          </div>
          <div className="text-[11px] text-text-secondary">Awaiting feedback</div>
        </Card>
        <Card variant="subtle" padding="sm" className="space-y-0.5">
          <div className="text-caption text-text-muted">In Interviews</div>
          <div className="text-2xl font-bold text-amber-600">
            {applications.filter((a) => a.stage === 'interviewing').length}
          </div>
          <div className="text-[11px] text-text-secondary">
            Active conversation rounds
          </div>
        </Card>
        <Card variant="subtle" padding="sm" className="space-y-0.5">
          <div className="text-caption text-text-muted">Offers / Closes</div>
          <div className="text-2xl font-bold text-emerald-600">
            {applications.filter((a) => a.stage === 'offer').length}
          </div>
          <div className="text-[11px] text-text-secondary">Ready for negotiation</div>
        </Card>
      </div>

      {/* 3. Kanban Stage Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start">
        {STAGES.map((stage) => {
          const stageApps = applications.filter((a) => a.stage === stage.id);
          return (
            <div key={stage.id} className="space-y-3">
              {/* Column Header */}
              <div className="flex items-center justify-between px-1 pb-1 border-b-2 border-primary/20">
                <span className="font-bold text-body-sm text-text-primary">
                  {stage.label}
                </span>
                <span className="text-caption px-2 py-0.5 rounded-full bg-surface text-text-secondary border border-border font-semibold">
                  {stageApps.length}
                </span>
              </div>

              {/* Cards in Column */}
              <div className="space-y-3 min-h-[300px] bg-surface-subtle/40 rounded-xl p-2 border border-border/50">
                {stageApps.length === 0 ? (
                  <div className="text-center py-8 text-caption text-text-muted">
                    No active roles
                  </div>
                ) : (
                  stageApps.map((app) => (
                    <Card
                      key={app.id}
                      variant="default"
                      padding="sm"
                      className="space-y-3 hover:border-border-strong hover:shadow-xs transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="font-semibold text-body-sm text-text-primary leading-tight">
                            {app.roleTitle}
                          </h4>
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                            {app.matchScore}%
                          </span>
                        </div>
                        <div className="text-caption text-text-secondary flex items-center gap-1.5 mt-0.5">
                          <CompanyLogo company={app.company} size="xs" />
                          <span className="font-medium text-text-primary">{app.company}</span>
                        </div>
                        <div className="text-[11px] text-text-muted">{app.salary}</div>
                      </div>

                      {/* Next Step Box */}
                      <div className="p-2 rounded bg-surface-subtle text-[11px] text-text-secondary border border-border/60">
                        <span className="font-semibold text-text-primary">Next:</span>{' '}
                        {app.nextStep}
                      </div>

                      {/* Quick Actions */}
                      <div className="pt-2 border-t border-border/50 flex items-center justify-between text-caption">
                        <div className="flex items-center gap-1">
                          {app.jobId && (
                            <>
                              <button
                                onClick={() =>
                                  navigate(`/resume-studio?jobId=${app.jobId}`)
                                }
                                className="p-1 rounded text-text-muted hover:text-primary hover:bg-primary-soft"
                                title="Tailor Resume"
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => navigate(`/outreach?jobId=${app.jobId}`)}
                                className="p-1 rounded text-text-muted hover:text-primary hover:bg-primary-soft"
                                title="Draft Outreach"
                              >
                                <Send className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => navigate(`/interviews?jobId=${app.jobId}`)}
                                className="p-1 rounded text-text-muted hover:text-primary hover:bg-primary-soft"
                                title="Prep Interview"
                              >
                                <Calendar className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>

                        {/* Stage Progress Arrows */}
                        <div className="flex items-center gap-1">
                          {stage.id !== 'saved' && (
                            <button
                              onClick={() => handleMoveStage(app.id, 'backward')}
                              className="text-[11px] px-1.5 py-0.5 rounded bg-surface hover:bg-surface-subtle border border-border text-text-muted"
                              title="Move back"
                            >
                              ←
                            </button>
                          )}
                          {stage.id !== 'offer' && (
                            <button
                              onClick={() => handleMoveStage(app.id, 'forward')}
                              className="text-[11px] px-1.5 py-0.5 rounded bg-primary-soft hover:bg-blue-100 border border-blue-200 text-primary font-bold"
                              title="Advance stage"
                            >
                              →
                            </button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Add Application Modal */}
      {isAddModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsAddModalOpen(false)}
          title="Track Opportunity in Applications Pipeline"
          size="md"
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-caption font-semibold text-text-secondary">
                Select Opportunity from CareerOs Catalog
              </label>
              <select
                value={selectedCatalogJobId}
                onChange={(e) => setSelectedCatalogJobId(e.target.value)}
                aria-label="Select Opportunity from Catalog"
                className="w-full h-9 rounded-md bg-surface text-body-sm text-text-primary border border-border px-3 font-medium focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {availableJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title} · {j.company}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleAddApplication}>
                Add to Pipeline
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
