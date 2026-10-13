import React, { forwardRef } from 'react';

export type CardVariant = 'default' | 'subtle' | 'bordered';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';
export type CardRadius = 'sm' | 'md' | 'lg' | 'xl';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  radius?: CardRadius;
  interactive?: boolean;
}

const variantStyles: Record<CardVariant, string> = {
  default: 'bg-surface border border-border shadow-sm',
  subtle: 'bg-surface-subtle border border-border/50',
  bordered: 'bg-surface border border-border-strong shadow-sm',
};

const paddingStyles: Record<CardPadding, string> = {
  none: 'p-0',
  sm: 'p-3 sm:p-4',
  md: 'p-4 sm:p-6',
  lg: 'p-6 sm:p-8',
};

const radiusStyles: Record<CardRadius, string> = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      variant = 'default',
      padding = 'md',
      radius = 'lg',
      interactive = false,
      className = '',
      ...rest
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={`
          font-sans transition-all duration-normal ease-out
          ${variantStyles[variant]}
          ${paddingStyles[padding]}
          ${radiusStyles[radius]}
          ${
            interactive
              ? 'cursor-pointer hover:border-border-strong hover:shadow-md active:bg-surface-subtle/50'
              : ''
          }
          ${className}
        `}
        {...rest}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
