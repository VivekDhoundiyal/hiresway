/**
 * Dashboard Types
 * Defines the contract for real data integration across all dashboard sections.
 */

export interface CareerProgressMetrics {
  activeApplicationsCount: number;
  interviewsScheduledCount: number;
  outreachSentCount: number;
  weeklyTargetCount: number;
  weeklyTargetGoal: number;
}

export interface ActivityItem {
  id: string;
  type: 'application' | 'interview' | 'outreach' | 'followup' | 'note';
  title: string;
  subtitle: string;
  timestamp: string;
}

export interface FollowUpItem {
  id: string;
  contactName: string;
  companyName: string;
  dueDate: string;
  context: string;
  status: 'pending' | 'completed' | 'overdue';
}

export interface ApplicationSummaryItem {
  id: string;
  company: string;
  role: string;
  stage: 'draft' | 'applied' | 'screening' | 'interview' | 'offer' | 'archived';
  appliedDate: string;
}

export interface RecommendedAction {
  id: string;
  title: string;
  description: string;
  badgeText: string;
  badgeVariant: 'primary' | 'accent' | 'neutral' | 'info';
  destinationPath: string;
}
