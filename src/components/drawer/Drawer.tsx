import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Typography } from '@/components/typography';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  placement?: 'left' | 'right';
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
  className?: string;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  placement = 'right',
  title,
  description,
  children,
  footer,
  width = 'max-w-sm w-full',
  className = '',
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);

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

  const isLeft = placement === 'left';

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden font-sans"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-normal ease-out"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Slide-Over Panel */}
      <div
        className={`fixed inset-y-0 ${isLeft ? 'left-0' : 'right-0'} flex ${isLeft ? 'justify-start' : 'justify-end'} pointer-events-none`}
      >
        <div
          ref={drawerRef}
          className={`
            pointer-events-auto h-full bg-surface border-${isLeft ? 'r' : 'l'} border-border shadow-lg
            flex flex-col justify-between transition-transform duration-normal ease-out
            ${width}
            ${className}
          `}
        >
          {/* Header */}
          {title || description ? (
            <div className="h-16 px-5 border-b border-border flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                {title && (
                  <Typography as="h2" variant="h3" color="primary" className="truncate">
                    {title}
                  </Typography>
                )}
                {description && (
                  <Typography as="p" variant="caption" color="muted" className="truncate">
                    {description}
                  </Typography>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close drawer"
                className="p-1.5 -mr-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-surface-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shrink-0"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="p-3 flex justify-end shrink-0">
              <button
                type="button"
                onClick={onClose}
                aria-label="Close drawer"
                className="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-surface-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Body Content (Scrollable) */}
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

          {/* Optional Footer */}
          {footer && (
            <div className="p-4 bg-surface-subtle/50 border-t border-border shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
