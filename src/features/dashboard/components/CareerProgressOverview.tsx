import React from 'react';
import { Card } from '@/components/card';
import { Typography } from '@/components/typography';
import { CareerProgressMetrics } from '../types';
import { jobRepository } from '@/core/jobs/jobRepository';
import { Briefcase, Calendar, Send, Target, Sparkles, Database } from 'lucide-react';

export interface CareerProgressOverviewProps {
  metrics?: CareerProgressMetrics;
}

export const CareerProgressOverview: React.FC<CareerProgressOverviewProps> = ({
  metrics = {
    activeApplicationsCount: 0,
    interviewsScheduledCount: 0,
    outreachSentCount: 0,
    weeklyTargetCount: 0,
    weeklyTargetGoal: 5,
  },
}) => {
  const dbJobs = jobRepository.getDatabaseOpportunities();
  const verifiedLiveCount = dbJobs.filter(
    (j) => j.verificationStatus === 'verified_live' || j.verificationStatus === 'recently_verified'
  ).length;
  const needsVerificationCount = dbJobs.filter(
    (j) =>
      j.verificationStatus === 'needs_verification' ||
      j.verificationStatus === 'imported_needs_verification' ||
      j.verificationStatus === 'unverified'
  ).length;

  const progressPercent = Math.min(
    100,
    Math.round((metrics.weeklyTargetCount / (metrics.weeklyTargetGoal || 1)) * 100)
  );

  const metricCards = [
    {
      id: 'applications',
      label: 'Active Applications',
      value: metrics.activeApplicationsCount,
      icon: Briefcase,
      helper: 'Pipeline active',
    },
    {
      id: 'interviews',
      label: 'Scheduled Interviews',
      value: metrics.interviewsScheduledCount,
      icon: Calendar,
      helper: 'Upcoming meetings',
    },
    {
      id: 'outreach',
      label: 'Outreach Contacts',
      value: metrics.outreachSentCount,
      icon: Send,
      helper: 'Sent conversations',
    },
    {
      id: 'target',
      label: 'Weekly Goal',
      value: `${metrics.weeklyTargetCount}/${metrics.weeklyTargetGoal}`,
      icon: Target,
      helper: `${progressPercent}% completed`,
    },
  ];

  return (
    <Card variant="default" padding="lg" className="space-y-6">
      {/* Overview Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/70 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-md bg-primary-soft text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <Typography as="h2" variant="h3" color="primary">
              Career Progress Overview
            </Typography>
            <Typography as="p" variant="body-sm" color="muted">
              Live momentum metrics across your current search cycle
            </Typography>
          </div>
        </div>

        <div className="flex items-center gap-2 text-caption px-3 py-1.5 rounded-lg bg-surface-subtle border border-border text-text-secondary flex-wrap">
          <Database className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold text-text-primary">Database:</span>
          <span>{dbJobs.length} Saved Opportunities</span>
          <span>•</span>
          <span className="text-emerald-700 dark:text-emerald-400 font-medium">
            ✓ {verifiedLiveCount} Verified Live
          </span>
          {needsVerificationCount > 0 && (
            <>
              <span>•</span>
              <span className="text-amber-700 dark:text-amber-400 font-medium">
                ⚠ {needsVerificationCount} Require Verification
              </span>
            </>
          )}
        </div>
      </div>

      {/* 4 Clean Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              className="p-4 rounded-lg bg-surface border border-border flex flex-col justify-between transition-colors hover:border-border-strong"
            >
              <div className="flex items-center justify-between text-text-muted mb-2">
                <span className="text-caption font-medium text-text-secondary uppercase tracking-wider">
                  {card.label}
                </span>
                <Icon className="h-4 w-4 text-text-muted" aria-hidden="true" />
              </div>
              <div>
                <span className="text-3xl font-bold text-text-primary tracking-tight">
                  {card.value}
                </span>
                <span className="block text-caption text-text-muted mt-1">
                  {card.helper}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Goal Progress Bar & Empty-State Guidance */}
      <div className="p-4 rounded-lg bg-surface-subtle border border-border/60 space-y-2">
        <div className="flex items-center justify-between text-body-sm">
          <span className="font-medium text-text-primary">Weekly Search Cadence</span>
          <span className="text-text-muted font-medium">
            {metrics.weeklyTargetCount} of {metrics.weeklyTargetGoal} activities logged (
            {progressPercent}%)
          </span>
        </div>

        {/* Progress Track */}
        <div className="w-full h-2 rounded-full bg-border overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-normal ease-out"
            style={{ width: `${progressPercent}%` }}
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>

        <p className="text-caption text-text-muted pt-0.5">
          {progressPercent === 0
            ? 'No activities recorded yet this week. Complete an application, send outreach, or set up targets to build momentum.'
            : 'Great momentum! Keep consistent to reach your weekly search goal.'}
        </p>
      </div>
    </Card>
  );
};
