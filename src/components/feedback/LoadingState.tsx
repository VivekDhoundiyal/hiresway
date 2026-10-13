import React from 'react';
import { Typography } from '@/components/typography';

export interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  fullHeight?: boolean;
  className?: string;
}

const spinnerSizes = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-3',
};

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  size = 'md',
  fullHeight = false,
  className = '',
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`
        flex flex-col items-center justify-center gap-3 p-6 text-center select-none font-sans
        ${fullHeight ? 'min-h-[240px] h-full' : ''}
        ${className}
      `}
    >
      <div
        className={`
          animate-spin rounded-full border-primary border-t-transparent
          ${spinnerSizes[size]}
        `}
      />
      {message && (
        <Typography as="p" variant="body-sm" color="muted">
          {message}
        </Typography>
      )}
      <span className="sr-only">{message}</span>
    </div>
  );
};
