import React, { useState } from 'react';
import { RolePreferences } from '@/core/profile';
import { Card } from '@/components/card';
import { Typography } from '@/components/typography';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Badge } from '@/components/badge';
import { Target, Edit2, Check, X, Plus, AlertCircle } from 'lucide-react';

export interface RoleAndExperienceSectionProps {
  data: RolePreferences;
  onSave: (updated: RolePreferences) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

const experienceLevels = [
  { value: 'entry', label: 'Entry Level (0-2 yrs)' },
  { value: 'mid', label: 'Mid Level (3-5 yrs)' },
  { value: 'senior', label: 'Senior (5-8 yrs)' },
  { value: 'lead', label: 'Lead / Staff (8-12 yrs)' },
  { value: 'manager', label: 'Engineering / Product Manager' },
  { value: 'director', label: 'Director / Head of Department' },
  { value: 'executive', label: 'Executive / VP / C-Suite' },
];

export const RoleAndExperienceSection: React.FC<RoleAndExperienceSectionProps> = ({
  data,
  onSave,
  onDirtyChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<RolePreferences>(data);
  const [newTitle, setNewTitle] = useState('');

  const handleStartEdit = () => {
    setFormData(data);
    setNewTitle('');
    setIsEditing(true);
    onDirtyChange?.(true);
  };

  const handleCancel = () => {
    setFormData(data);
    setNewTitle('');
    setIsEditing(false);
    onDirtyChange?.(false);
  };

  const handleSave = () => {
    onSave(formData);
    setIsEditing(false);
    onDirtyChange?.(false);
  };

  const handleAddTitle = () => {
    if (!newTitle.trim()) return;
    if (!formData.targetJobTitles.includes(newTitle.trim())) {
      setFormData((prev) => ({
        ...prev,
        targetJobTitles: [...prev.targetJobTitles, newTitle.trim()],
      }));
    }
    setNewTitle('');
  };

  const handleRemoveTitle = (titleToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      targetJobTitles: prev.targetJobTitles.filter((t) => t !== titleToRemove),
    }));
  };

  const levelLabel =
    experienceLevels.find((lvl) => lvl.value === data.experienceLevel)?.label ||
    data.experienceLevel;

  return (
    <Card id="roles" variant="default" padding="lg" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/70 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary-soft text-primary border border-blue-200/60 shadow-sm shrink-0">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <Typography as="h2" variant="h3" color="primary">
              Current & Target Roles
            </Typography>
            <Typography as="p" variant="body-sm" color="muted">
              Define your career trajectory, seniority level, and target job titles
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Current Title"
              value={formData.currentTitle}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, currentTitle: e.target.value }))
              }
              placeholder="e.g. Senior Software Engineer"
            />
            <Input
              label="Current Company"
              value={formData.currentCompany}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, currentCompany: e.target.value }))
              }
              placeholder="e.g. TechCorp Solutions"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Primary Target Role *"
              value={formData.targetPrimaryTitle}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, targetPrimaryTitle: e.target.value }))
              }
              placeholder="e.g. Staff Frontend Engineer"
              helperText="The exact job title you prioritize when searching"
            />

            <div className="flex flex-col gap-1.5 font-sans">
              <label className="text-body-sm font-medium text-text-secondary">
                Experience Level
              </label>
              <select
                value={formData.experienceLevel}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    experienceLevel: e.target.value as RolePreferences['experienceLevel'],
                  }))
                }
                className="h-10 rounded-md bg-surface text-body-md text-text-primary border border-border px-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {experienceLevels.map((lvl) => (
                  <option key={lvl.value} value={lvl.value}>
                    {lvl.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Total Years of Professional Experience"
              type="number"
              min={0}
              max={50}
              value={formData.totalYearsExperience}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  totalYearsExperience: parseInt(e.target.value, 10) || 0,
                }))
              }
            />
          </div>

          {/* Target Job Titles Tags */}
          <div className="space-y-2 pt-2">
            <label className="text-body-sm font-medium text-text-secondary block">
              Additional Target Job Titles
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.targetJobTitles.map((title) => (
                <Badge key={title} variant="primary" size="md" className="pr-1.5">
                  <span>{title}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTitle(title)}
                    className="ml-1.5 hover:text-red-500 rounded p-0.5"
                    aria-label={`Remove ${title}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Add another title (e.g. Full Stack Architect)..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTitle();
                  }
                }}
                className="flex-1 h-9 rounded-md bg-surface text-body-sm text-text-primary border border-border px-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={handleAddTitle}
              >
                Add
              </Button>
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
        /* View Mode */
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-lg bg-surface-subtle border border-border/60">
              <span className="text-caption font-semibold uppercase text-text-muted tracking-wider block">
                Current Position
              </span>
              <span className="text-body-md font-semibold text-text-primary mt-1 block">
                {data.currentTitle || 'Title Not Set'}
              </span>
              <span className="text-body-sm text-text-secondary block">
                {data.currentCompany
                  ? `at ${data.currentCompany}`
                  : 'Company not specified'}
              </span>
            </div>

            <div className="p-3.5 rounded-lg bg-surface-subtle border border-border/60">
              <span className="text-caption font-semibold uppercase text-text-muted tracking-wider block">
                Primary Target Role
              </span>
              <span className="text-body-md font-semibold text-primary mt-1 block">
                {data.targetPrimaryTitle || 'Target Role Not Set'}
              </span>
              <span className="text-body-sm text-text-secondary block">
                {levelLabel} • {data.totalYearsExperience} Years Experience
              </span>
            </div>
          </div>

          {data.targetJobTitles.length > 0 && (
            <div className="pt-2 border-t border-border/60 space-y-2">
              <span className="text-caption font-semibold uppercase text-text-muted tracking-wider block">
                Target Job Titles
              </span>
              <div className="flex flex-wrap gap-2">
                {data.targetJobTitles.map((title) => (
                  <Badge key={title} variant="primary" size="md">
                    {title}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Seniority Alignment Advisory */}
          {(/staff|principal|director|head of|lead|architect|vp/i.test(
            data.targetPrimaryTitle
          ) ||
            ['senior', 'lead', 'manager', 'director', 'executive'].includes(
              data.experienceLevel
            )) &&
            data.totalYearsExperience > 0 &&
            data.totalYearsExperience < 3 && (
              <div className="p-3 bg-amber-50/80 border border-amber-200 text-amber-900 rounded-lg text-caption flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Seniority note:</strong> Your selected level or target title (
                  {data.targetPrimaryTitle || data.experienceLevel}) typically expects 3+
                  years of experience. Consider verifying your recorded years of
                  experience.
                </span>
              </div>
            )}
        </div>
      )}
    </Card>
  );
};
