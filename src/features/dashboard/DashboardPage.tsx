import React, { useState, useEffect } from 'react';
import { useProfile } from '@/core/profile';
import { applicationEngine, ApplicationRecord } from '@/core/applications';
import { WelcomeHeader } from './components/WelcomeHeader';
import { CareerProgressOverview } from './components/CareerProgressOverview';
import { ApplicationsSection } from './components/ApplicationsSection';
import { ActivitySection } from './components/ActivitySection';
import { FollowUpsSection } from './components/FollowUpsSection';
import { RecommendedActionsSection } from './components/RecommendedActionsSection';

export const DashboardPage: React.FC = () => {
  const { profile } = useProfile();
  const [applications, setApplications] = useState<ApplicationRecord[]>(() =>
    applicationEngine.getApplicationsSync()
  );

  useEffect(() => {
    const unsub = applicationEngine.subscribe((apps) => {
      setApplications(apps);
    });
    return unsub;
  }, []);

  const activeApps = applications.filter((a) => a.stage !== 'rejected');
  const interviewsScheduled = applications.filter(
    (a) => a.stage === 'interviewing' || a.stage === 'screening'
  ).length;

  const summaryApps = applications.slice(0, 5).map((a) => ({
    id: a.id,
    company: a.company,
    role: a.roleTitle,
    stage: a.stage === 'saved' ? ('draft' as const) : a.stage === 'interviewing' ? ('interview' as const) : (a.stage as any),
    appliedDate: a.appliedDate || 'Recent',
  }));

  const metrics = {
    activeApplicationsCount: activeApps.length,
    interviewsScheduledCount: interviewsScheduled,
    outreachSentCount: 0,
    weeklyTargetCount: activeApps.length,
    weeklyTargetGoal: 5,
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn">
      {/* 1. Concise Welcome / Header Area */}
      <WelcomeHeader userName={profile.personalInfo.fullName} />

      {/* 2. Primary Career Progress Overview */}
      <CareerProgressOverview metrics={metrics} />

      {/* 3. Main Dashboard Sections Grid (Responsive) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Applications & Activity */}
        <div className="space-y-6">
          <ApplicationsSection applications={summaryApps} />
          <ActivitySection />
        </div>

        {/* Right Column: Follow-ups & Recommended Actions */}
        <div className="space-y-6">
          <FollowUpsSection />
          <RecommendedActionsSection />
        </div>
      </div>
    </div>
  );
};
