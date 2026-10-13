import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import { UserProfile, ProfileCompletenessDetails } from './types';
import { profileRepository } from './profileRepository';
import { calculateProfileCompleteness } from './completeness';

export interface ProfileContextValue {
  profile: UserProfile;
  updateSection: <K extends keyof UserProfile>(
    sectionKey: K,
    data: UserProfile[K]
  ) => void;
  saveFullProfile: (updatedProfile: UserProfile) => void;
  resetProfile: () => void;
  exportJson: () => string;
  importJson: (json: string) => { success: boolean; error?: string };
  downloadJsonFile: () => void;
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (val: boolean) => void;
  completionScore: number;
  completenessDetails: ProfileCompletenessDetails;
}

// eslint-disable-next-line react-refresh/only-export-components
export const ProfileContext = createContext<ProfileContextValue | null>(null);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [profile, setProfile] = useState<UserProfile>(() =>
    profileRepository.getProfile()
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Sync state if repository changes externally
  useEffect(() => {
    const loaded = profileRepository.getProfile();
    setProfile(loaded);
  }, []);

  const updateSection = useCallback(
    <K extends keyof UserProfile>(sectionKey: K, data: UserProfile[K]) => {
      setProfile((prev) => {
        const updated: UserProfile = {
          ...prev,
          [sectionKey]: data,
          lastUpdated: new Date().toISOString(),
        };
        try {
          profileRepository.saveProfile(updated);
        } catch (e) {
          console.warn('Failed to save profile in updateSection:', e);
        }
        return updated;
      });
      setHasUnsavedChanges(false);
    },
    []
  );

  const saveFullProfile = useCallback((updatedProfile: UserProfile) => {
    profileRepository.saveProfile(updatedProfile);
    setProfile(updatedProfile);
    setHasUnsavedChanges(false);
  }, []);

  const resetProfile = useCallback(() => {
    const reset = profileRepository.resetProfile();
    setProfile(reset);
    setHasUnsavedChanges(false);
  }, []);

  const exportJson = useCallback(() => {
    return profileRepository.exportProfileJson(profile);
  }, [profile]);

  const importJson = useCallback((json: string) => {
    const result = profileRepository.importProfileJson(json);
    if (result.success && result.profile) {
      setProfile(result.profile);
      setHasUnsavedChanges(false);
      return { success: true };
    }
    return { success: false, error: result.error };
  }, []);

  const downloadJsonFile = useCallback(() => {
    const jsonStr = profileRepository.exportProfileJson(profile);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = profile.personalInfo.fullName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-');
    a.download = `careeros-profile-${safeName || 'backup'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [profile]);

  // Dynamic Profile Completeness calculation
  const completenessDetails = useMemo(() => {
    return calculateProfileCompleteness(profile);
  }, [profile]);

  const completionScore = completenessDetails.totalScore;

  const value = useMemo<ProfileContextValue>(
    () => ({
      profile,
      updateSection,
      saveFullProfile,
      resetProfile,
      exportJson,
      importJson,
      downloadJsonFile,
      hasUnsavedChanges,
      setHasUnsavedChanges,
      completionScore,
      completenessDetails,
    }),
    [
      profile,
      updateSection,
      saveFullProfile,
      resetProfile,
      exportJson,
      importJson,
      downloadJsonFile,
      hasUnsavedChanges,
      completionScore,
      completenessDetails,
    ]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};
