import { UserProfile } from './types';
import { defaultProfile } from './defaultProfile';
import { persistentStorageEngine } from '../storage/persistentStorageEngine';

const PROFILE_STORAGE_KEY = 'careeros_canonical_profile_v2';

export interface IProfileRepository {
  getProfile(): UserProfile;
  saveProfile(profile: UserProfile): void;
  exportProfileJson(profile?: UserProfile): string;
  importProfileJson(jsonString: string): {
    success: boolean;
    profile?: UserProfile;
    error?: string;
  };
  resetProfile(): UserProfile;
}

export class LocalProfileRepository implements IProfileRepository {
  getProfile(): UserProfile {
    try {
      const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (!stored) {
        // Check if v1 has a custom profile (not the old Alex Morgan demo)
        const oldV1 = localStorage.getItem('careeros_canonical_profile_v1');
        if (oldV1) {
          try {
            const parsedOld = JSON.parse(oldV1) as UserProfile;
            if (
              parsedOld.personalInfo?.fullName &&
              parsedOld.personalInfo.fullName !== 'Alex Morgan' &&
              parsedOld.skills &&
              parsedOld.workExperience
            ) {
              this.saveProfile(parsedOld);
              return parsedOld;
            }
          } catch {
            // Fall through to defaultProfile
          }
        }
        // Initialize with canonical Vivek Dhoundiyal profile
        this.saveProfile(defaultProfile);
        return defaultProfile;
      }
      const parsed = JSON.parse(stored) as UserProfile;
      // If still holding old Alex Morgan placeholder, migrate to canonical profile
      if (parsed.personalInfo?.fullName === 'Alex Morgan') {
        this.saveProfile(defaultProfile);
        return defaultProfile;
      }
      // Basic schema health check
      if (!parsed.personalInfo || !parsed.skills || !parsed.workExperience) {
        console.warn('Incompatible profile schema found in storage. Restoring defaults.');
        this.saveProfile(defaultProfile);
        return defaultProfile;
      }
      return parsed;
    } catch (err) {
      console.error('Failed to read profile from localStorage:', err);
      return defaultProfile;
    }
  }

  saveProfile(profile: UserProfile): void {
    const updatedProfile: UserProfile = {
      ...profile,
      lastUpdated: new Date().toISOString(),
    };

    // 1. Authoritative persistent storage in IndexedDB (no 5MB quota limit)
    persistentStorageEngine.set('metadata', {
      id: 'canonical_profile',
      profile: updatedProfile,
      updatedAt: updatedProfile.lastUpdated,
    }).catch((err) => {
      console.warn('ProfileRepository: Failed to mirror profile to IndexedDB:', err);
    });

    // 2. LocalStorage mirror with graceful QuotaExceededError handling
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updatedProfile));
    } catch (err: any) {
      console.warn('ProfileRepository: localStorage quota warning, attempting compact mirror:', err?.message);
      try {
        // Store compact profile (cap target companies list to top 20 to avoid crashing localStorage)
        const compact: UserProfile = {
          ...updatedProfile,
          targetMarkets: {
            ...updatedProfile.targetMarkets,
            targetCompanies: (updatedProfile.targetMarkets?.targetCompanies || []).slice(0, 20),
          },
        };
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(compact));
      } catch (compactErr) {
        console.warn('ProfileRepository: Compact mirror failed, relying on IndexedDB as source of truth:', compactErr);
      }
    }
  }

  exportProfileJson(profile?: UserProfile): string {
    const dataToExport = profile || this.getProfile();
    return JSON.stringify(dataToExport, null, 2);
  }

  importProfileJson(jsonString: string): {
    success: boolean;
    profile?: UserProfile;
    error?: string;
  } {
    try {
      const parsed = JSON.parse(jsonString);

      // Validate required core structural properties
      if (!parsed || typeof parsed !== 'object') {
        return { success: false, error: 'Uploaded file is not a valid JSON object.' };
      }

      if (!parsed.personalInfo?.fullName || !parsed.personalInfo?.email) {
        return {
          success: false,
          error: 'Missing required Personal Information (fullName or email).',
        };
      }

      // Merge with default structure to prevent missing keys
      const sanitizedProfile: UserProfile = {
        ...defaultProfile,
        ...parsed,
        personalInfo: { ...defaultProfile.personalInfo, ...parsed.personalInfo },
        professionalSummary: {
          ...defaultProfile.professionalSummary,
          ...parsed.professionalSummary,
        },
        rolePreferences: { ...defaultProfile.rolePreferences, ...parsed.rolePreferences },
        skills: { ...defaultProfile.skills, ...parsed.skills },
        locationAndAuth: { ...defaultProfile.locationAndAuth, ...parsed.locationAndAuth },
        workPreferences: { ...defaultProfile.workPreferences, ...parsed.workPreferences },
        targetMarkets: { ...defaultProfile.targetMarkets, ...parsed.targetMarkets },
        compensation: { ...defaultProfile.compensation, ...parsed.compensation },
        availability: { ...defaultProfile.availability, ...parsed.availability },
        careerGoals: { ...defaultProfile.careerGoals, ...parsed.careerGoals },
        workExperience: Array.isArray(parsed.workExperience)
          ? parsed.workExperience
          : defaultProfile.workExperience,
        education: Array.isArray(parsed.education)
          ? parsed.education
          : defaultProfile.education,
        certifications: Array.isArray(parsed.certifications)
          ? parsed.certifications
          : defaultProfile.certifications,
        lastUpdated: new Date().toISOString(),
      };

      this.saveProfile(sanitizedProfile);
      return { success: true, profile: sanitizedProfile };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Invalid JSON format';
      return { success: false, error: `Syntax error in JSON: ${errorMessage}` };
    }
  }

  resetProfile(): UserProfile {
    this.saveProfile(defaultProfile);
    return defaultProfile;
  }
}

export const profileRepository = new LocalProfileRepository();
