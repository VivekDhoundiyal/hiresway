import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Typography } from '@/components/typography';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl';
  className?: string;
}

const sizeStyles = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className = '',
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto font-sans"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby={description ? 'modal-description' : undefined}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-normal ease-out"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        ref={modalRef}
        className={`
          relative w-full bg-surface rounded-xl border border-border shadow-lg z-10 my-auto
          flex flex-col max-h-[90vh] overflow-hidden transition-all duration-normal ease-out
          ${sizeStyles[size]}
          ${className}
        `}
      >
        {/* Header */}
        {(title || description) && (
          <div className="px-6 pt-5 pb-4 border-b border-border/80 flex items-start justify-between gap-4 shrink-0">
            <div className="space-y-1">
              {title && (
                <Typography as="h2" variant="h3" color="primary" id="modal-title">
                  {title}
                </Typography>
              )}
              {description && (
                <Typography as="p" variant="body-sm" color="muted" id="modal-description">
                  {description}
                </Typography>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="p-1.5 -mr-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-surface-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Body Content (Scrollable) */}
        <div className="p-6 overflow-y-auto flex-1">{children}</div>

        {/* Footer Actions */}
        {footer && (
          <div className="px-6 py-4 bg-surface-subtle/50 border-t border-border flex items-center justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
