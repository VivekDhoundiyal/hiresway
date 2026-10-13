import React, { useState } from 'react';
import { EducationItem } from '@/core/profile';
import { createEmptyEducation } from '@/core/profile/defaultProfile';
import { Card } from '@/components/card';
import { Typography } from '@/components/typography';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Modal } from '@/components/modal';
import { EmptyState } from '@/components/empty-state';
import { GraduationCap, Plus, Edit2, Trash2, Calendar, Check } from 'lucide-react';

export interface EducationSectionProps {
  items: EducationItem[];
  onSave: (updated: EducationItem[]) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export const EducationSection: React.FC<EducationSectionProps> = ({ items, onSave }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EducationItem | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleOpenAdd = () => {
    setEditingItem(createEmptyEducation());
    setErrors({});
    setModalOpen(true);
  };

  const handleOpenEdit = (item: EducationItem) => {
    setEditingItem({ ...item });
    setErrors({});
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    onSave(items.filter((item) => item.id !== id));
  };

  const validate = (): boolean => {
    if (!editingItem) return false;
    const newErrors: Record<string, string> = {};
    if (!editingItem.institution.trim())
      newErrors.institution = 'Institution name is required';
    if (!editingItem.degree.trim()) newErrors.degree = 'Degree is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveModal = () => {
    if (!editingItem || !validate()) return;

    const exists = items.some((i) => i.id === editingItem.id);
    let updatedList: EducationItem[];
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
    <Card id="education" variant="default" padding="lg" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/70 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary-soft text-primary border border-blue-200/60 shadow-sm shrink-0">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <Typography as="h2" variant="h3" color="primary">
              Education
            </Typography>
            <Typography as="p" variant="body-sm" color="muted">
              Academic credentials, degrees, and university honors
            </Typography>
          </div>
        </div>

        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="h-3.5 w-3.5" />}
          onClick={handleOpenAdd}
        >
          Add Education
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No education records added"
          description="Include your academic background, degree programs, or university coursework."
          action={{
            label: 'Add Education',
            onClick: handleOpenAdd,
          }}
        />
      ) : (
        <div className="relative pl-6 sm:pl-8 before:absolute before:left-3 sm:before:left-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-border/80 space-y-6">
          {items.map((item) => {
            const instInitial = item.institution
              ? item.institution.charAt(0).toUpperCase()
              : 'E';

            return (
              <div key={item.id} className="relative group">
                {/* Academic Timeline Node */}
                <div className="absolute -left-6 sm:-left-8 top-0.5 h-7 w-7 sm:h-8 sm:w-8 -translate-x-1/2 rounded-lg bg-surface border-2 border-primary/40 flex items-center justify-center font-bold text-caption text-primary shadow-xs select-none">
                  {instInitial}
                </div>

                <div className="p-4 sm:p-5 rounded-xl border border-border bg-surface hover:border-border-strong hover:shadow-xs transition-all space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div>
                      <span className="text-body-lg font-bold text-text-primary block">
                        {item.institution}
                      </span>
                      <div className="text-body-md font-semibold text-primary mt-0.5">
                        {item.degree}
                        {item.fieldOfStudy && ` in ${item.fieldOfStudy}`}
                      </div>
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

                  {/* Dates & GPA */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-text-muted">
                    {(item.startDate || item.endDate) && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-text-muted" />
                        <span>
                          {item.startDate} {item.startDate && item.endDate && '—'}{' '}
                          {item.endDate}
                        </span>
                      </div>
                    )}
                    {item.gradeGpa && (
                      <span>
                        GPA:{' '}
                        <strong className="text-text-secondary font-medium">
                          {item.gradeGpa}
                        </strong>
                      </span>
                    )}
                  </div>

                  {/* Activities / Honors */}
                  {item.activitiesAndHonors && (
                    <p className="text-body-sm text-text-secondary pt-1 leading-relaxed">
                      {item.activitiesAndHonors}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Education Modal */}
      {modalOpen && editingItem && (
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={
            editingItem.institution ? `Edit ${editingItem.institution}` : 'Add Education'
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
                Save Education
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <Input
              label="School or Institution *"
              value={editingItem.institution}
              onChange={(e) =>
                setEditingItem({ ...editingItem, institution: e.target.value })
              }
              error={errors.institution}
              placeholder="e.g. Stanford University, MIT"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Degree *"
                value={editingItem.degree}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, degree: e.target.value })
                }
                error={errors.degree}
                placeholder="e.g. Bachelor of Science, Master of Arts"
              />

              <Input
                label="Field of Study"
                value={editingItem.fieldOfStudy}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, fieldOfStudy: e.target.value })
                }
                placeholder="e.g. Computer Science, Economics"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Start Year"
                value={editingItem.startDate}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, startDate: e.target.value })
                }
                placeholder="e.g. 2016"
              />

              <Input
                label="End Year (or Expected)"
                value={editingItem.endDate}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, endDate: e.target.value })
                }
                placeholder="e.g. 2020"
              />

              <Input
                label="GPA / Grade (optional)"
                value={editingItem.gradeGpa}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, gradeGpa: e.target.value })
                }
                placeholder="e.g. 3.8 / 4.0"
              />
            </div>

            <div className="flex flex-col gap-1.5 font-sans">
              <label className="text-body-sm font-medium text-text-secondary">
                Honors, Societies & Activities
              </label>
              <textarea
                rows={2}
                value={editingItem.activitiesAndHonors}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, activitiesAndHonors: e.target.value })
                }
                placeholder="Dean's List, President of Tech Club, Student Government..."
                className="w-full rounded-md bg-surface text-body-md text-text-primary border border-border p-3 outline-none focus:border-primary"
              />
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
};
