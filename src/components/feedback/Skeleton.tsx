import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  className = '',
  style,
  ...rest
}) => {
  const variantStyles = {
    text: 'h-4 w-full rounded-sm',
    circular: 'rounded-full',
    rectangular: 'rounded-md',
  };

  return (
    <div
      className={`animate-pulse bg-slate-200/80 ${variantStyles[variant]} ${className}`}
      style={{
        width,
        height,
        ...style,
      }}
      aria-hidden="true"
      {...rest}
    />
  );
};
