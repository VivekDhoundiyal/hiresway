import React, { useState } from 'react';
import { CompensationExpectations } from '@/core/profile';
import { Card } from '@/components/card';
import { Typography } from '@/components/typography';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Badge } from '@/components/badge';
import { DollarSign, Edit2, Check, X } from 'lucide-react';

export interface CompensationSectionProps {
  data: CompensationExpectations;
  onSave: (updated: CompensationExpectations) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

const currencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'SGD', 'CHF'];

export const CompensationSection: React.FC<CompensationSectionProps> = ({
  data,
  onSave,
  onDirtyChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<CompensationExpectations>(data);

  const handleStartEdit = () => {
    setFormData(data);
    setIsEditing(true);
    onDirtyChange?.(true);
  };

  const handleCancel = () => {
    setFormData(data);
    setIsEditing(false);
    onDirtyChange?.(false);
  };

  const handleSave = () => {
    onSave(formData);
    setIsEditing(false);
    onDirtyChange?.(false);
  };

  const formatSalary = (amount: number, curr: string) => {
    if (!amount) return 'Not set';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: curr,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card id="compensation" variant="default" padding="lg" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/70 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary-soft text-primary border border-blue-200/60 shadow-sm shrink-0">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <Typography as="h2" variant="h3" color="primary">
              Compensation Expectations
            </Typography>
            <Typography as="p" variant="body-sm" color="muted">
              Target salary thresholds, bonus expectations, and equity preferences
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5 font-sans">
              <label className="text-body-sm font-medium text-text-secondary">
                Currency
              </label>
              <select
                value={formData.currency}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, currency: e.target.value }))
                }
                className="h-10 rounded-md bg-surface text-body-md text-text-primary border border-border px-3 outline-none focus:border-primary"
              >
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Minimum Acceptable Base"
              type="number"
              min={0}
              step={1000}
              value={formData.minBaseSalary || ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  minBaseSalary: parseInt(e.target.value, 10) || 0,
                }))
              }
              placeholder="e.g. 150000"
            />

            <Input
              label="Target Desired Base"
              type="number"
              min={0}
              step={1000}
              value={formData.targetBaseSalary || ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  targetBaseSalary: parseInt(e.target.value, 10) || 0,
                }))
              }
              placeholder="e.g. 185000"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Expected Annual Bonus (%)"
              type="number"
              min={0}
              max={100}
              value={formData.expectedBonusPercent || ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  expectedBonusPercent: parseInt(e.target.value, 10) || 0,
                }))
              }
              placeholder="e.g. 15"
            />

            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 cursor-pointer select-none text-body-sm text-text-primary">
                <input
                  type="checkbox"
                  checked={formData.openToEquity}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, openToEquity: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span>Open to Equity / Stock Options (RSUs / ISOs)</span>
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 font-sans">
            <label className="text-body-sm font-medium text-text-secondary">
              Compensation Notes & Total OTE Expectations
            </label>
            <textarea
              rows={2}
              value={formData.compensationNotes}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, compensationNotes: e.target.value }))
              }
              placeholder="Targeting $220k total comp, flexible on base for high-growth equity..."
              className="w-full rounded-md bg-surface text-body-md text-text-primary border border-border p-3 outline-none focus:border-primary"
            />
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3.5 rounded-lg bg-surface-subtle border border-border/60">
              <span className="text-caption font-semibold uppercase text-text-muted tracking-wider block">
                Target Base Salary
              </span>
              <span className="text-2xl font-bold text-primary mt-1 block tracking-tight">
                {formatSalary(data.targetBaseSalary, data.currency)}
              </span>
              <span className="text-caption text-text-muted block mt-0.5">
                Minimum: {formatSalary(data.minBaseSalary, data.currency)}
              </span>
            </div>

            <div className="p-3.5 rounded-lg bg-surface-subtle border border-border/60">
              <span className="text-caption font-semibold uppercase text-text-muted tracking-wider block">
                Bonus Expectation
              </span>
              <span className="text-2xl font-bold text-text-primary mt-1 block tracking-tight">
                {data.expectedBonusPercent ? `${data.expectedBonusPercent}%` : 'N/A'}
              </span>
              <span className="text-caption text-text-muted block mt-0.5">
                Annual performance
              </span>
            </div>

            <div className="p-3.5 rounded-lg bg-surface-subtle border border-border/60">
              <span className="text-caption font-semibold uppercase text-text-muted tracking-wider block">
                Equity & Stock Options
              </span>
              <div className="mt-2">
                <Badge variant={data.openToEquity ? 'success' : 'neutral'} size="md">
                  {data.openToEquity ? 'Open to Equity' : 'Base Focused'}
                </Badge>
              </div>
            </div>
          </div>

          {data.compensationNotes && (
            <p className="text-body-sm text-text-secondary pt-1 border-t border-border/60">
              <span className="font-semibold text-text-primary">Notes: </span>
              {data.compensationNotes}
            </p>
          )}
        </div>
      )}
    </Card>
  );
};
