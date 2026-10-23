import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { applicationEngine } from '@/core/applications';
import { outreachEngine, OutreachRecord } from '@/core/outreach';
import { Card } from '@/components/card';
import { Typography } from '@/components/typography';
import { Button } from '@/components/button';
import { Badge } from '@/components/badge';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  Building2,
  ArrowRight,
} from 'lucide-react';

interface FollowUpItem {
  id: string;
  type: 'application' | 'outreach';
  targetTitle: string;
  company: string;
  contactName?: string;
  dueDate: string;
  status: 'pending' | 'completed' | 'overdue';
  actionNote: string;
}

export const FollowUpsPage: React.FC = () => {
  const navigate = useNavigate();

  const [completedIds, setCompletedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('careeros_completed_followups');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleComplete = (id: string) => {
    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem('careeros_completed_followups', JSON.stringify(Array.from(next)));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Derive follow-ups dynamically from application and outreach pipelines
  const followUps: FollowUpItem[] = useMemo(() => {
    const items: FollowUpItem[] = [];
    const now = Date.now();

    // 1. From Applications Pipeline
    const apps = applicationEngine.getApplicationsSync();
    apps.forEach((app) => {
      if (app.stage === 'applied' || app.stage === 'screening' || app.stage === 'interviewing') {
        const appDate = app.appliedDate ? new Date(app.appliedDate).getTime() : now;
        const due = new Date(appDate + 5 * 86400000); // follow up after 5 days
        const isOverdue = due.getTime() < now;
        items.push({
          id: `fup-app-${app.id}`,
          type: 'application',
          targetTitle: app.roleTitle,
          company: app.company,
          dueDate: due.toISOString().split('T')[0],
          status: isOverdue ? 'overdue' : 'pending',
          actionNote: app.nextStep || 'Check in on application review status',
        });
      }
    });

    // 2. From Outreach Pipeline
    const outreachLogs: OutreachRecord[] = outreachEngine.getRecordsSync();
    outreachLogs.forEach((log) => {
      if (log.status === 'sent') {
        const sentDate = log.sentDate ? new Date(log.sentDate).getTime() : now;
        const due = new Date(sentDate + 3 * 86400000); // follow up after 3 days
        const isOverdue = due.getTime() < now;
        items.push({
          id: `fup-outreach-${log.id}`,
          type: 'outreach',
          targetTitle: log.recipientRole || 'Recruiter / Hiring Lead',
          company: log.company,
          contactName: log.recipientName,
          dueDate: due.toISOString().split('T')[0],
          status: isOverdue ? 'overdue' : 'pending',
          actionNote: `Follow up on outreach: "${log.subjectLine}"`,
        });
      }
    });

    return items;
  }, []);

  const pendingItems = followUps.filter((f) => !completedIds.has(f.id));
  const completedItems = followUps.filter((f) => completedIds.has(f.id));
  const overdueCount = pendingItems.filter((f) => f.status === 'overdue').length;

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
        <div>
          <div className="flex items-center gap-3">
            <Typography as="h1" variant="h2" color="primary" className="text-2xl sm:text-3xl font-bold tracking-tight">
              Follow-ups & Communication Cadence
            </Typography>
            <Badge variant="primary" size="sm" icon={<Clock className="h-3 w-3" />}>
              Active Cadence
            </Badge>
          </div>
          <Typography as="p" variant="body-md" color="secondary" className="mt-1">
            Maintain momentum with hiring teams, recruiters, and referral connections without letting opportunities go cold.
          </Typography>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/outreach')}
            leftIcon={<Send className="h-4 w-4" />}
          >
            Draft Outreach
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/applications')}
            leftIcon={<Building2 className="h-4 w-4" />}
          >
            Applications Pipeline
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card variant="subtle" padding="sm" className="space-y-1">
          <div className="text-caption text-text-muted">Total Pending Follow-ups</div>
          <div className="text-2xl font-bold text-text-primary">{pendingItems.length}</div>
          <div className="text-caption text-text-secondary">Across applications & outreach</div>
        </Card>

        <Card variant="subtle" padding="sm" className="space-y-1">
          <div className="text-caption text-text-muted">Overdue Reminders</div>
          <div className={`text-2xl font-bold ${overdueCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {overdueCount}
          </div>
          <div className="text-caption text-text-secondary">Needs attention today</div>
        </Card>

        <Card variant="subtle" padding="sm" className="space-y-1">
          <div className="text-caption text-text-muted">Completed Touches</div>
          <div className="text-2xl font-bold text-emerald-600">{completedItems.length}</div>
          <div className="text-caption text-text-secondary">Archived touchpoints</div>
        </Card>
      </div>

      {/* Pending Follow-ups List */}
      <div className="space-y-4">
        <Typography as="h2" variant="h3" color="primary">
          Pending Cadences ({pendingItems.length})
        </Typography>

        {pendingItems.length === 0 ? (
          <Card variant="bordered" padding="lg" className="text-center py-12 space-y-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <Typography as="h3" variant="h3" color="primary">
              All Follow-ups Complete
            </Typography>
            <Typography as="p" variant="body-sm" color="secondary" className="max-w-md mx-auto">
              You are completely up to date. As you submit applications or initiate recruiter outreach, timely cadence reminders will appear here automatically.
            </Typography>
          </Card>
        ) : (
          <div className="space-y-3">
            {pendingItems.map((item) => (
              <Card
                key={item.id}
                variant="bordered"
                padding="md"
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-300 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-body-sm font-semibold text-text-primary">
                      {item.company}
                    </span>
                    <span className="text-caption text-text-muted">•</span>
                    <span className="text-caption font-medium text-text-secondary">
                      {item.targetTitle}
                    </span>
                    {item.status === 'overdue' && (
                      <Badge variant="warning" size="sm" icon={<AlertTriangle className="h-3 w-3" />}>
                        Follow-up Due
                      </Badge>
                    )}
                  </div>

                  <p className="text-caption text-text-secondary flex items-center gap-2">
                    <span>Due: <strong>{item.dueDate}</strong></span>
                    {item.contactName && (
                      <>
                        <span>•</span>
                        <span>Contact: <strong>{item.contactName}</strong></span>
                      </>
                    )}
                  </p>

                  <p className="text-caption text-text-muted italic">{item.actionNote}</p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleComplete(item.id)}
                    leftIcon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                  >
                    Mark Done
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate(`/outreach?company=${encodeURIComponent(item.company)}`)}
                    rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
                  >
                    Send Outreach
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Completed Follow-ups */}
      {completedItems.length > 0 && (
        <div className="space-y-3 pt-6 border-t border-border">
          <Typography as="h3" variant="body-md" color="secondary" className="font-semibold">
            Completed Touchpoints ({completedItems.length})
          </Typography>
          <div className="space-y-2 opacity-75">
            {completedItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-lg bg-surface-subtle border border-border text-xs"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="line-through text-text-muted">{item.company} — {item.targetTitle}</span>
                </div>
                <button
                  type="button"
                  onClick={() => toggleComplete(item.id)}
                  className="text-text-muted hover:text-text-primary underline text-[11px]"
                >
                  Reopen
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
