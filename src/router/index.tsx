import React, { lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/layout';
import { allNavItems } from '@/navigation';

// Lazy-loaded routes for rapid sub-millisecond initial bundle loading
const DashboardPage = lazy(() => import('@/features/dashboard').then((m) => ({ default: m.DashboardPage })));
const ProfilePage = lazy(() => import('@/features/profile').then((m) => ({ default: m.ProfilePage })));
const JobFeedPage = lazy(() => import('@/features/job-feed').then((m) => ({ default: m.JobFeedPage })));
const JobDatabasePage = lazy(() => import('@/features/job-database').then((m) => ({ default: m.JobDatabasePage })));
const TargetCompaniesPage = lazy(() => import('@/features/target-companies').then((m) => ({ default: m.TargetCompaniesPage })));
const ApplicationsPage = lazy(() => import('@/features/applications').then((m) => ({ default: m.ApplicationsPage })));
const ResumeStudioPage = lazy(() => import('@/features/resume-studio').then((m) => ({ default: m.ResumeStudioPage })));
const OutreachPage = lazy(() => import('@/features/outreach').then((m) => ({ default: m.OutreachPage })));
const InterviewsPage = lazy(() => import('@/features/interviews').then((m) => ({ default: m.InterviewsPage })));
const GrowthPage = lazy(() => import('@/features/growth').then((m) => ({ default: m.GrowthPage })));
const PlaceholderPage = lazy(() => import('@/pages/PlaceholderPage').then((m) => ({ default: m.PlaceholderPage })));


const implementedRouteIds = new Set([
  'dashboard',
  'profile',
  'job-feed',
  'job-database',
  'target-companies',
  'applications',
  'resume-studio',
  'outreach',
  'interviews',
  'growth',
]);

export const AppRouter: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          {/* Default Redirect to Dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Core Hubs */}
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />

          {/* Career Intelligence Downstream Modules */}
          <Route path="/job-feed" element={<JobFeedPage />} />
          <Route path="/diagnostics" element={<Navigate to="/job-feed?diagnostics=open" replace />} />
          <Route path="/job-database" element={<JobDatabasePage />} />
          <Route path="/target-companies" element={<TargetCompaniesPage />} />
          <Route path="/applications" element={<ApplicationsPage />} />
          <Route path="/resume-studio" element={<ResumeStudioPage />} />
          <Route path="/outreach" element={<OutreachPage />} />
          <Route path="/interviews" element={<InterviewsPage />} />
          <Route path="/growth" element={<GrowthPage />} />

          {/* Remaining lightweight Placeholder screens (follow-ups, document-vault, settings) */}
          {allNavItems
            .filter((item) => !implementedRouteIds.has(item.id))
            .map((item) => (
              <Route
                key={item.id}
                path={item.path}
                element={
                  <PlaceholderPage
                    title={item.title}
                    description={item.description}
                    icon={item.icon}
                  />
                }
              />
            ))}

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};
