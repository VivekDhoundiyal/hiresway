import React, { forwardRef } from 'react';

export type ButtonVariant =
  'primary' | 'secondary' | 'outline' | 'ghost' | 'success' | 'danger' | 'warning';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white hover:bg-primary-hover active:bg-[#1E40AF] border border-transparent shadow-sm',
  secondary:
    'bg-primary-soft text-primary hover:bg-[#DBEAFE] active:bg-[#BFDBFE] border border-transparent',
  outline:
    'bg-surface text-text-primary border border-border hover:bg-surface-subtle hover:border-border-strong active:bg-[#E2E8F0] shadow-sm',
  ghost:
    'bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface-subtle active:bg-[#E2E8F0]',
  success:
    'bg-accent text-white hover:bg-[#15803D] active:bg-[#166534] border border-transparent shadow-sm',
  danger:
    'bg-error text-white hover:bg-[#B91C1C] active:bg-[#991B1B] border border-transparent shadow-sm',
  warning:
    'bg-warning text-white hover:bg-[#B45309] active:bg-[#92400E] border border-transparent shadow-sm',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-body-sm font-medium gap-1.5 rounded-sm',
  md: 'h-10 px-4 text-body-md font-medium gap-2 rounded-md',
  lg: 'h-12 px-5 text-body-lg font-medium gap-2.5 rounded-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled = false,
      className = '',
      type = 'button',
      ...rest
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={isLoading}
        className={`
          inline-flex items-center justify-center font-sans select-none
          transition-colors duration-fast ease-out
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${fullWidth ? 'w-full' : ''}
          ${isDisabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}
          ${className}
        `}
        {...rest}
      >
        {isLoading ? (
          <svg
            className="animate-spin -ml-0.5 mr-2 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && (
          <span className="inline-flex shrink-0">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
