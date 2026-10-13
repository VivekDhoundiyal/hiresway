import React from 'react';

export type BadgeVariant =
  'primary' | 'accent' | 'success' | 'neutral' | 'warning' | 'error' | 'info';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  icon?: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, { container: string; dot: string }> = {
  primary: {
    container: 'bg-primary-soft text-primary border-blue-200/60',
    dot: 'bg-primary',
  },
  accent: {
    container: 'bg-accent-soft text-accent border-green-200/60',
    dot: 'bg-accent',
  },
  success: {
    container: 'bg-accent-soft text-accent border-green-200/60',
    dot: 'bg-accent',
  },
  neutral: {
    container: 'bg-surface-subtle text-text-secondary border-border',
    dot: 'bg-text-muted',
  },
  warning: {
    container: 'bg-warning-soft text-warning border-amber-200/60',
    dot: 'bg-warning',
  },
  error: {
    container: 'bg-error-soft text-error border-red-200/60',
    dot: 'bg-error',
  },
  info: {
    container: 'bg-info-soft text-info border-sky-200/60',
    dot: 'bg-info',
  },
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'text-caption py-0.5 px-2 gap-1 rounded-full',
  md: 'text-body-sm py-1 px-2.5 gap-1.5 rounded-full',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  dot = false,
  icon,
  className = '',
  ...rest
}) => {
  const currentVariant = variantStyles[variant];

  return (
    <span
      className={`
        inline-flex items-center justify-center font-sans font-medium border select-none
        ${currentVariant.container}
        ${sizeStyles[size]}
        ${className}
      `}
      {...rest}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${currentVariant.dot}`}
          aria-hidden="true"
        />
      )}
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
