import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LucideIcon,
  ArrowLeft,
  Layers,
  Sparkles,
  Clock,
  CheckCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/card';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Typography } from '@/components/typography';

export interface PlaceholderPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({
  title,
  description,
  icon: Icon,
}) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Unified Page Header */}
      <PageHeader
        title={title}
        description={description}
        badge={
          <Badge variant="primary" size="sm">
            Coming Soon
          </Badge>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            leftIcon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate('/dashboard')}
          >
            Dashboard
          </Button>
        }
      />

      {/* Main Section Content with Consistent Grid Density */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2 Cols: Main Capability Preview Card */}
        <div className="lg:col-span-2 space-y-6">
          <Card variant="default" padding="lg" className="space-y-5">
            <div className="flex items-center gap-3 border-b border-border/70 pb-4">
              <div className="p-2.5 rounded-lg bg-primary-soft text-primary border border-blue-200/60 shadow-sm shrink-0">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <Typography as="h2" variant="h3" color="primary">
                  {title} Workspace
                </Typography>
                <Typography as="p" variant="body-sm" color="muted">
                  Planned capabilities and upcoming workflow tools
                </Typography>
              </div>
            </div>

            <Typography
              as="p"
              variant="body-md"
              color="secondary"
              className="leading-relaxed"
            >
              We are actively developing the {title} module as part of the CareerOs
              personal operating system. This area will centralize your{' '}
              {title.toLowerCase()} data, providing focused tools to organize, track, and
              accelerate your job search outcomes.
            </Typography>

            {/* 3 Structured Preview Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-lg bg-surface-subtle border border-border/60 space-y-2">
                <div className="flex items-center gap-2 text-text-primary font-semibold text-body-sm">
                  <Layers className="h-4 w-4 text-primary shrink-0" />
                  <span>Dedicated Tools</span>
                </div>
                <p className="text-caption text-text-muted leading-normal">
                  Customized interface designed specifically for {title.toLowerCase()}{' '}
                  operations.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-surface-subtle border border-border/60 space-y-2">
                <div className="flex items-center gap-2 text-text-primary font-semibold text-body-sm">
                  <Sparkles className="h-4 w-4 text-primary shrink-0" />
                  <span>Structured Data</span>
                </div>
                <p className="text-caption text-text-muted leading-normal">
                  Fast filtering, status tracking, and clear visual organization of your
                  records.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-surface-subtle border border-border/60 space-y-2">
                <div className="flex items-center gap-2 text-text-primary font-semibold text-body-sm">
                  <Clock className="h-4 w-4 text-primary shrink-0" />
                  <span>Dashboard Sync</span>
                </div>
                <p className="text-caption text-text-muted leading-normal">
                  Automatic metric rollups into your primary Career Progress overview.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Right 1 Col: Status & Next Steps Card */}
        <div className="space-y-6">
          <Card variant="default" padding="lg" className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <Typography
                as="h3"
                variant="h3"
                color="primary"
                className="text-base font-semibold"
              >
                Workspace Status
              </Typography>
              <Badge variant="neutral" size="sm">
                In Pipeline
              </Badge>
            </div>

            <div className="space-y-3 text-body-sm">
              <div className="flex items-start gap-2.5">
                <CheckCircle className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                <div className="text-caption text-text-secondary">
                  <span className="font-semibold text-text-primary block">
                    Architecture Ready
                  </span>
                  Navigation routes, shell containers, and tokens are locked.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                <div className="text-caption text-text-secondary">
                  <span className="font-semibold text-text-primary block">
                    Responsive Shell
                  </span>
                  Layout adapts cleanly between desktop, tablet, and mobile views.
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-border/70">
              <Button
                variant="primary"
                size="sm"
                fullWidth
                onClick={() => navigate('/dashboard')}
              >
                Return to Dashboard
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
