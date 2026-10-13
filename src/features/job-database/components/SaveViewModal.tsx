import React, { useState } from 'react';
import { Typography } from '@/components/typography';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { X, Bookmark, Check } from 'lucide-react';
import { JobDatabaseStandardView } from '@/core/jobs/types';

interface SaveViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeStandardView: JobDatabaseStandardView;
  activeFilterSummary: string;
  onSave: (viewName: string) => void;
}

export const SaveViewModal: React.FC<SaveViewModalProps> = ({
  isOpen,
  onClose,
  activeStandardView,
  activeFilterSummary,
  onSave,
}) => {
  const [viewName, setViewName] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = viewName.trim();
    if (!trimmed) {
      setError('Please provide a name for this view.');
      return;
    }
    onSave(trimmed);
    setViewName('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md rounded-2xl bg-surface border border-border shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between pb-3 border-b border-border/80">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary-soft text-primary">
                <Bookmark className="h-4 w-4" />
              </div>
              <Typography as="h3" variant="h3" className="font-bold text-text-primary">
                Save Custom View
              </Typography>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-subtle transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-caption font-semibold text-text-secondary mb-1">
                View Name
              </label>
              <Input
                placeholder="e.g., High Match India Remote, Tier 1 Targets..."
                value={viewName}
                onChange={(e) => {
                  setViewName(e.target.value);
                  if (error) setError('');
                }}
                autoFocus
              />
              {error && <p className="text-caption text-red-500 mt-1">{error}</p>}
            </div>

            <div className="p-3 rounded-xl bg-surface-subtle/50 border border-border/80 text-caption space-y-1">
              <span className="font-semibold text-text-primary block text-[11px] uppercase tracking-wider">
                Configured Criteria
              </span>
              <p className="text-text-secondary text-xs">
                Base View: <strong className="text-text-primary capitalize">{activeStandardView.replace(/_/g, ' ')}</strong>
              </p>
              <p className="text-text-muted text-[11px] italic">
                {activeFilterSummary || 'All matching opportunities in base view'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" leftIcon={<Check className="h-4 w-4" />}>
                Save View
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
