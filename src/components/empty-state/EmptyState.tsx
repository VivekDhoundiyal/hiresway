import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Typography } from '@/components/typography';
import { Button, ButtonVariant } from '@/components/button';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick?: () => void;
    variant?: ButtonVariant;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 sm:p-10 rounded-lg border border-dashed border-border bg-surface-subtle/40 ${className}`}
    >
      {/* Icon Pill */}
      <div className="h-12 w-12 rounded-full bg-surface border border-border flex items-center justify-center text-text-muted mb-4 shadow-sm">
        <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
      </div>

      {/* Text Hierarchy */}
      <Typography
        as="h3"
        variant="h3"
        color="primary"
        className="text-base sm:text-lg font-semibold"
      >
        {title}
      </Typography>

      <Typography
        as="p"
        variant="body-sm"
        color="secondary"
        className="max-w-md mt-1.5 mb-5 text-text-muted leading-relaxed"
      >
        {description}
      </Typography>

      {/* Optional Action Button */}
      {action && (
        <Button variant={action.variant || 'outline'} size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
};
