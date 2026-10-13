import React, { useState, useRef, useEffect } from 'react';
import { PersonalInfo, AvailabilityStatus } from '@/core/profile';
import { Card } from '@/components/card';
import { Button } from '@/components/button';
import { Badge } from '@/components/badge';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Globe,
  Linkedin,
  Github,
  Camera,
  Edit2,
  Upload,
  FileJson,
  ExternalLink,
  ChevronDown,
  Check,
} from 'lucide-react';
import { ProfilePictureModal } from './ProfilePictureModal';
import { BannerUploadModal } from './BannerUploadModal';
import { EditPersonalInfoModal } from './EditPersonalInfoModal';

export interface ProfileHeroHeaderProps {
  personalInfo: PersonalInfo;
  availabilityStatus: string;
  completionScore: number;
  onSavePersonalInfo: (updated: PersonalInfo) => void;
  onUpdateAvailabilityStatus?: (status: AvailabilityStatus) => void;
  onOpenResumeImport: () => void;
  onOpenDataBackup: () => void;
}

export const ProfileHeroHeader: React.FC<ProfileHeroHeaderProps> = ({
  personalInfo,
  availabilityStatus,
  completionScore,
  onSavePersonalInfo,
  onUpdateAvailabilityStatus,
  onOpenResumeImport,
  onOpenDataBackup,
}) => {
  const [isPicModalOpen, setIsPicModalOpen] = useState(false);
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
    };
    if (isStatusDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isStatusDropdownOpen]);

  const handleSaveAvatar = (avatarUrl: string) => {
    onSavePersonalInfo({ ...personalInfo, avatarUrl });
  };

  const handleRemoveAvatar = () => {
    onSavePersonalInfo({ ...personalInfo, avatarUrl: undefined });
  };

  const handleSaveBanner = (bannerUrl: string) => {
    onSavePersonalInfo({ ...personalInfo, bannerUrl });
  };

  const handleRemoveBanner = () => {
    onSavePersonalInfo({ ...personalInfo, bannerUrl: undefined });
  };

  const formatSearchStatus = (status: string) => {
    switch (status) {
      case 'actively_interviewing':
        return 'Actively Interviewing';
      case 'open_to_offers':
        return 'Open to Offers';
      case 'casually_browsing':
        return 'Casually Browsing';
      case 'not_looking':
        return 'Not Looking';
      default:
        return 'Open to Opportunities';
    }
  };

  const formattedLocation = [
    personalInfo.city,
    personalInfo.stateProvince,
    personalInfo.country,
  ]
    .filter(Boolean)
    .join(', ');

  const formatUrlForDisplay = (url: string) => {
    return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  };

  return (
    <Card
      id="personal-info"
      variant="default"
      padding="none"
      className="overflow-hidden border border-border shadow-xs"
    >
      {/* Cover Banner Area */}
      <div className="relative h-44 sm:h-56 md:h-64 w-full bg-slate-800 overflow-hidden group">
        {personalInfo.bannerUrl ? (
          <img
            src={personalInfo.bannerUrl}
            alt="Profile Cover"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-blue-900 via-slate-800 to-indigo-900 relative">
            {/* Subtle decorative grid/pattern */}
            <div
              className="absolute inset-0 opacity-15"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)',
                backgroundSize: '24px 24px',
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </div>
        )}

        {/* Banner Edit Trigger */}
        <button
          type="button"
          onClick={() => setIsBannerModalOpen(true)}
          className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface/90 hover:bg-surface text-text-primary text-body-sm font-medium shadow-sm backdrop-blur-xs border border-border/80 transition-all cursor-pointer group/btn"
          title="Update cover photo"
        >
          <Camera className="h-4 w-4 text-text-secondary group-hover/btn:text-primary transition-colors" />
          <span className="hidden sm:inline">
            {personalInfo.bannerUrl ? 'Change Cover' : 'Add Cover Photo'}
          </span>
        </button>
      </div>

      {/* Hero Profile Body */}
      <div className="px-6 pb-6 pt-0">
        {/* Avatar & Action Buttons Row */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-14 sm:-mt-16 mb-4">
          {/* Circular Avatar with Camera Hover Overlay */}
          <div className="relative group/avatar self-start z-10">
            <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-full border-4 border-surface shadow-md bg-surface overflow-hidden flex items-center justify-center relative">
              {personalInfo.avatarUrl ? (
                <img
                  src={personalInfo.avatarUrl}
                  alt={personalInfo.fullName || 'User Avatar'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-primary-soft text-primary flex items-center justify-center font-bold text-3xl select-none">
                  {personalInfo.fullName ? (
                    personalInfo.fullName.charAt(0).toUpperCase()
                  ) : (
                    <User className="h-12 w-12 text-primary/70" />
                  )}
                </div>
              )}

              {/* Hover Camera Trigger Overlay */}
              <button
                type="button"
                onClick={() => setIsPicModalOpen(true)}
                className="absolute inset-0 bg-slate-900/50 text-white flex flex-col items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer focus:opacity-100"
                title="Update profile picture"
                aria-label="Update profile picture"
              >
                <Camera className="h-6 w-6 mb-1" />
                <span className="text-[10px] font-medium tracking-tight">Edit</span>
              </button>
            </div>

            {/* Mobile-visible camera badge */}
            <button
              type="button"
              onClick={() => setIsPicModalOpen(true)}
              className="sm:hidden absolute bottom-1 right-1 p-2 rounded-full bg-primary text-white shadow-md border-2 border-surface"
              title="Edit photo"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2 sm:pt-0">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Edit2 className="h-3.5 w-3.5" />}
              onClick={() => setIsEditModalOpen(true)}
            >
              Edit Profile
            </Button>

            <Button
              variant="outline"
              size="sm"
              leftIcon={<FileJson className="h-3.5 w-3.5 text-text-muted" />}
              onClick={onOpenDataBackup}
            >
              Data & Backup
            </Button>

            <Button
              variant="primary"
              size="sm"
              leftIcon={<Upload className="h-3.5 w-3.5" />}
              onClick={onOpenResumeImport}
            >
              Import Resume
            </Button>
          </div>
        </div>

        {/* Identity Details */}
        <div className="space-y-3">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-h2 sm:text-h1 font-bold text-text-primary tracking-tight">
                {personalInfo.fullName || 'Your Name'}
              </h1>

              {/* Interactive Search Preference Selector */}
              <div className="relative inline-block" ref={statusRef}>
                <button
                  type="button"
                  onClick={() => setIsStatusDropdownOpen((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-caption font-semibold border transition-all cursor-pointer select-none ${
                    availabilityStatus === 'actively_interviewing'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                      : availabilityStatus === 'open_to_offers'
                        ? 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100'
                        : availabilityStatus === 'casually_browsing'
                          ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                          : 'bg-surface-subtle text-text-secondary border-border hover:bg-surface'
                  }`}
                  title="Click to update your job search status and platform matching priority"
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      availabilityStatus === 'actively_interviewing'
                        ? 'bg-emerald-500'
                        : availabilityStatus === 'open_to_offers'
                          ? 'bg-blue-500'
                          : availabilityStatus === 'casually_browsing'
                            ? 'bg-amber-500'
                            : 'bg-slate-400'
                    }`}
                  />
                  <span>{formatSearchStatus(availabilityStatus)}</span>
                  <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
                </button>

                {isStatusDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1.5 w-72 bg-surface rounded-xl border border-border shadow-lg py-1.5 z-40 animate-fadeIn divide-y divide-border/50">
                    <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-text-muted">
                      Job Search Status & Priority
                    </div>
                    <div className="py-1">
                      {([
                        {
                          value: 'actively_interviewing' as const,
                          label: 'Actively Interviewing',
                          description: 'Priority matches and fast application pacing',
                          dotColor: 'bg-emerald-500',
                        },
                        {
                          value: 'open_to_offers' as const,
                          label: 'Open to Offers',
                          description: 'Standard recommendations and recruiter outreach',
                          dotColor: 'bg-blue-500',
                        },
                        {
                          value: 'casually_browsing' as const,
                          label: 'Casually Browsing',
                          description: 'Passive discovery and compensation benchmarking',
                          dotColor: 'bg-amber-500',
                        },
                        {
                          value: 'not_looking' as const,
                          label: 'Not Looking',
                          description: 'Paused automated feed alerts and reminders',
                          dotColor: 'bg-slate-400',
                        },
                      ]).map((opt) => {
                        const isSelected = availabilityStatus === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              onUpdateAvailabilityStatus?.(opt.value);
                              setIsStatusDropdownOpen(false);
                            }}
                            className={`w-full px-3 py-2 text-left flex items-start gap-2.5 hover:bg-surface-subtle transition-colors cursor-pointer ${
                              isSelected ? 'bg-primary-soft/60' : ''
                            }`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${opt.dotColor}`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span
                                  className={`text-body-sm ${
                                    isSelected
                                      ? 'font-bold text-primary'
                                      : 'font-medium text-text-primary'
                                  }`}
                                >
                                  {opt.label}
                                </span>
                                {isSelected && (
                                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                                )}
                              </div>
                              <p className="text-caption text-text-muted leading-tight mt-0.5">
                                {opt.description}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <Badge variant={completionScore >= 80 ? 'accent' : 'primary'} size="sm">
                Profile Strength: {completionScore}%
              </Badge>
            </div>

            {personalInfo.headline && (
              <p className="text-body-lg text-text-secondary mt-1 font-medium leading-snug max-w-3xl">
                {personalInfo.headline}
              </p>
            )}
          </div>

          {/* Location & Contact Channels */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-body-sm text-text-secondary pt-1">
            {formattedLocation && (
              <div className="flex items-center gap-1.5 text-text-muted">
                <MapPin className="h-4 w-4 shrink-0 text-text-muted" />
                <span className="text-text-secondary font-medium">
                  {formattedLocation}
                </span>
              </div>
            )}

            {personalInfo.email && (
              <a
                href={`mailto:${personalInfo.email}`}
                className="flex items-center gap-1.5 hover:text-primary transition-colors text-text-secondary group"
              >
                <Mail className="h-4 w-4 shrink-0 text-text-muted group-hover:text-primary transition-colors" />
                <span>{personalInfo.email}</span>
              </a>
            )}

            {personalInfo.phone && (
              <a
                href={`tel:${personalInfo.phone}`}
                className="flex items-center gap-1.5 hover:text-primary transition-colors text-text-secondary group"
              >
                <Phone className="h-4 w-4 shrink-0 text-text-muted group-hover:text-primary transition-colors" />
                <span>{personalInfo.phone}</span>
              </a>
            )}
          </div>

          {/* Links Row */}
          {(personalInfo.linkedinUrl ||
            personalInfo.githubUrl ||
            personalInfo.portfolioUrl ||
            personalInfo.websiteUrl) && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
              {personalInfo.linkedinUrl && (
                <a
                  href={personalInfo.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-surface-subtle hover:bg-primary-soft/50 border border-border text-body-xs font-medium text-text-secondary hover:text-primary transition-colors"
                >
                  <Linkedin className="h-3.5 w-3.5 text-[#0A66C2]" />
                  <span>LinkedIn</span>
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              )}

              {personalInfo.githubUrl && (
                <a
                  href={personalInfo.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-surface-subtle hover:bg-primary-soft/50 border border-border text-body-xs font-medium text-text-secondary hover:text-primary transition-colors"
                >
                  <Github className="h-3.5 w-3.5 text-text-primary" />
                  <span>GitHub</span>
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              )}

              {personalInfo.portfolioUrl && (
                <a
                  href={personalInfo.portfolioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-surface-subtle hover:bg-primary-soft/50 border border-border text-body-xs font-medium text-text-secondary hover:text-primary transition-colors"
                >
                  <Globe className="h-3.5 w-3.5 text-primary" />
                  <span>{formatUrlForDisplay(personalInfo.portfolioUrl)}</span>
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              )}

              {personalInfo.websiteUrl && (
                <a
                  href={personalInfo.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-surface-subtle hover:bg-primary-soft/50 border border-border text-body-xs font-medium text-text-secondary hover:text-primary transition-colors"
                >
                  <Globe className="h-3.5 w-3.5 text-text-muted" />
                  <span>Website</span>
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <ProfilePictureModal
        isOpen={isPicModalOpen}
        onClose={() => setIsPicModalOpen(false)}
        currentAvatarUrl={personalInfo.avatarUrl}
        onSave={handleSaveAvatar}
        onRemove={handleRemoveAvatar}
      />

      <BannerUploadModal
        isOpen={isBannerModalOpen}
        onClose={() => setIsBannerModalOpen(false)}
        currentBannerUrl={personalInfo.bannerUrl}
        onSave={handleSaveBanner}
        onRemove={handleRemoveBanner}
      />

      <EditPersonalInfoModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        data={personalInfo}
        onSave={(updated) => {
          onSavePersonalInfo(updated);
        }}
      />
    </Card>
  );
};
