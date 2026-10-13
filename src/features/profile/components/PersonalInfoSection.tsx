import React, { useState, useEffect } from 'react';
import { PersonalInfo } from '@/core/profile';
import { Card } from '@/components/card';
import { Typography } from '@/components/typography';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Globe,
  Linkedin,
  Github,
  Edit2,
  Check,
  X,
  Camera,
  Trash2,
} from 'lucide-react';
import { ProfilePictureModal } from './ProfilePictureModal';

export interface PersonalInfoSectionProps {
  data: PersonalInfo;
  onSave: (updated: PersonalInfo) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export const PersonalInfoSection: React.FC<PersonalInfoSectionProps> = ({
  data,
  onSave,
  onDirtyChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<PersonalInfo>(data);
  const [errors, setErrors] = useState<Partial<Record<keyof PersonalInfo, string>>>({});
  const [isPicModalOpen, setIsPicModalOpen] = useState(false);

  // Sync external data changes (e.g. from Resume Import)
  useEffect(() => {
    if (!isEditing) {
      setFormData(data);
    }
  }, [data, isEditing]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof PersonalInfo, string>> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleStartEdit = () => {
    setFormData(data);
    setErrors({});
    setIsEditing(true);
    onDirtyChange?.(true);
  };

  const handleCancel = () => {
    setFormData(data);
    setErrors({});
    setIsEditing(false);
    onDirtyChange?.(false);
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave(formData);
    setIsEditing(false);
    onDirtyChange?.(false);
  };

  const handleSaveAvatar = (avatarUrl: string) => {
    const updated = { ...data, avatarUrl };
    setFormData(updated);
    onSave(updated);
  };

  const handleRemoveAvatar = () => {
    const updated = { ...data, avatarUrl: undefined };
    setFormData(updated);
    onSave(updated);
  };

  const handleChange = (field: keyof PersonalInfo, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const formattedLocation = [data.city, data.stateProvince, data.country]
    .filter(Boolean)
    .join(', ');

  return (
    <Card id="personal-info" variant="default" padding="lg" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/70 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary-soft text-primary border border-blue-200/60 shadow-sm shrink-0">
            <User className="h-5 w-5" />
          </div>
          <div>
            <Typography as="h2" variant="h3" color="primary">
              Personal Information
            </Typography>
            <Typography as="p" variant="body-sm" color="muted">
              Your primary identity, contact channels, and portfolio links
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

      {/* Profile Photo Management Bar */}
      <div className="p-4 rounded-xl bg-surface-subtle/70 border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            {data.avatarUrl ? (
              <img
                src={data.avatarUrl}
                alt={data.fullName || 'User'}
                className="h-16 w-16 rounded-full object-cover border-2 border-primary shadow-xs"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-primary-soft text-primary border border-blue-200 flex items-center justify-center font-bold text-xl shadow-xs">
                {data.fullName ? (
                  data.fullName.charAt(0).toUpperCase()
                ) : (
                  <User className="h-7 w-7" />
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsPicModalOpen(true)}
              className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-surface border border-border text-text-secondary hover:text-primary hover:border-primary shadow-xs transition-colors cursor-pointer"
              title="Upload photo"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
          </div>

          <div>
            <span className="text-body-sm font-semibold text-text-primary block">
              Profile Photo
            </span>
            <span className="text-caption text-text-muted block">
              {data.avatarUrl
                ? 'Custom photo active across CareerOs'
                : 'Upload a picture for your career profile, resumes, and accounts.'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            leftIcon={<Camera className="h-3.5 w-3.5" />}
            onClick={() => setIsPicModalOpen(true)}
          >
            {data.avatarUrl ? 'Change Photo' : 'Upload Photo'}
          </Button>

          {data.avatarUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leftIcon={<Trash2 className="h-3.5 w-3.5 text-red-500" />}
              onClick={handleRemoveAvatar}
            >
              Remove
            </Button>
          )}
        </div>
      </div>

      {/* Edit Form */}
      {isEditing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Name *"
              value={formData.fullName}
              onChange={(e) => handleChange('fullName', e.target.value)}
              error={errors.fullName}
              placeholder="e.g. Alex Morgan"
            />

            <Input
              label="Professional Headline"
              value={formData.headline}
              onChange={(e) => handleChange('headline', e.target.value)}
              helperText="Short tagline summarizing your expertise"
              placeholder="e.g. Senior Frontend Architect | React & TypeScript"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Email Address *"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              error={errors.email}
              placeholder="alex@example.com"
              leftIcon={<Mail className="h-4 w-4" />}
            />

            <Input
              label="Phone Number (optional)"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="+1 (555) 000-0000"
              leftIcon={<Phone className="h-4 w-4" />}
            />
          </div>

          {/* Location Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="City"
              value={formData.city}
              onChange={(e) => handleChange('city', e.target.value)}
              placeholder="San Francisco"
            />
            <Input
              label="State / Province"
              value={formData.stateProvince}
              onChange={(e) => handleChange('stateProvince', e.target.value)}
              placeholder="CA"
            />
            <Input
              label="Country"
              value={formData.country}
              onChange={(e) => handleChange('country', e.target.value)}
              placeholder="United States"
            />
          </div>

          {/* Links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="LinkedIn URL"
              value={formData.linkedinUrl}
              onChange={(e) => handleChange('linkedinUrl', e.target.value)}
              placeholder="https://linkedin.com/in/username"
              leftIcon={<Linkedin className="h-4 w-4" />}
            />
            <Input
              label="GitHub URL"
              value={formData.githubUrl}
              onChange={(e) => handleChange('githubUrl', e.target.value)}
              placeholder="https://github.com/username"
              leftIcon={<Github className="h-4 w-4" />}
            />
            <Input
              label="Portfolio URL"
              value={formData.portfolioUrl}
              onChange={(e) => handleChange('portfolioUrl', e.target.value)}
              placeholder="https://yourportfolio.dev"
              leftIcon={<Globe className="h-4 w-4" />}
            />
            <Input
              label="Personal Website"
              value={formData.websiteUrl}
              onChange={(e) => handleChange('websiteUrl', e.target.value)}
              placeholder="https://yourblog.com"
              leftIcon={<Globe className="h-4 w-4" />}
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
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
            <div>
              <Typography
                as="h3"
                variant="h2"
                color="primary"
                className="text-xl font-bold"
              >
                {data.fullName || 'Name Not Specified'}
              </Typography>
              <Typography
                as="p"
                variant="body-md"
                color="secondary"
                className="mt-0.5 text-text-secondary"
              >
                {data.headline || 'No professional headline added yet.'}
              </Typography>
            </div>
            {formattedLocation && (
              <div className="flex items-center gap-1 text-caption text-text-muted">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span>{formattedLocation}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 text-body-sm">
            <div className="flex items-center gap-2 p-2.5 rounded-md bg-surface-subtle border border-border/60">
              <Mail className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate text-text-primary">
                {data.email || 'No email'}
              </span>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-md bg-surface-subtle border border-border/60">
              <Phone className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate text-text-primary">
                {data.phone || 'No phone'}
              </span>
            </div>

            {data.linkedinUrl ? (
              <a
                href={data.linkedinUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 p-2.5 rounded-md bg-surface-subtle border border-border/60 text-primary hover:border-primary transition-colors"
              >
                <Linkedin className="h-4 w-4 shrink-0" />
                <span className="truncate">LinkedIn</span>
              </a>
            ) : (
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-surface-subtle border border-border/60 text-text-muted">
                <Linkedin className="h-4 w-4 shrink-0" />
                <span className="truncate">LinkedIn —</span>
              </div>
            )}

            {data.githubUrl ? (
              <a
                href={data.githubUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 p-2.5 rounded-md bg-surface-subtle border border-border/60 text-primary hover:border-primary transition-colors"
              >
                <Github className="h-4 w-4 shrink-0" />
                <span className="truncate">GitHub</span>
              </a>
            ) : (
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-surface-subtle border border-border/60 text-text-muted">
                <Github className="h-4 w-4 shrink-0" />
                <span className="truncate">GitHub —</span>
              </div>
            )}
          </div>

          {data.portfolioUrl && (
            <div className="flex items-center gap-2 text-body-sm pt-1">
              <Globe className="h-4 w-4 text-text-muted" />
              <span className="text-text-muted">Portfolio:</span>
              <a
                href={data.portfolioUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline font-medium truncate"
              >
                {data.portfolioUrl}
              </a>
            </div>
          )}
        </div>
      )}

      {/* Interactive Photo Crop Modal */}
      <ProfilePictureModal
        isOpen={isPicModalOpen}
        onClose={() => setIsPicModalOpen(false)}
        onSave={handleSaveAvatar}
      />
    </Card>
  );
};
