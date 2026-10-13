import React, { useState } from 'react';
import { Modal } from '@/components/modal';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { UserProfile } from '@/core/profile/types';
import { Sparkles, Briefcase, Plus, X } from 'lucide-react';

export interface CareerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSave: (updatedProfile: UserProfile) => void;
}

const COMMON_FUNCTIONS = [
  { id: 'sales', label: 'Enterprise Sales & Revenue', domain: 'SALES_AND_BD' },
  { id: 'growth', label: 'Growth & Commercial Partnerships', domain: 'GROWTH_AND_REVENUE' },
  { id: 'operations', label: 'Business Operations & Management', domain: 'OPERATIONS_AND_MANAGEMENT' },
  { id: 'product', label: 'Product Management', domain: 'PRODUCT_MANAGEMENT' },
  { id: 'engineering', label: 'Software Engineering', domain: 'SOFTWARE_ENGINEERING' },
];

export const CareerProfileModal: React.FC<CareerProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSave,
}) => {
  const [headline, setHeadline] = useState(profile.personalInfo.headline || '');
  const [primaryTitle, setPrimaryTitle] = useState(
    profile.rolePreferences.targetPrimaryTitle || ''
  );
  const [targetTitles, setTargetTitles] = useState<string[]>(
    profile.rolePreferences.targetJobTitles || []
  );
  const [newTitleInput, setNewTitleInput] = useState('');
  const [seniority, setSeniority] = useState(
    profile.rolePreferences.experienceLevel || 'senior'
  );
  const [totalYearsExperience, setTotalYearsExperience] = useState(
    profile.rolePreferences.totalYearsExperience || 8
  );

  const [skills, setSkills] = useState<string[]>([
    ...(profile.skills.technicalSkills || []),
    ...(profile.skills.toolsAndPlatforms || []),
  ]);
  const [newSkillInput, setNewSkillInput] = useState('');

  const [minBaseSalary, setMinBaseSalary] = useState(
    profile.compensation.minBaseSalary || 0
  );
  const [targetBaseSalary, setTargetBaseSalary] = useState(
    profile.compensation.targetBaseSalary || 0
  );
  const [currency, setCurrency] = useState(profile.compensation.currency || 'INR');

  const selectFunctionPreset = (func: (typeof COMMON_FUNCTIONS)[0]) => {
    if (func.id === 'sales') {
      setHeadline('Enterprise Sales, Strategic Partnerships & Revenue Leadership');
      setPrimaryTitle('Head of Business Development & Strategic Partnerships');
      if (!targetTitles.includes('Enterprise Account Executive')) {
        setTargetTitles((prev) => [
          ...prev,
          'Enterprise Account Executive',
          'Director of Enterprise Sales',
          'VP of Revenue & Partnerships',
        ]);
      }
    } else if (func.id === 'growth') {
      setHeadline('Growth, Commercial Partnerships & Business Expansion');
      setPrimaryTitle('VP of Growth & Partnerships');
      if (!targetTitles.includes('Head of Strategic Partnerships')) {
        setTargetTitles((prev) => [...prev, 'Head of Strategic Partnerships', 'Director of Growth']);
      }
    } else if (func.id === 'operations') {
      setHeadline('Business Operations, Strategy & Commercial Operations');
      setPrimaryTitle('Director of Business Operations & Strategy');
      if (!targetTitles.includes('Chief of Staff')) {
        setTargetTitles((prev) => [...prev, 'Chief of Staff', 'Director of Revenue Operations']);
      }
    } else if (func.id === 'product') {
      setHeadline('Product Management & Product Strategy Leader');
      setPrimaryTitle('Director of Product Management');
    } else if (func.id === 'engineering') {
      setHeadline('Software Engineering & Technical Leadership');
      setPrimaryTitle('Engineering Director / Staff Engineer');
    }
  };

  const addTitle = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newTitleInput.trim();
    if (!trimmed) return;
    if (!targetTitles.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setTargetTitles([...targetTitles, trimmed]);
    }
    setNewTitleInput('');
  };

  const removeTitle = (title: string) => {
    setTargetTitles(targetTitles.filter((t) => t !== title));
  };

  const addSkill = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newSkillInput.trim();
    if (!trimmed) return;
    if (!skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setSkills([...skills, trimmed]);
    }
    setNewSkillInput('');
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  const handleSave = () => {
    const updated: UserProfile = {
      ...profile,
      personalInfo: {
        ...profile.personalInfo,
        headline,
      },
      rolePreferences: {
        ...profile.rolePreferences,
        targetPrimaryTitle: primaryTitle,
        targetJobTitles: targetTitles,
        experienceLevel: seniority as UserProfile['rolePreferences']['experienceLevel'],
        totalYearsExperience: Number(totalYearsExperience),
      },
      skills: {
        ...profile.skills,
        technicalSkills: skills,
      },
      compensation: {
        ...profile.compensation,
        currency,
        minBaseSalary: Number(minBaseSalary),
        targetBaseSalary: Number(targetBaseSalary),
      },
      lastUpdated: new Date().toISOString(),
    };

    onSave(updated);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Career Profile & Targeting Intelligence"
      size="xl"
    >
      <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
        {/* Banner */}
        <div className="p-3.5 rounded-xl bg-primary-soft/60 border border-blue-200/70 text-body-sm flex items-start gap-2.5">
          <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="text-caption leading-relaxed">
            <strong className="text-primary font-semibold block mb-0.5">
              Single Source of Truth for Career Intelligence
            </strong>
            Changes made here directly govern Job Feed discovery filters, application tailoring,
            Kanban score cards, and resume generation across CareerOs.
          </div>
        </div>

        {/* Quick Career Focus Presets */}
        <div className="space-y-2">
          <label className="text-caption font-semibold text-text-secondary uppercase tracking-wider block">
            Target Career Family Presets
          </label>
          <div className="flex flex-wrap gap-2">
            {COMMON_FUNCTIONS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => selectFunctionPreset(f)}
                className="px-3 py-1.5 rounded-lg text-caption font-medium border bg-surface hover:bg-surface-subtle text-text-secondary hover:text-primary hover:border-primary/50 transition-colors cursor-pointer"
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Headline */}
        <div className="space-y-1.5">
          <label className="text-caption font-semibold text-text-secondary uppercase tracking-wider block">
            Professional Headline
          </label>
          <Input
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="e.g. B2B Sales & Business Development Leader..."
          />
        </div>

        {/* Primary Role & Seniority */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-caption font-semibold text-text-secondary uppercase tracking-wider block">
              Primary Target Title
            </label>
            <Input
              value={primaryTitle}
              onChange={(e) => setPrimaryTitle(e.target.value)}
              placeholder="e.g. Head of Business Development"
              leftIcon={<Briefcase className="h-4 w-4 text-text-muted" />}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-caption font-semibold text-text-secondary uppercase tracking-wider block">
                Seniority Level
              </label>
              <select
                value={seniority}
                onChange={(e) =>
                  setSeniority(
                    e.target.value as UserProfile['rolePreferences']['experienceLevel']
                  )
                }
                className="w-full h-10 px-3 text-body-sm bg-surface border border-border rounded-lg text-text-secondary focus:outline-none focus:border-primary"
              >
                <option value="entry">Entry-Level</option>
                <option value="mid">Mid-Level</option>
                <option value="senior">Senior</option>
                <option value="lead">Lead / Staff</option>
                <option value="manager">Manager</option>
                <option value="director">Director</option>
                <option value="executive">Executive / VP</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-caption font-semibold text-text-secondary uppercase tracking-wider block">
                Years Experience
              </label>
              <Input
                type="number"
                value={totalYearsExperience}
                onChange={(e) => setTotalYearsExperience(Number(e.target.value))}
                min={0}
                max={50}
              />
            </div>
          </div>
        </div>

        {/* Additional Target Titles */}
        <div className="space-y-2">
          <label className="text-caption font-semibold text-text-secondary uppercase tracking-wider block">
            Target Job Titles ({targetTitles.length})
          </label>
          <div className="flex flex-wrap gap-1.5 p-2.5 rounded-lg bg-surface-subtle border border-border min-h-[44px]">
            {targetTitles.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-caption font-medium bg-surface border border-border text-text-primary shadow-xs"
              >
                <span>{t}</span>
                <button
                  type="button"
                  onClick={() => removeTitle(t)}
                  className="hover:text-error cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Input
              placeholder="Add another target title (e.g. Director of Enterprise Sales)..."
              value={newTitleInput}
              onChange={(e) => setNewTitleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTitle();
                }
              }}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => addTitle()}
              disabled={!newTitleInput.trim()}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Add Title
            </Button>
          </div>
        </div>

        {/* Skills & Commercial Stack */}
        <div className="space-y-2">
          <label className="text-caption font-semibold text-text-secondary uppercase tracking-wider block">
            Key Competencies & Stack ({skills.length})
          </label>
          <div className="flex flex-wrap gap-1.5 p-2.5 rounded-lg bg-surface-subtle border border-border max-h-32 overflow-y-auto">
            {skills.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-surface border border-border text-text-secondary"
              >
                <span>{s}</span>
                <button
                  type="button"
                  onClick={() => removeSkill(s)}
                  className="hover:text-error cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Input
              placeholder="Add skill or commercial tool (e.g. HubSpot CRM, Deal Closure)..."
              value={newSkillInput}
              onChange={(e) => setNewSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSkill();
                }
              }}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => addSkill()}
              disabled={!newSkillInput.trim()}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Add Skill
            </Button>
          </div>
        </div>

        {/* Compensation Expectations */}
        <div className="space-y-2 pt-2 border-t border-border/70">
          <label className="text-caption font-semibold text-text-secondary uppercase tracking-wider block">
            Compensation Expectations
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-caption text-text-muted block mb-1">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full h-10 px-3 text-body-sm bg-surface border border-border rounded-lg text-text-secondary focus:outline-none focus:border-primary"
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>

            <div>
              <label className="text-caption text-text-muted block mb-1">Min Base Salary</label>
              <Input
                type="number"
                value={minBaseSalary}
                onChange={(e) => setMinBaseSalary(Number(e.target.value))}
                placeholder="e.g. 4000000"
              />
            </div>

            <div>
              <label className="text-caption text-text-muted block mb-1">Target Base Salary</label>
              <Input
                type="number"
                value={targetBaseSalary}
                onChange={(e) => setTargetBaseSalary(Number(e.target.value))}
                placeholder="e.g. 6000000"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save Profile & Refresh Recommendations
          </Button>
        </div>
      </div>
    </Modal>
  );
};
