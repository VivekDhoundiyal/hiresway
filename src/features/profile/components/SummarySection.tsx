import React, { useState } from 'react';
import { ProfessionalSummary } from '@/core/profile';
import { Card } from '@/components/card';
import { Typography } from '@/components/typography';
import { Button } from '@/components/button';
import { FileText, Edit2, Check, X, Plus, Trash2 } from 'lucide-react';

export interface SummarySectionProps {
  data: ProfessionalSummary;
  onSave: (updated: ProfessionalSummary) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export const SummarySection: React.FC<SummarySectionProps> = ({
  data,
  onSave,
  onDirtyChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [summaryText, setSummaryText] = useState(data.summaryText);
  const [highlights, setHighlights] = useState<string[]>(data.keyHighlights);
  const [newHighlight, setNewHighlight] = useState('');

  const handleStartEdit = () => {
    setSummaryText(data.summaryText);
    setHighlights([...data.keyHighlights]);
    setNewHighlight('');
    setIsEditing(true);
    onDirtyChange?.(true);
  };

  const handleCancel = () => {
    setSummaryText(data.summaryText);
    setHighlights([...data.keyHighlights]);
    setNewHighlight('');
    setIsEditing(false);
    onDirtyChange?.(false);
  };

  const handleSave = () => {
    onSave({
      summaryText,
      keyHighlights: highlights.filter((h) => h.trim().length > 0),
    });
    setIsEditing(false);
    onDirtyChange?.(false);
  };

  const handleAddHighlight = () => {
    if (!newHighlight.trim()) return;
    setHighlights((prev) => [...prev, newHighlight.trim()]);
    setNewHighlight('');
  };

  const handleRemoveHighlight = (index: number) => {
    setHighlights((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Card id="summary" variant="default" padding="lg" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/70 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary-soft text-primary border border-blue-200/60 shadow-sm shrink-0">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <Typography as="h2" variant="h3" color="primary">
              Professional Summary
            </Typography>
            <Typography as="p" variant="body-sm" color="muted">
              Your elevator pitch, core career narrative, and highlight achievements
            </Typography>
          </div>
        </div>

        {!isEditing && (
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Edit2 className="h-3.5 w-3.5" />}
            onClick={handleStartEdit}
          >
            Edit
          </Button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5 font-sans">
            <label className="text-body-sm font-medium text-text-secondary">
              Summary Statement
            </label>
            <textarea
              rows={5}
              value={summaryText}
              onChange={(e) => setSummaryText(e.target.value)}
              placeholder="Describe your career focus, core value proposition, and key expertise..."
              className="w-full rounded-md bg-surface text-body-md text-text-primary placeholder:text-text-muted border border-border hover:border-border-strong focus:border-primary focus:ring-2 focus:ring-primary/20 p-3.5 transition-colors duration-fast outline-none shadow-sm resize-y"
            />
          </div>

          {/* Key Highlights */}
          <div className="space-y-2 pt-2">
            <label className="text-body-sm font-medium text-text-secondary block">
              Key Career Highlights
            </label>

            <div className="space-y-2">
              {highlights.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => {
                      const updated = [...highlights];
                      updated[index] = e.target.value;
                      setHighlights(updated);
                    }}
                    className="flex-1 h-9 rounded-md bg-surface text-body-sm text-text-primary border border-border px-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveHighlight(index)}
                    aria-label="Remove highlight"
                    className="p-2 text-text-muted hover:text-error hover:bg-error-soft rounded-md transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Add a measurable achievement (e.g. Led redesign increasing ARR by $2M)..."
                  value={newHighlight}
                  onChange={(e) => setNewHighlight(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddHighlight();
                    }
                  }}
                  className="flex-1 h-9 rounded-md bg-surface text-body-sm text-text-primary border border-border px-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-text-muted"
                />
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Plus className="h-4 w-4" />}
                  onClick={handleAddHighlight}
                >
                  Add
                </Button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/70">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<X className="h-4 w-4" />}
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Check className="h-4 w-4" />}
              onClick={handleSave}
            >
              Save Changes
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Typography
            as="p"
            variant="body-md"
            color="secondary"
            className="leading-relaxed whitespace-pre-line text-text-secondary"
          >
            {data.summaryText ||
              'No professional summary added yet. Click Edit to craft your career summary.'}
          </Typography>

          {data.keyHighlights.length > 0 && (
            <div className="pt-2 border-t border-border/60 space-y-2">
              <span className="text-caption font-semibold uppercase text-text-muted tracking-wider block">
                Key Highlights
              </span>
              <ul className="space-y-1.5 pl-4 list-disc text-body-sm text-text-secondary marker:text-primary">
                {data.keyHighlights.map((highlight, idx) => (
                  <li key={idx} className="leading-normal">
                    {highlight}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
