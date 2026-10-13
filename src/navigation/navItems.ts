import {
  LayoutDashboard,
  Rss,
  Database,
  Building2,
  Briefcase,
  FileText,
  Send,
  Clock,
  Calendar,
  Archive,
  TrendingUp,
  User,
  Settings,
} from 'lucide-react';
import { NavItem } from './types';

/**
 * Main navigation sections in the exact requested order:
 * 1. Dashboard
 * 2. Job Feed & News
 * 3. Job Database
 * 4. Target Companies
 * 5. Applications
 * 6. Resume Studio
 * 7. Outreach
 * 8. Follow-ups
 * 9. Interviews
 * 10. Document Vault
 * 11. Growth
 */
export const mainNavItems: NavItem[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
    description: 'High-level overview of career search metrics and activities',
  },
  {
    id: 'job-feed',
    title: 'Job Feed & News',
    path: '/job-feed',
    icon: Rss,
    description: 'Aggregated industry updates and personalized job discoveries',
  },
  {
    id: 'job-database',
    title: 'Job Database',
    path: '/job-database',
    icon: Database,
    description: 'Structured repository of curated opportunities and listings',
  },
  {
    id: 'target-companies',
    title: 'Target Companies',
    path: '/target-companies',
    icon: Building2,
    description: 'Target employer directories, key stakeholders, and company intel',
  },
  {
    id: 'applications',
    title: 'Applications',
    path: '/applications',
    icon: Briefcase,
    description: 'Active job applications pipeline and status tracking',
  },
  {
    id: 'resume-studio',
    title: 'Resume Studio',
    path: '/resume-studio',
    icon: FileText,
    description: 'Resume versions, tailoring workspaces, and document formatting',
  },
  {
    id: 'outreach',
    title: 'Outreach',
    path: '/outreach',
    icon: Send,
    description: 'Networking messages, cold contacts, and communication logs',
  },
  {
    id: 'follow-ups',
    title: 'Follow-ups',
    path: '/follow-ups',
    icon: Clock,
    description: 'Scheduled reminders and communication cadences',
  },
  {
    id: 'interviews',
    title: 'Interviews',
    path: '/interviews',
    icon: Calendar,
    description: 'Interview rounds, preparation briefs, and debrief notes',
  },
  {
    id: 'document-vault',
    title: 'Document Vault',
    path: '/document-vault',
    icon: Archive,
    description: 'Certificates, portfolios, recommendation letters, and transcripts',
  },
  {
    id: 'growth',
    title: 'Growth',
    path: '/growth',
    icon: TrendingUp,
    description: 'Skill development roadmaps, learning goals, and career progression',
  },
];

/**
 * Bottom navigation sections:
 * - Profile
 * - Settings
 */
export const bottomNavItems: NavItem[] = [
  {
    id: 'profile',
    title: 'Profile',
    path: '/profile',
    icon: User,
    description: 'Personal details, career preferences, and identity information',
  },
  {
    id: 'settings',
    title: 'Settings',
    path: '/settings',
    icon: Settings,
    description: 'Platform preferences, theme settings, and application configuration',
  },
];

export const allNavItems: NavItem[] = [...mainNavItems, ...bottomNavItems];
