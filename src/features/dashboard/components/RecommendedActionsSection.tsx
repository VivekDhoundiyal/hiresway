import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/card';
import { Typography } from '@/components/typography';
import { Badge } from '@/components/badge';
import { RecommendedAction } from '../types';
import {
  Compass,
  ChevronRight,
  UserCheck,
  FileText,
  Building2,
  Briefcase,
} from 'lucide-react';

export interface RecommendedActionsSectionProps {
  actions?: RecommendedAction[];
}

const defaultActions: (RecommendedAction & { icon: React.ElementType })[] = [
  {
    id: 'setup-profile',
    title: 'Complete Career Profile',
    description:
      'Specify target job titles, salary expectations, and location preferences',
    badgeText: 'Recommended',
    badgeVariant: 'primary',
    destinationPath: '/profile',
    icon: UserCheck,
  },
  {
    id: 'setup-resume',
    title: 'Upload Master Resume',
    description:
      'Establish your baseline resume for tailoring across future job opportunities',
    badgeText: 'Setup',
    badgeVariant: 'neutral',
    destinationPath: '/resume-studio',
    icon: FileText,
  },
  {
    id: 'setup-companies',
    title: 'Define Target Companies',
    description:
      'Bookmark high-priority employers and identify relevant department teams',
    badgeText: 'Setup',
    badgeVariant: 'neutral',
    destinationPath: '/target-companies',
    icon: Building2,
  },
  {
    id: 'first-application',
    title: 'Log First Application',
    description: 'Start tracking active opportunities across pipeline stages',
    badgeText: 'Next Step',
    badgeVariant: 'accent',
    destinationPath: '/applications',
    icon: Briefcase,
  },
];

export const RecommendedActionsSection: React.FC<RecommendedActionsSectionProps> = ({
  actions,
}) => {
  const navigate = useNavigate();
  const displayActions = actions || defaultActions;

  return (
    <Card variant="default" padding="lg" className="space-y-5">
      <div className="flex items-center justify-between border-b border-border/70 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-md bg-primary-soft text-primary">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <Typography as="h2" variant="h3" color="primary">
              Recommended Actions
            </Typography>
            <Typography as="p" variant="body-sm" color="muted">
              High-leverage steps to establish your career search operating foundation
            </Typography>
          </div>
        </div>

        <Badge variant="primary" size="sm">
          {displayActions.length} Suggested
        </Badge>
      </div>

      {/* Action Items List */}
      <div className="space-y-2.5">
        {displayActions.map((action) => {
          const actionWithIcon = defaultActions.find((a) => a.id === action.id);
          const Icon = actionWithIcon?.icon || Compass;

          return (
            <div
              key={action.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(action.destinationPath)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(action.destinationPath);
                }
              }}
              className="p-3.5 rounded-lg border border-border bg-surface hover:border-border-strong hover:bg-surface-subtle/60 transition-all duration-fast flex items-center justify-between gap-3 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2 rounded-md bg-surface-subtle text-primary border border-border/50 shrink-0 mt-0.5">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-body-sm font-semibold text-text-primary truncate">
                      {action.title}
                    </span>
                    <Badge variant={action.badgeVariant} size="sm">
                      {action.badgeText}
                    </Badge>
                  </div>
                  <p className="text-caption text-text-muted mt-0.5 line-clamp-1">
                    {action.description}
                  </p>
                </div>
              </div>

              <ChevronRight
                className="h-4 w-4 text-text-muted shrink-0"
                aria-hidden="true"
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
};
