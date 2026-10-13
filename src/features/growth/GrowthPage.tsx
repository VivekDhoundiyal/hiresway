import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '@/core/profile';
import {
  analyzeGrowthGaps,
  CareerGrowthGap,
  getIntelligenceTier,
} from '@/core/intelligence';
import { Card } from '@/components/card';
import { Typography } from '@/components/typography';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import {
  TrendingUp,
  Sparkles,
  ArrowRight,
  Lightbulb,
  Award,
  Calendar,
} from 'lucide-react';

export const GrowthPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useProfile();

  const tierInfo = useMemo(() => getIntelligenceTier(profile), [profile]);
  const growthData: CareerGrowthGap = useMemo(
    () => analyzeGrowthGaps(profile),
    [profile]
  );

  const targetTitle =
    growthData.targetRole || profile.rolePreferences.targetPrimaryTitle || 'Target Role';
  const currentTitle =
    profile.rolePreferences.currentTitle ||
    profile.personalInfo.headline ||
    'Current Role';

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
                Career Growth & Gap Analysis
              </Typography>
              <Badge variant="primary" size="sm" icon={<Sparkles className="h-3 w-3" />}>
                Trajectory Intelligence
              </Badge>
            </div>
            <Typography as="p" variant="body-md" color="secondary" className="mt-1">
              Benchmark your canonical profile against market requirements for your next
              target career tier.
            </Typography>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/profile#skills')}
            leftIcon={<Award className="h-4 w-4" />}
          >
            Update Profile Skills
          </Button>
        </div>
      </div>

      {/* 2. Trajectory Progression Banner */}
      <Card
        variant="default"
        padding="lg"
        className="bg-gradient-to-r from-surface via-surface to-blue-50/40 border-blue-200/60 shadow-xs space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary text-white shadow-sm shrink-0">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <div className="text-caption font-semibold uppercase tracking-wider text-primary">
                Career Trajectory Vector
              </div>
              <div className="flex items-center gap-2 font-bold text-lg text-text-primary mt-0.5 flex-wrap">
                <span>{currentTitle}</span>
                <ArrowRight className="h-4 w-4 text-text-muted" />
                <span className="text-primary">{targetTitle}</span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-caption text-text-muted">Estimated Market Level:</span>
            <div className="font-bold text-body-md text-text-primary">
              {growthData.currentEstimatedLevel}
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-border/60 grid grid-cols-1 sm:grid-cols-3 gap-3 text-body-sm">
          <div className="p-2.5 rounded-lg bg-surface-subtle border border-border/70">
            <span className="text-caption text-text-muted">Target Readiness Score</span>
            <div className="font-bold text-emerald-700 text-body-md">
              {growthData.benchmarkedReadinessScore}% Calibrated
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-surface-subtle border border-border/70">
            <span className="text-caption text-text-muted">
              Profile Intelligence Tier
            </span>
            <div className="font-bold text-primary text-body-md">{tierInfo.tierName}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-surface-subtle border border-border/70">
            <span className="text-caption text-text-muted">Target Compensation</span>
            <div className="font-bold text-text-primary text-body-md">
              {profile.compensation.targetBaseSalary > 0
                ? `$${profile.compensation.targetBaseSalary.toLocaleString()}/yr`
                : 'Competitive'}
            </div>
          </div>
        </div>
      </Card>

      {/* 3. High Demand Skill Priorities */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Typography as="h2" variant="h3" color="primary" className="font-bold">
              Target Role Skill & Experience Priorities
            </Typography>
            <p className="text-caption text-text-muted mt-0.5">
              High-demand competencies that unlock higher match tiers for {targetTitle}{' '}
              positions
            </p>
          </div>

          <span className="text-caption px-2 py-0.5 rounded-full bg-surface-subtle border border-border text-text-secondary font-medium">
            {growthData.missingHighDemandSkills.length} High-Impact Skills
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {growthData.missingHighDemandSkills.map((skill: string, idx: number) => (
            <Card
              key={idx}
              variant="default"
              padding="md"
              className="space-y-2 hover:border-border-strong transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-primary uppercase">
                  Priority Competency
                </span>
                <Badge variant="warning" size="sm">
                  High Demand
                </Badge>
              </div>
              <h3 className="font-bold text-body-md text-text-primary">{skill}</h3>
              <p className="text-caption text-text-secondary">
                Commonly expected in 70%+ of executive & leadership job descriptions in
                your target industry.
              </p>
            </Card>
          ))}
        </div>
      </div>

      {/* 4. Strategic Milestones */}
      <div className="space-y-4">
        <Typography as="h2" variant="h3" color="primary" className="font-bold">
          Recommended Strategic Milestones
        </Typography>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {growthData.recommendedMilestones.map((m, idx) => (
            <Card key={idx} variant="default" padding="md" className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-caption font-bold text-primary flex items-center gap-1">
                  <Lightbulb className="h-3.5 w-3.5" />
                  Milestone #{idx + 1}
                </span>
                <Badge variant={m.impact === 'high' ? 'primary' : 'neutral'} size="sm">
                  {m.impact.toUpperCase()} IMPACT
                </Badge>
              </div>
              <h3 className="font-bold text-body-md text-text-primary">{m.title}</h3>
              <p className="text-body-sm text-text-secondary">{m.description}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* 5. 30-60-90 Day Roadmap */}
      <Card variant="default" padding="lg" className="space-y-5">
        <div className="flex items-center gap-2 border-b border-border/70 pb-3">
          <Calendar className="h-5 w-5 text-primary" />
          <div>
            <Typography as="h3" variant="h3" color="primary" className="font-semibold">
              30-60-90 Day Strategic Career Roadmap
            </Typography>
            <span className="text-caption text-text-muted">
              Structured progression to achieve your target milestone
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-surface-subtle border border-border/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-caption font-bold text-primary uppercase">
                Day 1 - 30
              </span>
              <span className="text-[11px] font-semibold text-text-muted">
                Foundation
              </span>
            </div>
            <h4 className="font-bold text-body-md text-text-primary">
              Profile Calibration
            </h4>
            <ul className="space-y-1.5 text-caption text-text-secondary list-disc pl-4 marker:text-primary">
              <li>
                Document 3 quantified achievements with clear revenue or metric impact
              </li>
              <li>Establish active target company wishlist in Profile Target Markets</li>
              <li>Complete ATS resume tailoring for top 5 excellent-fit jobs</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-surface-subtle border border-border/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-caption font-bold text-indigo-600 uppercase">
                Day 31 - 60
              </span>
              <span className="text-[11px] font-semibold text-text-muted">
                Acceleration
              </span>
            </div>
            <h4 className="font-bold text-body-md text-text-primary">
              Outreach & Networking
            </h4>
            <ul className="space-y-1.5 text-caption text-text-secondary list-disc pl-4 marker:text-indigo-600">
              <li>Initiate 10 personalized outreach messages per week to leaders</li>
              <li>Practice STAR story delivery using mapped interview briefs</li>
              <li>Benchmark early recruiter feedback against salary expectations</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-surface-subtle border border-border/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-caption font-bold text-emerald-600 uppercase">
                Day 61 - 90
              </span>
              <span className="text-[11px] font-semibold text-text-muted">
                Conversion
              </span>
            </div>
            <h4 className="font-bold text-body-md text-text-primary">
              Offer Negotiation
            </h4>
            <ul className="space-y-1.5 text-caption text-text-secondary list-disc pl-4 marker:text-emerald-600">
              <li>Convert active interview pipelines into formal offers</li>
              <li>Calibrate multiple offers against target base & total compensation</li>
              <li>Lock in target career trajectory milestone transition</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
};
