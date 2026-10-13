import React, { useState } from 'react';
import { WorkExperienceItem } from '@/core/profile';
import { createEmptyExperience } from '@/core/profile/defaultProfile';
import { Card } from '@/components/card';
import { Typography } from '@/components/typography';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Badge } from '@/components/badge';
import { Modal } from '@/components/modal';
import { EmptyState } from '@/components/empty-state';
import { Briefcase, Plus, Edit2, Trash2, Calendar, MapPin, Check, X } from 'lucide-react';

export interface WorkExperienceSectionProps {
  items: WorkExperienceItem[];
  onSave: (updated: WorkExperienceItem[]) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

function formatMonthYear(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  if (parts.length >= 2) {
    const m = parseInt(parts[1], 10);
    if (m >= 1 && m <= 12) {
      return `${months[m - 1]} ${parts[0]}`;
    }
  }
  return dateStr;
}

function calculateDuration(startStr: string, endStr: string, isCurrent: boolean): string {
  if (!startStr) return '';
  const parseYearMonth = (s: string) => {
    const parts = s.split('-');
    const y = parseInt(parts[0], 10);
    const m = parts.length > 1 ? parseInt(parts[1], 10) : 1;
    return isNaN(y) ? null : { y, m: isNaN(m) ? 1 : m };
  };

  const start = parseYearMonth(startStr);
  if (!start) return '';

  const end =
    isCurrent || !endStr
      ? { y: new Date().getFullYear(), m: new Date().getMonth() + 1 }
      : parseYearMonth(endStr);
  if (!end) return '';

  const totalMonths = Math.max(1, (end.y - start.y) * 12 + (end.m - start.m) + 1);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  if (years > 0 && months > 0)
    return `${years} yr${years > 1 ? 's' : ''} ${months} mo${months > 1 ? 's' : ''}`;
  if (years > 0) return `${years} yr${years > 1 ? 's' : ''}`;
  return `${months} mo${months > 1 ? 's' : ''}`;
}

export const WorkExperienceSection: React.FC<WorkExperienceSectionProps> = ({
  items,
  onSave,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WorkExperienceItem | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newSkill, setNewSkill] = useState('');
  const [newAchievement, setNewAchievement] = useState('');

  const handleOpenAdd = () => {
    setEditingItem(createEmptyExperience());
    setErrors({});
    setNewSkill('');
    setNewAchievement('');
    setModalOpen(true);
  };

  const handleOpenEdit = (item: WorkExperienceItem) => {
    setEditingItem({ ...item });
    setErrors({});
    setNewSkill('');
    setNewAchievement('');
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    onSave(items.filter((item) => item.id !== id));
  };

  const validate = (): boolean => {
    if (!editingItem) return false;
    const newErrors: Record<string, string> = {};
    if (!editingItem.company.trim()) newErrors.company = 'Company is required';
    if (!editingItem.title.trim()) newErrors.title = 'Job title is required';
    if (!editingItem.startDate.trim()) newErrors.startDate = 'Start date is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveModal = () => {
    if (!editingItem || !validate()) return;

    const exists = items.some((i) => i.id === editingItem.id);
    let updatedList: WorkExperienceItem[];
    if (exists) {
      updatedList = items.map((i) => (i.id === editingItem.id ? editingItem : i));
    } else {
      updatedList = [editingItem, ...items];
    }

    onSave(updatedList);
    setModalOpen(false);
    setEditingItem(null);
  };

  return (
    <Card id="experience" variant="default" padding="lg" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/70 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary-soft text-primary border border-blue-200/60 shadow-sm shrink-0">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <Typography as="h2" variant="h3" color="primary">
              Work Experience
            </Typography>
            <Typography as="p" variant="body-sm" color="muted">
              Career history, key impact achievements, and technologies used
            </Typography>
          </div>
        </div>

        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="h-3.5 w-3.5" />}
          onClick={handleOpenAdd}
        >
          Add Experience
        </Button>
      </div>

      {/* Experience List */}
      {items.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No work experience added"
          description="Document your employment milestones. Every role added here can be selected when tailoring resumes or applications."
          action={{
            label: 'Add First Experience',
            onClick: handleOpenAdd,
          }}
        />
      ) : (
        <div className="relative pl-6 sm:pl-8 before:absolute before:left-3 sm:before:left-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-border/80 space-y-6">
          {items.map((item) => {
            const formattedStart = formatMonthYear(item.startDate);
            const formattedEnd = item.isCurrent
              ? 'Present'
              : formatMonthYear(item.endDate) || 'Present';
            const duration = calculateDuration(
              item.startDate,
              item.endDate,
              item.isCurrent
            );
            const companyInitial = item.company
              ? item.company.charAt(0).toUpperCase()
              : 'W';

            return (
              <div key={item.id} className="relative group">
                {/* Timeline node / Company Monogram */}
                <div className="absolute -left-6 sm:-left-8 top-0.5 h-7 w-7 sm:h-8 sm:w-8 -translate-x-1/2 rounded-lg bg-surface border-2 border-primary/40 flex items-center justify-center font-bold text-caption text-primary shadow-xs select-none">
                  {companyInitial}
                </div>

                <div className="p-4 sm:p-5 rounded-xl border border-border bg-surface hover:border-border-strong hover:shadow-xs transition-all space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-body-lg font-bold text-text-primary">
                          {item.title.replace(/\s*\[Entrepreneurial\]/g, '')}
                        </span>
                        {item.title.includes('[Entrepreneurial]') && (
                          <Badge variant="accent" size="sm">
                            Entrepreneurial Venture
                          </Badge>
                        )}
                        <Badge variant={item.isCurrent ? 'success' : 'neutral'} size="sm">
                          {item.isCurrent ? 'Current' : item.employmentType}
                        </Badge>
                        <Badge variant="neutral" size="sm" className="capitalize">
                          {item.locationType}
                        </Badge>
                      </div>
                      <span className="text-body-md font-semibold text-primary block mt-0.5">
                        {item.company}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-start shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<Edit2 className="h-3.5 w-3.5" />}
                        onClick={() => handleOpenEdit(item)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-error hover:bg-error-soft"
                        leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                        onClick={() => handleDelete(item.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>

                  {/* Dates, Duration & Location */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-text-muted">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-text-muted" />
                      <span>
                        {formattedStart} — {formattedEnd}
                        {duration && (
                          <span className="text-text-secondary font-medium ml-1">
                            · {duration}
                          </span>
                        )}
                      </span>
                    </div>
                    {item.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-text-muted" />
                        <span>{item.location}</span>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {item.description && (
                    <p className="text-body-sm text-text-secondary whitespace-pre-line leading-relaxed">
                      {item.description}
                    </p>
                  )}

                  {/* Achievements */}
                  {item.keyAchievements && item.keyAchievements.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-caption font-semibold uppercase text-text-muted tracking-wider block">
                        Key Achievements
                      </span>
                      <ul className="space-y-1.5 text-body-sm text-text-secondary">
                        {item.keyAchievements.map((ach, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
                            <span>{ach}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Skills Used */}
                  {item.skillsUsed && item.skillsUsed.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/60">
                      {item.skillsUsed.map((skill) => (
                        <Badge key={skill} variant="neutral" size="sm">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Experience Modal */}
      {modalOpen && editingItem && (
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={
            editingItem.company
              ? `Edit Experience at ${editingItem.company}`
              : 'Add Work Experience'
          }
          size="lg"
          footer={
            <div className="flex items-center justify-end gap-3 w-full">
              <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Check className="h-4 w-4" />}
                onClick={handleSaveModal}
              >
                Save Experience
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Company Name *"
                value={editingItem.company}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, company: e.target.value })
                }
                error={errors.company}
                placeholder="e.g. Stripe, Acme Corp"
              />

              <Input
                label="Job Title *"
                value={editingItem.title}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, title: e.target.value })
                }
                error={errors.title}
                placeholder="e.g. Lead Frontend Architect"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5 font-sans">
                <label className="text-body-sm font-medium text-text-secondary">
                  Employment Type
                </label>
                <select
                  value={editingItem.employmentType}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      employmentType: e.target
                        .value as WorkExperienceItem['employmentType'],
                    })
                  }
                  className="h-10 rounded-md bg-surface text-body-md text-text-primary border border-border px-3 outline-none focus:border-primary"
                >
                  <option value="full-time">Full-time</option>
                  <option value="part-time">Part-time</option>
                  <option value="contract">Contract</option>
                  <option value="freelance">Freelance</option>
                  <option value="internship">Internship</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5 font-sans">
                <label className="text-body-sm font-medium text-text-secondary">
                  Workplace Setting
                </label>
                <select
                  value={editingItem.locationType}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      locationType: e.target.value as WorkExperienceItem['locationType'],
                    })
                  }
                  className="h-10 rounded-md bg-surface text-body-md text-text-primary border border-border px-3 outline-none focus:border-primary"
                >
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="on-site">On-site</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Location (City, Country)"
                value={editingItem.location}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, location: e.target.value })
                }
                placeholder="e.g. New York, NY"
              />

              <Input
                label="Start Date *"
                value={editingItem.startDate}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, startDate: e.target.value })
                }
                placeholder="YYYY-MM (e.g. 2021-03)"
                error={errors.startDate}
              />

              <Input
                label="End Date"
                value={editingItem.isCurrent ? '' : editingItem.endDate}
                disabled={editingItem.isCurrent}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, endDate: e.target.value })
                }
                placeholder="YYYY-MM (e.g. 2023-11)"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-body-sm text-text-primary select-none">
              <input
                type="checkbox"
                checked={editingItem.isCurrent}
                onChange={(e) =>
                  setEditingItem({
                    ...editingItem,
                    isCurrent: e.target.checked,
                    endDate: e.target.checked ? '' : editingItem.endDate,
                  })
                }
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <span>I currently work here</span>
            </label>

            <div className="flex flex-col gap-1.5 font-sans">
              <label className="text-body-sm font-medium text-text-secondary">
                Role Description & Overview
              </label>
              <textarea
                rows={3}
                value={editingItem.description}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, description: e.target.value })
                }
                placeholder="Summarize your primary team responsibilities, scope, and engineering ownership..."
                className="w-full rounded-md bg-surface text-body-md text-text-primary border border-border p-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Achievements */}
            <div className="space-y-2 pt-1 border-t border-border/60">
              <label className="text-body-sm font-semibold text-text-primary block">
                Key Accomplishments & Metrics
              </label>
              <div className="space-y-1.5">
                {editingItem.keyAchievements?.map((ach, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-body-sm text-text-secondary flex-1">
                      • {ach}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingItem({
                          ...editingItem,
                          keyAchievements: editingItem.keyAchievements.filter(
                            (_, i) => i !== idx
                          ),
                        })
                      }
                      className="p-1 text-text-muted hover:text-error"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Add an achievement (e.g. Optimized database queries saving 200ms)..."
                    value={newAchievement}
                    onChange={(e) => setNewAchievement(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newAchievement.trim()) {
                          setEditingItem({
                            ...editingItem,
                            keyAchievements: [
                              ...(editingItem.keyAchievements || []),
                              newAchievement.trim(),
                            ],
                          });
                          setNewAchievement('');
                        }
                      }
                    }}
                    className="flex-1 h-9 rounded-md bg-surface text-body-sm text-text-primary border border-border px-3 outline-none focus:border-primary"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (newAchievement.trim()) {
                        setEditingItem({
                          ...editingItem,
                          keyAchievements: [
                            ...(editingItem.keyAchievements || []),
                            newAchievement.trim(),
                          ],
                        });
                        setNewAchievement('');
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>

            {/* Skills Used */}
            <div className="space-y-2 pt-1 border-t border-border/60">
              <label className="text-body-sm font-semibold text-text-primary block">
                Technologies / Skills Used
              </label>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {editingItem.skillsUsed?.map((sk) => (
                  <Badge key={sk} variant="neutral" size="sm">
                    <span>{sk}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingItem({
                          ...editingItem,
                          skillsUsed: editingItem.skillsUsed.filter((s) => s !== sk),
                        })
                      }
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
                  placeholder="Tag a skill (e.g. React, PostgreSQL)..."
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (
                        newSkill.trim() &&
                        !editingItem.skillsUsed?.includes(newSkill.trim())
                      ) {
                        setEditingItem({
                          ...editingItem,
                          skillsUsed: [
                            ...(editingItem.skillsUsed || []),
                            newSkill.trim(),
                          ],
                        });
                        setNewSkill('');
                      }
                    }
                  }}
                  className="flex-1 h-9 rounded-md bg-surface text-body-sm text-text-primary border border-border px-3 outline-none focus:border-primary"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (
                      newSkill.trim() &&
                      !editingItem.skillsUsed?.includes(newSkill.trim())
                    ) {
                      setEditingItem({
                        ...editingItem,
                        skillsUsed: [...(editingItem.skillsUsed || []), newSkill.trim()],
                      });
                      setNewSkill('');
                    }
                  }}
                >
                  Tag
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
};
