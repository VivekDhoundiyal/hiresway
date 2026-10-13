import React from 'react';
import { Card } from '@/components/card';
import { Typography } from '@/components/typography';
import { Badge } from '@/components/badge';
import { EmptyState } from '@/components/empty-state';
import { ActivityItem } from '../types';
import { Activity } from 'lucide-react';

export interface ActivitySectionProps {
  activities?: ActivityItem[];
  onLogActivity?: () => void;
}

export const ActivitySection: React.FC<ActivitySectionProps> = ({
  activities = [],
  onLogActivity,
}) => {
  const hasActivities = activities.length > 0;

  return (
    <Card variant="default" padding="lg" className="space-y-5">
      <div className="flex items-center justify-between border-b border-border/70 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-md bg-primary-soft text-primary">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <Typography as="h2" variant="h3" color="primary">
              Job Search Activity
            </Typography>
            <Typography as="p" variant="body-sm" color="muted">
              Chronological log of outreach, applications, and milestone updates
            </Typography>
          </div>
        </div>

        <Badge variant="neutral" size="sm">
          {activities.length} Events
        </Badge>
      </div>

      {!hasActivities ? (
        <EmptyState
          icon={Activity}
          title="No recent activity recorded"
          description="Your timeline is quiet. As you submit applications, schedule interviews, and log recruiter outreach messages, your activity stream will update here in real time."
          action={{
            label: 'Log Activity',
            variant: 'outline',
            onClick: onLogActivity,
          }}
        />
      ) : (
        <div className="divide-y divide-border">
          {activities.map((item) => (
            <div key={item.id} className="py-3 flex items-start justify-between">
              <div>
                <p className="font-medium text-text-primary">{item.title}</p>
                <p className="text-caption text-text-muted">{item.subtitle}</p>
              </div>
              <span className="text-caption text-text-muted">{item.timestamp}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
