import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/modal';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { PersonalInfo } from '@/core/profile';
import { Check, Mail, Phone, MapPin, Globe, Linkedin, Github } from 'lucide-react';

export interface EditPersonalInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: PersonalInfo;
  onSave: (updated: PersonalInfo) => void;
}

export const EditPersonalInfoModal: React.FC<EditPersonalInfoModalProps> = ({
  isOpen,
  onClose,
  data,
  onSave,
}) => {
  const [formData, setFormData] = useState<PersonalInfo>(data);
  const [errors, setErrors] = useState<Partial<Record<keyof PersonalInfo, string>>>({});

  useEffect(() => {
    if (isOpen) {
      setFormData(data);
      setErrors({});
    }
  }, [isOpen, data]);

  const handleChange = (field: keyof PersonalInfo, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof PersonalInfo, string>> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave(formData);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Personal Information"
      description="Update your contact details, professional headline, and external portfolio links."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Core Identity */}
        <div className="space-y-4">
          <h4 className="text-body-sm font-semibold text-text-primary uppercase tracking-wider">
            Primary Identity
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Name *"
              placeholder="e.g. Alex Morgan"
              value={formData.fullName}
              onChange={(e) => handleChange('fullName', e.target.value)}
              error={errors.fullName}
            />

            <Input
              label="Professional Headline"
              placeholder="e.g. Senior Full-Stack Engineer & Architect"
              value={formData.headline}
              onChange={(e) => handleChange('headline', e.target.value)}
            />
          </div>
        </div>

        {/* Contact Channels */}
        <div className="space-y-4 pt-4 border-t border-border">
          <h4 className="text-body-sm font-semibold text-text-primary uppercase tracking-wider">
            Contact Details
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Email Address *"
              type="email"
              placeholder="name@example.com"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              error={errors.email}
              leftIcon={<Mail className="h-4 w-4" />}
            />

            <Input
              label="Phone Number"
              placeholder="+1 (555) 000-0000"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              leftIcon={<Phone className="h-4 w-4" />}
            />
          </div>
        </div>

        {/* Location */}
        <div className="space-y-4 pt-4 border-t border-border">
          <h4 className="text-body-sm font-semibold text-text-primary uppercase tracking-wider">
            Location
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="City"
              placeholder="San Francisco"
              value={formData.city}
              onChange={(e) => handleChange('city', e.target.value)}
              leftIcon={<MapPin className="h-4 w-4" />}
            />

            <Input
              label="State / Province"
              placeholder="CA"
              value={formData.stateProvince}
              onChange={(e) => handleChange('stateProvince', e.target.value)}
            />

            <Input
              label="Country"
              placeholder="United States"
              value={formData.country}
              onChange={(e) => handleChange('country', e.target.value)}
            />
          </div>
        </div>

        {/* Links & Profiles */}
        <div className="space-y-4 pt-4 border-t border-border">
          <h4 className="text-body-sm font-semibold text-text-primary uppercase tracking-wider">
            Online Presence & Links
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="LinkedIn URL"
              placeholder="https://linkedin.com/in/username"
              value={formData.linkedinUrl}
              onChange={(e) => handleChange('linkedinUrl', e.target.value)}
              leftIcon={<Linkedin className="h-4 w-4" />}
            />

            <Input
              label="GitHub URL"
              placeholder="https://github.com/username"
              value={formData.githubUrl}
              onChange={(e) => handleChange('githubUrl', e.target.value)}
              leftIcon={<Github className="h-4 w-4" />}
            />

            <Input
              label="Portfolio Website"
              placeholder="https://myportfolio.dev"
              value={formData.portfolioUrl}
              onChange={(e) => handleChange('portfolioUrl', e.target.value)}
              leftIcon={<Globe className="h-4 w-4" />}
            />

            <Input
              label="Personal Website / Blog"
              placeholder="https://myblog.com"
              value={formData.websiteUrl}
              onChange={(e) => handleChange('websiteUrl', e.target.value)}
              leftIcon={<Globe className="h-4 w-4" />}
            />
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            leftIcon={<Check className="h-4 w-4" />}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};
