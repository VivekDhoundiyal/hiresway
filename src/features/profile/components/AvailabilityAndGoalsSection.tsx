import React, { useState } from 'react';
import { NoticePeriodAndAvailability, CareerGoals, TargetMarkets } from '@/core/profile';
import { Card } from '@/components/card';
import { Typography } from '@/components/typography';
import { Button } from '@/components/button';
import { Badge } from '@/components/badge';
import { Clock, Edit2, Check, X, Plus, Compass, Building } from 'lucide-react';

export interface AvailabilityAndGoalsSectionProps {
  availability: NoticePeriodAndAvailability;
  careerGoals: CareerGoals;
  targetMarkets: TargetMarkets;
  onSave: (
    updatedAvail: NoticePeriodAndAvailability,
    updatedGoals: CareerGoals,
    updatedMarkets: TargetMarkets
  ) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

const statusOptions = [
  { value: 'actively_interviewing', label: 'Actively Interviewing' },
  { value: 'open_to_offers', label: 'Open to Offers' },
  { value: 'casually_browsing', label: 'Casually Browsing' },
  { value: 'not_looking', label: 'Not Looking' },
];

const noticeOptions = [
  { value: 'immediate', label: 'Immediate' },
  { value: '1_week', label: '1 Week Notice' },
  { value: '2_weeks', label: '2 Weeks Notice' },
  { value: '1_month', label: '1 Month Notice' },
  { value: '2_months', label: '2 Months Notice' },
  { value: '3_months', label: '3 Months Notice' },
  { value: 'custom', label: 'Specific Available Date' },
];

export const AvailabilityAndGoalsSection: React.FC<AvailabilityAndGoalsSectionProps> = ({
  availability,
  careerGoals,
  targetMarkets,
  onSave,
  onDirtyChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [availData, setAvailData] = useState<NoticePeriodAndAvailability>(availability);
  const [goalsData, setGoalsData] = useState<CareerGoals>(careerGoals);
  const [marketsData, setMarketsData] = useState<TargetMarkets>(targetMarkets);

  const [newIndustry, setNewIndustry] = useState('');
  const [newCompany, setNewCompany] = useState('');

  const handleStartEdit = () => {
    setAvailData(availability);
    setGoalsData(careerGoals);
    setMarketsData(targetMarkets);
    setNewIndustry('');
    setNewCompany('');
    setIsEditing(true);
    onDirtyChange?.(true);
  };

  const handleCancel = () => {
    setAvailData(availability);
    setGoalsData(careerGoals);
    setMarketsData(targetMarkets);
    setIsEditing(false);
    onDirtyChange?.(false);
  };

  const handleSave = () => {
    onSave(availData, goalsData, marketsData);
    setIsEditing(false);
    onDirtyChange?.(false);
  };

  const handleAddIndustry = () => {
    if (!newIndustry.trim()) return;
    if (!marketsData.targetIndustries.includes(newIndustry.trim())) {
      setMarketsData((prev) => ({
        ...prev,
        targetIndustries: [...prev.targetIndustries, newIndustry.trim()],
      }));
    }
    setNewIndustry('');
  };

  const handleRemoveIndustry = (ind: string) => {
    setMarketsData((prev) => ({
      ...prev,
      targetIndustries: prev.targetIndustries.filter((i) => i !== ind),
    }));
  };

  const handleAddCompany = () => {
    if (!newCompany.trim()) return;
    if (!marketsData.targetCompanies.includes(newCompany.trim())) {
      setMarketsData((prev) => ({
        ...prev,
        targetCompanies: [...prev.targetCompanies, newCompany.trim()],
      }));
    }
    setNewCompany('');
  };

  const handleRemoveCompany = (comp: string) => {
    setMarketsData((prev) => ({
      ...prev,
      targetCompanies: prev.targetCompanies.filter((c) => c !== comp),
    }));
  };

  const currentStatusLabel =
    statusOptions.find((s) => s.value === availability.availabilityStatus)?.label ||
    availability.availabilityStatus;

  const currentNoticeLabel =
    noticeOptions.find((n) => n.value === availability.noticePeriod)?.label ||
    availability.noticePeriod;

  return (
    <Card id="goals" variant="default" padding="lg" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/70 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary-soft text-primary border border-blue-200/60 shadow-sm shrink-0">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <Typography as="h2" variant="h3" color="primary">
              Availability & Career Goals
            </Typography>
            <Typography as="p" variant="body-sm" color="muted">
              Job search timeline, target industries, target employers, and long-term
              vision
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
          {/* Availability Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5 font-sans">
              <label className="text-body-sm font-medium text-text-secondary">
                Search Status
              </label>
              <select
                value={availData.availabilityStatus}
                onChange={(e) =>
                  setAvailData((prev) => ({
                    ...prev,
                    availabilityStatus: e.target
                      .value as NoticePeriodAndAvailability['availabilityStatus'],
                  }))
                }
                className="h-10 rounded-md bg-surface text-body-md text-text-primary border border-border px-3 outline-none focus:border-primary"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 font-sans">
              <label className="text-body-sm font-medium text-text-secondary">
                Notice Period / Availability
              </label>
              <select
                value={availData.noticePeriod}
                onChange={(e) =>
                  setAvailData((prev) => ({
                    ...prev,
                    noticePeriod: e.target
                      .value as NoticePeriodAndAvailability['noticePeriod'],
                  }))
                }
                className="h-10 rounded-md bg-surface text-body-md text-text-primary border border-border px-3 outline-none focus:border-primary"
              >
                {noticeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Target Industries Tags */}
          <div className="space-y-2 pt-2 border-t border-border/70">
            <label className="text-body-sm font-semibold text-text-primary block">
              Target Industries & Sectors
            </label>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {marketsData.targetIndustries.map((ind) => (
                <Badge key={ind} variant="primary" size="md">
                  <span>{ind}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveIndustry(ind)}
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
                placeholder="Add target industry (e.g. Fintech, Healthcare, SaaS)..."
                value={newIndustry}
                onChange={(e) => setNewIndustry(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddIndustry();
                  }
                }}
                className="flex-1 h-9 rounded-md bg-surface text-body-sm text-text-primary border border-border px-3 outline-none focus:border-primary"
              />
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={handleAddIndustry}
              >
                Add
              </Button>
            </div>
          </div>

          {/* Target Companies Tags */}
          <div className="space-y-2 pt-2 border-t border-border/70">
            <label className="text-body-sm font-semibold text-text-primary block">
              Target Dream Companies (Wishlist)
            </label>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {marketsData.targetCompanies.map((comp) => (
                <Badge key={comp} variant="neutral" size="md">
                  <span>{comp}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCompany(comp)}
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
                placeholder="Add company (e.g. Stripe, Linear, Vercel)..."
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCompany();
                  }
                }}
                className="flex-1 h-9 rounded-md bg-surface text-body-sm text-text-primary border border-border px-3 outline-none focus:border-primary"
              />
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={handleAddCompany}
              >
                Add
              </Button>
            </div>
          </div>

          {/* Career Goals */}
          <div className="space-y-3 pt-2 border-t border-border/70">
            <div className="flex flex-col gap-1.5 font-sans">
              <label className="text-body-sm font-medium text-text-secondary">
                Short-Term Goals (Next 1-2 Years)
              </label>
              <textarea
                rows={2}
                value={goalsData.shortTermGoals}
                onChange={(e) =>
                  setGoalsData((prev) => ({ ...prev, shortTermGoals: e.target.value }))
                }
                placeholder="What responsibilities, team size, or technologies do you want to master in your next position?"
                className="w-full rounded-md bg-surface text-body-md text-text-primary border border-border p-3 outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-1.5 font-sans">
              <label className="text-body-sm font-medium text-text-secondary">
                Long-Term Vision (3-5 Years)
              </label>
              <textarea
                rows={2}
                value={goalsData.longTermVision}
                onChange={(e) =>
                  setGoalsData((prev) => ({ ...prev, longTermVision: e.target.value }))
                }
                placeholder="Where do you see yourself in 3-5 years (e.g. engineering leadership, starting a venture)?"
                className="w-full rounded-md bg-surface text-body-md text-text-primary border border-border p-3 outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-1.5 font-sans">
              <label className="text-body-sm font-medium text-text-secondary">
                Primary Motivation & Driving Factor
              </label>
              <textarea
                rows={2}
                value={goalsData.primaryMotivation}
                onChange={(e) =>
                  setGoalsData((prev) => ({ ...prev, primaryMotivation: e.target.value }))
                }
                placeholder="What motivates you most (e.g. autonomy, compensation, team caliber, impactful mission)?"
                className="w-full rounded-md bg-surface text-body-md text-text-primary border border-border p-3 outline-none focus:border-primary"
              />
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
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-lg bg-surface-subtle border border-border/60 space-y-1">
              <span className="text-caption font-semibold uppercase text-text-muted tracking-wider block">
                Availability Status
              </span>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant={
                    availability.availabilityStatus === 'actively_interviewing'
                      ? 'success'
                      : 'primary'
                  }
                  size="md"
                  dot
                >
                  {currentStatusLabel}
                </Badge>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-surface-subtle border border-border/60 space-y-1">
              <span className="text-caption font-semibold uppercase text-text-muted tracking-wider block">
                Notice Period
              </span>
              <div className="flex items-center gap-1.5 text-body-md font-semibold text-text-primary mt-1">
                <Clock className="h-4 w-4 text-primary" />
                <span>{currentNoticeLabel}</span>
              </div>
            </div>
          </div>

          {targetMarkets.targetIndustries.length > 0 && (
            <div>
              <span className="text-caption font-semibold uppercase text-text-muted tracking-wider block mb-2">
                Target Industries
              </span>
              <div className="flex flex-wrap gap-1.5">
                {targetMarkets.targetIndustries.map((ind) => (
                  <Badge key={ind} variant="primary" size="sm">
                    {ind}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {targetMarkets.targetCompanies.length > 0 && (
            <div>
              <span className="text-caption font-semibold uppercase text-text-muted tracking-wider block mb-2">
                Target Companies
              </span>
              <div className="flex flex-wrap gap-1.5">
                {targetMarkets.targetCompanies.map((comp) => (
                  <Badge
                    key={comp}
                    variant="neutral"
                    size="sm"
                    icon={<Building className="h-3 w-3 mr-1" />}
                  >
                    {comp}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {(careerGoals.shortTermGoals ||
            careerGoals.longTermVision ||
            careerGoals.primaryMotivation) && (
            <div className="space-y-3 pt-3 border-t border-border/60 text-body-sm">
              {careerGoals.shortTermGoals && (
                <div>
                  <span className="font-semibold text-text-primary block">
                    Short-Term Goal:
                  </span>
                  <p className="text-text-secondary mt-0.5">
                    {careerGoals.shortTermGoals}
                  </p>
                </div>
              )}
              {careerGoals.longTermVision && (
                <div>
                  <span className="font-semibold text-text-primary block">
                    Long-Term Vision:
                  </span>
                  <p className="text-text-secondary mt-0.5">
                    {careerGoals.longTermVision}
                  </p>
                </div>
              )}
              {careerGoals.primaryMotivation && (
                <div>
                  <span className="font-semibold text-text-primary block">
                    Primary Motivation:
                  </span>
                  <p className="text-text-secondary mt-0.5">
                    {careerGoals.primaryMotivation}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
