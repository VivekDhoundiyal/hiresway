import React, { useState } from 'react';
import { WorkPreferences, LocationAndAuthorization } from '@/core/profile';
import { Card } from '@/components/card';
import { Typography } from '@/components/typography';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Badge } from '@/components/badge';
import { Sliders, Edit2, Check, X, Plus } from 'lucide-react';

export interface WorkPreferencesSectionProps {
  preferences: WorkPreferences;
  auth: LocationAndAuthorization;
  onSave: (updatedPrefs: WorkPreferences, updatedAuth: LocationAndAuthorization) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

const authStatuses = [
  { value: 'citizen', label: 'Citizen' },
  { value: 'permanent_resident', label: 'Permanent Resident (Green Card)' },
  { value: 'work_visa', label: 'Work Visa (e.g. H-1B, L-1, TN, O-1)' },
  { value: 'student_visa', label: 'Student Visa / OPT / STEM OPT' },
  { value: 'requires_sponsorship', label: 'Requires Sponsorship' },
  { value: 'other', label: 'Other Status' },
];

export const WorkPreferencesSection: React.FC<WorkPreferencesSectionProps> = ({
  preferences,
  auth,
  onSave,
  onDirtyChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [prefData, setPrefData] = useState<WorkPreferences>(preferences);
  const [authData, setAuthData] = useState<LocationAndAuthorization>(auth);
  const [newReloc, setNewReloc] = useState('');

  const handleStartEdit = () => {
    setPrefData(preferences);
    setAuthData(auth);
    setNewReloc('');
    setIsEditing(true);
    onDirtyChange?.(true);
  };

  const handleCancel = () => {
    setPrefData(preferences);
    setAuthData(auth);
    setIsEditing(false);
    onDirtyChange?.(false);
  };

  const handleSave = () => {
    onSave(prefData, authData);
    setIsEditing(false);
    onDirtyChange?.(false);
  };

  const toggleWorkplaceType = (type: 'remote' | 'hybrid' | 'on-site') => {
    setPrefData((prev) => {
      const exists = prev.workplaceTypes.includes(type);
      return {
        ...prev,
        workplaceTypes: exists
          ? prev.workplaceTypes.filter((t) => t !== type)
          : [...prev.workplaceTypes, type],
      };
    });
  };

  const toggleEmploymentType = (
    type: 'full-time' | 'contract' | 'part-time' | 'internship'
  ) => {
    setPrefData((prev) => {
      const exists = prev.employmentTypes.includes(type);
      return {
        ...prev,
        employmentTypes: exists
          ? prev.employmentTypes.filter((t) => t !== type)
          : [...prev.employmentTypes, type],
      };
    });
  };

  const handleAddReloc = () => {
    if (!newReloc.trim()) return;
    if (!authData.preferredRelocationLocations.includes(newReloc.trim())) {
      setAuthData((prev) => ({
        ...prev,
        preferredRelocationLocations: [
          ...prev.preferredRelocationLocations,
          newReloc.trim(),
        ],
      }));
    }
    setNewReloc('');
  };

  const handleRemoveReloc = (loc: string) => {
    setAuthData((prev) => ({
      ...prev,
      preferredRelocationLocations: prev.preferredRelocationLocations.filter(
        (l) => l !== loc
      ),
    }));
  };

  const authLabel =
    authStatuses.find((s) => s.value === auth.workAuthorizationStatus)?.label ||
    auth.workAuthorizationStatus;

  return (
    <Card id="preferences" variant="default" padding="lg" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/70 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary-soft text-primary border border-blue-200/60 shadow-sm shrink-0">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <Typography as="h2" variant="h3" color="primary">
              Work Preferences & Authorization
            </Typography>
            <Typography as="p" variant="body-sm" color="muted">
              Remote/hybrid preferences, employment terms, relocation, and visa status
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
        <div className="space-y-5">
          {/* Workplace Setting Selection */}
          <div className="space-y-2">
            <label className="text-body-sm font-semibold text-text-primary block">
              Desired Workplace Setting (select all that apply)
            </label>
            <div className="flex flex-wrap gap-4">
              {(['remote', 'hybrid', 'on-site'] as const).map((type) => (
                <label
                  key={type}
                  className="flex items-center gap-2 cursor-pointer select-none text-body-sm"
                >
                  <input
                    type="checkbox"
                    checked={prefData.workplaceTypes.includes(type)}
                    onChange={() => toggleWorkplaceType(type)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="capitalize">{type}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Employment Type Selection */}
          <div className="space-y-2">
            <label className="text-body-sm font-semibold text-text-primary block">
              Employment Type
            </label>
            <div className="flex flex-wrap gap-4">
              {(['full-time', 'contract', 'part-time', 'internship'] as const).map(
                (type) => (
                  <label
                    key={type}
                    className="flex items-center gap-2 cursor-pointer select-none text-body-sm"
                  >
                    <input
                      type="checkbox"
                      checked={prefData.employmentTypes.includes(type)}
                      onChange={() => toggleEmploymentType(type)}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="capitalize">{type}</span>
                  </label>
                )
              )}
            </div>
          </div>

          {/* Work Authorization & Citizenship */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/70">
            <Input
              label="Country of Citizenship"
              value={authData.citizenship}
              onChange={(e) =>
                setAuthData((prev) => ({ ...prev, citizenship: e.target.value }))
              }
              placeholder="e.g. United States, Canada, India"
            />

            <div className="flex flex-col gap-1.5 font-sans">
              <label className="text-body-sm font-medium text-text-secondary">
                Work Authorization Status
              </label>
              <select
                value={authData.workAuthorizationStatus}
                onChange={(e) =>
                  setAuthData((prev) => ({
                    ...prev,
                    workAuthorizationStatus: e.target
                      .value as LocationAndAuthorization['workAuthorizationStatus'],
                  }))
                }
                className="h-10 rounded-md bg-surface text-body-md text-text-primary border border-border px-3 outline-none focus:border-primary"
              >
                {authStatuses.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Sponsorship Checkboxes */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none text-body-sm">
              <input
                type="checkbox"
                checked={authData.requiresSponsorshipNow}
                onChange={(e) =>
                  setAuthData((prev) => ({
                    ...prev,
                    requiresSponsorshipNow: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <span>I require visa sponsorship now to work</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none text-body-sm">
              <input
                type="checkbox"
                checked={authData.requiresSponsorshipFuture}
                onChange={(e) =>
                  setAuthData((prev) => ({
                    ...prev,
                    requiresSponsorshipFuture: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <span>
                I will require visa sponsorship in the future (e.g. STEM OPT to H-1B)
              </span>
            </label>
          </div>

          {/* Relocation */}
          <div className="space-y-2 pt-2 border-t border-border/70">
            <label className="flex items-center gap-2 cursor-pointer select-none text-body-sm font-semibold text-text-primary">
              <input
                type="checkbox"
                checked={authData.openToRelocation}
                onChange={(e) =>
                  setAuthData((prev) => ({ ...prev, openToRelocation: e.target.checked }))
                }
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <span>Open to relocation for the right opportunity</span>
            </label>

            {authData.openToRelocation && (
              <div className="space-y-2 pt-1 pl-6">
                <span className="text-caption text-text-muted block">
                  Preferred Relocation Destinations
                </span>
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {authData.preferredRelocationLocations.map((loc) => (
                    <Badge key={loc} variant="neutral" size="sm">
                      <span>{loc}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveReloc(loc)}
                        className="ml-1 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Add city or region (e.g. London, UK; Austin, TX)..."
                    value={newReloc}
                    onChange={(e) => setNewReloc(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddReloc();
                      }
                    }}
                    className="flex-1 h-9 rounded-md bg-surface text-body-sm text-text-primary border border-border px-3 outline-none focus:border-primary"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Plus className="h-4 w-4" />}
                    onClick={handleAddReloc}
                  >
                    Add
                  </Button>
                </div>
              </div>
            )}
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
            <div className="p-3.5 rounded-lg bg-surface-subtle border border-border/60 space-y-2">
              <span className="text-caption font-semibold uppercase text-text-muted tracking-wider block">
                Workplace & Terms
              </span>
              <div className="flex flex-wrap gap-1.5">
                {preferences.workplaceTypes.map((type) => (
                  <Badge key={type} variant="primary" size="sm" className="capitalize">
                    {type}
                  </Badge>
                ))}
                {preferences.employmentTypes.map((type) => (
                  <Badge key={type} variant="neutral" size="sm" className="capitalize">
                    {type}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-surface-subtle border border-border/60 space-y-1">
              <span className="text-caption font-semibold uppercase text-text-muted tracking-wider block">
                Work Authorization
              </span>
              <span className="text-body-md font-semibold text-text-primary block">
                {authLabel}
              </span>
              <span className="text-caption text-text-muted block">
                Citizenship: {auth.citizenship || 'Not specified'} • Sponsorship:{' '}
                {auth.requiresSponsorshipNow ? 'Required' : 'Not Required'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-body-sm text-text-secondary">
            <span>Relocation:</span>
            <Badge variant={auth.openToRelocation ? 'success' : 'neutral'} size="sm">
              {auth.openToRelocation ? 'Open to Relocation' : 'Not Relocating'}
            </Badge>
            {auth.openToRelocation && auth.preferredRelocationLocations.length > 0 && (
              <span className="text-caption text-text-muted">
                ({auth.preferredRelocationLocations.join(', ')})
              </span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};
