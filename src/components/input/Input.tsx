import React, { forwardRef, useId } from 'react';

export interface InputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'size'
> {
  label?: string;
  helperText?: string;
  error?: string;
  warning?: string;
  success?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      warning,
      success,
      leftIcon,
      rightIcon,
      fullWidth = true,
      disabled = false,
      id,
      className = '',
      ...rest
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const hasError = Boolean(error);
    const hasWarning = Boolean(warning) && !hasError;
    const hasSuccess = Boolean(success) && !hasError && !hasWarning;

    let borderStateStyles =
      'border-border hover:border-border-strong focus:border-primary focus:ring-2 focus:ring-primary/20';
    if (hasError) {
      borderStateStyles =
        'border-error focus:border-error focus:ring-2 focus:ring-error/20';
    } else if (hasWarning) {
      borderStateStyles =
        'border-warning focus:border-warning focus:ring-2 focus:ring-warning/20';
    } else if (hasSuccess) {
      borderStateStyles =
        'border-accent focus:border-accent focus:ring-2 focus:ring-accent/20';
    }

    return (
      <div
        className={`${fullWidth ? 'w-full' : 'inline-block'} flex flex-col gap-1.5 font-sans`}
      >
        {label && (
          <label
            htmlFor={inputId}
            className="text-body-sm font-medium text-text-secondary select-none"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-text-muted">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={hasError}
            aria-describedby={
              hasError
                ? `${inputId}-error`
                : hasWarning
                  ? `${inputId}-warning`
                  : helperText
                    ? `${inputId}-helper`
                    : undefined
            }
            className={`
              w-full h-10 rounded-md bg-surface text-body-md text-text-primary placeholder:text-text-muted
              border transition-colors duration-fast ease-out outline-none shadow-sm
              ${leftIcon ? 'pl-9' : 'pl-3.5'}
              ${rightIcon ? 'pr-9' : 'pr-3.5'}
              ${borderStateStyles}
              ${disabled ? 'bg-surface-subtle text-text-muted cursor-not-allowed opacity-60 hover:border-border' : ''}
              ${className}
            `}
            {...rest}
          />

          {rightIcon && (
            <div className="absolute right-3 flex items-center pointer-events-none text-text-muted">
              {rightIcon}
            </div>
          )}
        </div>

        {hasError && (
          <p
            id={`${inputId}-error`}
            className="text-caption text-error font-medium flex items-center gap-1"
          >
            {error}
          </p>
        )}

        {!hasError && hasWarning && (
          <p
            id={`${inputId}-warning`}
            className="text-caption text-warning font-medium flex items-center gap-1"
          >
            {warning}
          </p>
        )}

        {!hasError && !hasWarning && hasSuccess && (
          <p className="text-caption text-accent font-medium flex items-center gap-1">
            {success}
          </p>
        )}

        {!hasError && !hasWarning && !hasSuccess && helperText && (
          <p id={`${inputId}-helper`} className="text-caption text-text-muted">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
