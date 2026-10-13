import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/card';
import { Typography } from '@/components/typography';
import { Badge } from '@/components/badge';
import { EmptyState } from '@/components/empty-state';
import { FollowUpItem } from '../types';
import { Clock, ArrowUpRight } from 'lucide-react';

export interface FollowUpsSectionProps {
  followUps?: FollowUpItem[];
}

export const FollowUpsSection: React.FC<FollowUpsSectionProps> = ({ followUps = [] }) => {
  const navigate = useNavigate();
  const hasFollowUps = followUps.length > 0;

  return (
    <Card variant="default" padding="lg" className="space-y-5">
      <div className="flex items-center justify-between border-b border-border/70 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-md bg-primary-soft text-primary">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <Typography as="h2" variant="h3" color="primary">
              Upcoming Follow-ups
            </Typography>
            <Typography as="p" variant="body-sm" color="muted">
              Scheduled check-ins and action deadlines
            </Typography>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={hasFollowUps ? 'warning' : 'neutral'} size="sm">
            {followUps.length} Pending
          </Badge>
          <button
            type="button"
            onClick={() => navigate('/follow-ups')}
            className="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-surface-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="View all follow-ups"
          >
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!hasFollowUps ? (
        <EmptyState
          icon={Clock}
          title="All caught up"
          description="No follow-up reminders due. When you connect with contacts or complete interview stages, scheduled follow-up cadences will appear here."
          action={{
            label: 'Schedule Follow-up',
            variant: 'outline',
            onClick: () => navigate('/follow-ups'),
          }}
        />
      ) : (
        <div className="divide-y divide-border">
          {followUps.map((item) => (
            <div key={item.id} className="py-3 flex items-start justify-between">
              <div>
                <p className="font-medium text-text-primary">{item.contactName}</p>
                <p className="text-caption text-text-muted">
                  {item.companyName} • Due {item.dueDate}
                </p>
              </div>
              <Badge variant={item.status === 'overdue' ? 'error' : 'neutral'} size="sm">
                {item.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
