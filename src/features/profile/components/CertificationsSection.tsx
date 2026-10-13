import React, { useState } from 'react';
import { CertificationItem } from '@/core/profile';
import { createEmptyCertification } from '@/core/profile/defaultProfile';
import { Card } from '@/components/card';
import { Typography } from '@/components/typography';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Modal } from '@/components/modal';
import { EmptyState } from '@/components/empty-state';
import { Award, Plus, Edit2, Trash2, Calendar, ExternalLink, Check } from 'lucide-react';

export interface CertificationsSectionProps {
  items: CertificationItem[];
  onSave: (updated: CertificationItem[]) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export const CertificationsSection: React.FC<CertificationsSectionProps> = ({
  items,
  onSave,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CertificationItem | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleOpenAdd = () => {
    setEditingItem(createEmptyCertification());
    setErrors({});
    setModalOpen(true);
  };

  const handleOpenEdit = (item: CertificationItem) => {
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
    if (!editingItem.name.trim()) newErrors.name = 'Certification name is required';
    if (!editingItem.issuingOrganization.trim()) {
      newErrors.issuingOrganization = 'Issuing organization is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveModal = () => {
    if (!editingItem || !validate()) return;

    const exists = items.some((i) => i.id === editingItem.id);
    let updatedList: CertificationItem[];
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
    <Card id="certifications" variant="default" padding="lg" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/70 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary-soft text-primary border border-blue-200/60 shadow-sm shrink-0">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <Typography as="h2" variant="h3" color="primary">
              Certifications & Credentials
            </Typography>
            <Typography as="p" variant="body-sm" color="muted">
              Professional licenses, cloud accreditations, and verified credentials
            </Typography>
          </div>
        </div>

        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="h-3.5 w-3.5" />}
          onClick={handleOpenAdd}
        >
          Add Credential
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Award}
          title="No certifications added"
          description="Highlight your certified expertise (e.g. AWS, PMP, Google Cloud, CISSP)."
          action={{
            label: 'Add Certification',
            onClick: handleOpenAdd,
          }}
        />
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-4 sm:p-5 rounded-lg border border-border bg-surface hover:border-border-strong transition-colors space-y-2.5"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div>
                  <span className="text-body-lg font-bold text-text-primary">
                    {item.name}
                  </span>
                  <span className="text-body-md font-medium text-primary block mt-0.5">
                    {item.issuingOrganization}
                  </span>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-start shrink-0">
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

              <div className="flex flex-wrap items-center gap-4 text-caption text-text-muted">
                {item.issueDate && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      Issued {item.issueDate}
                      {item.doesNotExpire
                        ? ' • Does not expire'
                        : item.expirationDate && ` • Expires ${item.expirationDate}`}
                    </span>
                  </div>
                )}
                {item.credentialId && <span>ID: {item.credentialId}</span>}
              </div>

              {item.credentialUrl && (
                <div className="pt-1">
                  <a
                    href={item.credentialUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-caption font-medium text-primary hover:underline"
                  >
                    <span>Verify Credential</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Certification Modal */}
      {modalOpen && editingItem && (
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingItem.name ? `Edit Credential` : 'Add Certification'}
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
                Save Credential
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <Input
              label="Certification Name *"
              value={editingItem.name}
              onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
              error={errors.name}
              placeholder="e.g. AWS Certified Solutions Architect"
            />

            <Input
              label="Issuing Organization *"
              value={editingItem.issuingOrganization}
              onChange={(e) =>
                setEditingItem({ ...editingItem, issuingOrganization: e.target.value })
              }
              error={errors.issuingOrganization}
              placeholder="e.g. Amazon Web Services, Scrum Alliance"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Issue Date"
                value={editingItem.issueDate}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, issueDate: e.target.value })
                }
                placeholder="YYYY-MM (e.g. 2023-04)"
              />

              <Input
                label="Expiration Date"
                value={editingItem.doesNotExpire ? '' : editingItem.expirationDate}
                disabled={editingItem.doesNotExpire}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, expirationDate: e.target.value })
                }
                placeholder="YYYY-MM (e.g. 2026-04)"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-body-sm text-text-primary select-none">
              <input
                type="checkbox"
                checked={editingItem.doesNotExpire}
                onChange={(e) =>
                  setEditingItem({
                    ...editingItem,
                    doesNotExpire: e.target.checked,
                    expirationDate: e.target.checked ? '' : editingItem.expirationDate,
                  })
                }
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <span>This credential does not expire</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Credential ID (optional)"
                value={editingItem.credentialId}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, credentialId: e.target.value })
                }
                placeholder="e.g. AWS-12345"
              />

              <Input
                label="Verification URL (optional)"
                value={editingItem.credentialUrl}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, credentialUrl: e.target.value })
                }
                placeholder="https://..."
              />
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
};
