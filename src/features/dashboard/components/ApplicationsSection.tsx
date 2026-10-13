import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/card';
import { Typography } from '@/components/typography';
import { Badge } from '@/components/badge';
import { EmptyState } from '@/components/empty-state';
import { ApplicationSummaryItem } from '../types';
import { Briefcase, ArrowUpRight } from 'lucide-react';

export interface ApplicationsSectionProps {
  applications?: ApplicationSummaryItem[];
}

export const ApplicationsSection: React.FC<ApplicationsSectionProps> = ({
  applications = [],
}) => {
  const navigate = useNavigate();
  const hasApplications = applications.length > 0;

  return (
    <Card variant="default" padding="lg" className="space-y-5">
      <div className="flex items-center justify-between border-b border-border/70 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-md bg-primary-soft text-primary">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <Typography as="h2" variant="h3" color="primary">
              Applications
            </Typography>
            <Typography as="p" variant="body-sm" color="muted">
              Active pipeline stages and interview statuses
            </Typography>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="neutral" size="sm">
            {applications.length} Active
          </Badge>
          <button
            type="button"
            onClick={() => navigate('/applications')}
            className="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-surface-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="View all applications"
          >
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Conditional Rendering: Empty State or Real Data */}
      {!hasApplications ? (
        <EmptyState
          icon={Briefcase}
          title="No applications tracked yet"
          description="Log and organize your job applications across every stage—from draft to active interview and offer. Your pipeline health and quick stats will appear here."
          action={{
            label: 'Track First Application',
            variant: 'primary',
            onClick: () => navigate('/applications'),
          }}
        />
      ) : (
        <div className="divide-y divide-border">
          {applications.map((app) => (
            <div key={app.id} className="py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-text-primary">{app.role}</p>
                <p className="text-caption text-text-muted">
                  {app.company} • Applied {app.appliedDate}
                </p>
              </div>
              <Badge variant="primary" size="sm">
                {app.stage}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
