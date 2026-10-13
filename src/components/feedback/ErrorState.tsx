import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Typography } from '@/components/typography';
import { Button } from '@/components/button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  variant?: 'card' | 'inline';
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'An unexpected error occurred while loading this section. Please try again.',
  onRetry,
  retryLabel = 'Try Again',
  variant = 'card',
  className = '',
}) => {
  if (variant === 'inline') {
    return (
      <div
        role="alert"
        className={`flex items-center justify-between gap-3 p-3 rounded-md bg-error-soft border border-red-200 text-error text-body-sm ${className}`}
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{message}</span>
        </div>
        {onRetry && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRetry}
            className="text-error hover:bg-red-100"
          >
            {retryLabel}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center text-center p-8 sm:p-10 rounded-lg border border-red-200/80 bg-error-soft/40 font-sans ${className}`}
    >
      <div className="h-12 w-12 rounded-full bg-white border border-red-200 flex items-center justify-center text-error mb-3.5 shadow-sm">
        <AlertCircle className="h-6 w-6" aria-hidden="true" />
      </div>

      <Typography
        as="h3"
        variant="h3"
        color="error"
        className="text-base sm:text-lg font-semibold"
      >
        {title}
      </Typography>

      <Typography
        as="p"
        variant="body-sm"
        color="secondary"
        className="max-w-md mt-1 mb-5 text-text-muted leading-relaxed"
      >
        {message}
      </Typography>

      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          leftIcon={<RotateCcw className="h-4 w-4" />}
          onClick={onRetry}
          className="border-red-200 text-error hover:bg-white active:bg-red-50"
        >
          {retryLabel}
        </Button>
      )}
    </div>
  );
};
