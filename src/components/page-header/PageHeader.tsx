import React from 'react';
import { Typography } from '@/components/typography';

export interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  badge,
  actions,
  breadcrumbs,
  className = '',
}) => {
  return (
    <div className={`space-y-3 pb-5 border-b border-border/80 ${className}`}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-caption text-text-muted"
        >
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.label}>
              {idx > 0 && <span>/</span>}
              <span
                className={
                  idx === breadcrumbs.length - 1 ? 'font-medium text-text-primary' : ''
                }
              >
                {crumb.label}
              </span>
            </React.Fragment>
          ))}
        </nav>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <Typography
              as="h1"
              variant="h2"
              color="primary"
              className="text-2xl sm:text-3xl font-bold tracking-tight"
            >
              {title}
            </Typography>
            {badge && <div className="inline-flex shrink-0">{badge}</div>}
          </div>

          {description && (
            <Typography as="p" variant="body-md" color="secondary" className="max-w-3xl">
              {description}
            </Typography>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2.5 self-start sm:self-center shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};
