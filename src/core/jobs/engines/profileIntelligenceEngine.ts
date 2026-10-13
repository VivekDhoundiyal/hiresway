/**
 * CareerOS Profile Intelligence Engine
 *
 * Single Source of Truth for User Career Profile Normalization:
 * - Ingests UserProfile, resume text, experience, skills, roles, seniority,
 *   locations, remote preferences, compensation, target companies, and exclusions.
 * - Compiles a structured, mathematical JobPreferenceVector.
 * - Automatically derives 3–5 essential active filters for the feed.
 * - Incorporates learned behavioral biases from the Preference Learning Engine.
 */

import { UserProfile } from '../../profile/types';
import { JobFilterCriteria } from '../types';
import { preferenceLearningEngine } from './preferenceLearningEngine';

export interface HardExclusionRules {
  excludedCompanies: Set<string>;
  excludedTitles: Set<string>;
  excludedLocations: Set<string>;
  minExperienceAllowed?: number;
  maxExperienceAllowed?: number;
}

export interface JobPreferenceVector {
  // Normalized Target Roles & Titles
  primaryRole: string;
  targetTitles: string[];
  roleKeywords: string[];

  // Seniority & Experience
  seniorityLevel: string;
  yearsExperience: number;

  // Skills
  coreSkills: Set<string>;
  preferredSkills: Set<string>;

  // Geography & Work Modes
  targetLocations: string[];
  homeCountry: string;
  workplaceTypes: ('remote' | 'hybrid' | 'on-site')[];
  isOpenToWorldwideRemote: boolean;

  // Industry & Target Companies
  targetIndustries: string[];
  targetCompanies: Set<string>;

  // Compensation Expectations
  minBaseSalary: number;
  salaryCurrency: string;

  // Employment Types
  employmentTypes: string[];

  // Hard Exclusions
  hardExclusions: HardExclusionRules;

  // Dimensional Weights
  weights: {
    roleWeight: number;      // 0.25
    skillWeight: number;     // 0.20
    experienceWeight: number;// 0.15
    locationWeight: number;  // 0.10
    remoteWeight: number;    // 0.10
    industryWeight: number;  // 0.05
    salaryWeight: number;    // 0.05
    companyWeight: number;   // 0.10
  };

  compiledAt: string;
}

function cleanToken(str: string): string {
  return (str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ');
}

export class ProfileIntelligenceEngine {
  private cachedVector: JobPreferenceVector | null = null;
  private lastProfileHash = '';

  /**
   * Builds or returns a cached JobPreferenceVector from the UserProfile.
   */
  public getPreferenceVector(profile: UserProfile): JobPreferenceVector {
    const hash = `${profile.lastUpdated || ''}_${profile.personalInfo?.fullName || (profile as any).fullName || ''}_${profile.rolePreferences?.targetPrimaryTitle || (profile as any).currentRole || ''}`;
    if (this.cachedVector && this.lastProfileHash === hash) {
      return this.cachedVector;
    }

    const vector = this.compileVector(profile);
    this.cachedVector = vector;
    this.lastProfileHash = hash;
    return vector;
  }

  /**
   * Compiles the complete JobPreferenceVector.
   */
  public compileVector(profile: UserProfile): JobPreferenceVector {
    // 1. Roles & Titles
    const primaryRole = cleanToken(
      profile.rolePreferences?.targetPrimaryTitle ||
      profile.personalInfo?.headline ||
      (profile as any).currentRole ||
      (profile as any).primaryRoles?.[0] ||
      'Software Engineer'
    );
    const targetTitles: string[] = [];
    if (primaryRole) targetTitles.push(primaryRole);
    [
      ...(profile.rolePreferences?.targetJobTitles || []),
      ...((profile as any).targetRoles || []),
      ...((profile as any).primaryRoles || []),
    ].forEach((t) => {
      const ct = cleanToken(t);
      if (ct && !targetTitles.includes(ct)) targetTitles.push(ct);
    });

    const roleKeywords: string[] = [];
    targetTitles.forEach((t) => {
      t.split(/\s+/).forEach((w) => {
        if (w.length > 2 && !roleKeywords.includes(w)) roleKeywords.push(w);
      });
    });

    // 2. Seniority & Experience
    const seniorityLevel = profile.rolePreferences?.experienceLevel || (profile as any).seniority || 'mid';
    const yearsExperience = profile.rolePreferences?.totalYearsExperience || (profile as any).yearsOfExperience || 4;

    // 3. Skills
    const coreSkills = new Set<string>();
    const preferredSkills = new Set<string>();

    [
      ...(profile.skills?.technicalSkills || []),
      ...(profile.skills?.toolsAndPlatforms || []),
      ...((profile as any).coreSkills || []),
    ].forEach((s) => {
      const cs = cleanToken(s);
      if (cs) coreSkills.add(cs);
    });

    [
      ...(profile.skills?.softSkills || []),
      ...((profile as any).preferredSkills || []),
    ].forEach((s) => {
      const cs = cleanToken(s);
      if (cs) preferredSkills.add(cs);
    });

    // Ingest skills from past work experiences
    (profile.workExperience || []).forEach((exp) => {
      (exp.skillsUsed || []).forEach((s) => {
        const cs = cleanToken(s);
        if (cs) coreSkills.add(cs);
      });
    });

    // 4. Locations & Work Modes
    const targetLocations: string[] = [];
    [
      ...(profile.workPreferences?.targetLocations || []),
      ...((profile as any).targetLocations || []),
    ].forEach((loc) => {
      const cl = cleanToken(loc);
      if (cl && !targetLocations.includes(cl)) targetLocations.push(cl);
    });

    const homeCountry = cleanToken(
      profile.locationAndAuth?.currentCountry ||
      (profile as any).locationAndAuthorization?.currentCountry ||
      (profile as any).homeCountry ||
      profile.personalInfo?.country ||
      'India'
    );
    if (homeCountry && !targetLocations.includes(homeCountry)) {
      targetLocations.push(homeCountry);
    }

    const workplaceTypes: ('remote' | 'hybrid' | 'on-site')[] =
      profile.workPreferences?.workplaceTypes && profile.workPreferences.workplaceTypes.length > 0
        ? profile.workPreferences.workplaceTypes
        : ['remote', 'hybrid'];

    const isOpenToWorldwideRemote =
      workplaceTypes.includes('remote') ||
      targetLocations.some((l) => l.includes('worldwide') || l.includes('anywhere'));

    // 5. Industries & Target Companies
    const targetIndustries = [
      ...(profile.targetMarkets?.targetIndustries || []),
      ...((profile.workPreferences as any)?.targetIndustries || []),
    ].map(cleanToken).filter(Boolean);

    const targetCompanies = new Set<string>();
    [
      ...(profile.targetMarkets?.targetCompanies || []),
      ...((profile.workPreferences as any)?.targetCompanyNames || []),
      ...((profile.workPreferences as any)?.targetCompanies || []),
    ].forEach((c) => {
      const cc = cleanToken(c);
      if (cc) targetCompanies.add(cc);
    });

    // 6. Compensation Expectations
    const minBaseSalary = profile.compensation?.minBaseSalary || (profile as any).compensationExpectations?.minBaseSalary || 0;
    const salaryCurrency = profile.compensation?.currency || (profile as any).compensationExpectations?.currency || 'USD';

    // 7. Employment Types
    const employmentTypes = (profile.workPreferences?.employmentTypes || ['full-time']).map(cleanToken);

    // 8. Hard Exclusions (derived from preferences + behavioral learning)
    const learnedPrefs = preferenceLearningEngine.getPreferences();
    const excludedCompanies = new Set<string>();
    const excludedTitles = new Set<string>();
    const excludedLocations = new Set<string>();

    // Profile-level explicit exclusions
    const profExclusions = (profile.workPreferences as any)?.hardExclusions || (profile as any).hardExclusions || (profile as any).exclusions || {};
    const explicitExCompanies: string[] = profExclusions.excludedCompanies || (profile.workPreferences as any)?.excludedCompanies || [];
    const explicitExTitles: string[] = profExclusions.excludedTitles || (profile.workPreferences as any)?.excludedTitles || [];
    const explicitExLocations: string[] = profExclusions.excludedLocations || (profile.workPreferences as any)?.excludedLocations || [];

    explicitExCompanies.forEach((comp) => {
      const c = cleanToken(comp);
      if (c) excludedCompanies.add(c);
    });
    explicitExTitles.forEach((title) => {
      const t = cleanToken(title);
      if (t) excludedTitles.add(t);
    });
    explicitExLocations.forEach((loc) => {
      const l = cleanToken(loc);
      if (l) excludedLocations.add(l);
    });

    // Disfavored items with high rejection count (> 3) become active exclusions
    Object.entries(learnedPrefs.disfavoredCompanies || {}).forEach(([comp, count]) => {
      if (count >= 3) excludedCompanies.add(cleanToken(comp));
    });
    Object.entries(learnedPrefs.disfavoredTitles || {}).forEach(([title, count]) => {
      if (count >= 3) excludedTitles.add(cleanToken(title));
    });
    Object.entries(learnedPrefs.disfavoredLocations || {}).forEach(([loc, count]) => {
      if (count >= 3) excludedLocations.add(cleanToken(loc));
    });

    return {
      primaryRole,
      targetTitles,
      roleKeywords,
      seniorityLevel,
      yearsExperience,
      coreSkills,
      preferredSkills,
      targetLocations,
      homeCountry,
      workplaceTypes,
      isOpenToWorldwideRemote,
      targetIndustries,
      targetCompanies,
      minBaseSalary,
      salaryCurrency,
      employmentTypes,
      hardExclusions: {
        excludedCompanies,
        excludedTitles,
        excludedLocations,
      },
      weights: {
        roleWeight: 0.25,
        skillWeight: 0.20,
        experienceWeight: 0.15,
        locationWeight: 0.10,
        remoteWeight: 0.10,
        industryWeight: 0.05,
        salaryWeight: 0.05,
        companyWeight: 0.10,
      },
      compiledAt: new Date().toISOString(),
    };
  }

  /**
   * Automatically derives the 3–5 essential active filters for the feed.
   * Users never have to manually configure dozens of checkboxes.
   */
  public deriveInitialFilters(profile: UserProfile): Partial<JobFilterCriteria> {
    const vector = this.getPreferenceVector(profile);
    const roles = vector.targetTitles.length > 0 ? vector.targetTitles.slice(0, 3) : (vector.primaryRole ? [vector.primaryRole] : []);
    const locations = this.normalizeTargetLocations(vector.targetLocations);

    return {
      searchQuery: '',
      fitTier: 'all',
      roles,
      locations,
      // Primary 1: Remote preference derived from profile
      remoteType: vector.workplaceTypes.includes('remote')
        ? 'all'
        : vector.workplaceTypes[0] || 'all',
      // Primary 2: Location market derived from user profile
      countryMarket: vector.homeCountry.includes('india') ? 'india_global' : 'all',
      // Primary 3: Seniority derived from experience
      seniority: 'all',
      // Primary 4: Company filter
      companyFilter: 'all',
      // Primary 5: Salary Disclosed
      salaryDisclosedOnly: false,
      targetCompanyOnly: false,
      verifiedOnly: false,
      sortBy: 'match',
    };
  }

  /**
   * Evaluates canonical Boolean Filter matching:
   * (Role A OR Role B OR ...) AND (Loc India OR Remote Worldwide) AND (Remote OR Hybrid) AND (Seniority)
   * Disallows contradictory broad locations.
   */
  public evaluateBooleanFilterMatch(
    job: {
      title: string;
      location?: string;
      country?: string;
      remoteStatus?: string;
      seniority?: string;
      company?: string;
      isVerifiedLive?: boolean;
    },
    criteria: {
      roles?: string[];
      locations?: string[];
      workplaceTypes?: ('remote' | 'hybrid' | 'on-site')[];
      seniorities?: string[];
      companies?: string[];
      verifiedOnly?: boolean;
    }
  ): boolean {
    // 1. Roles: (Role A OR Role B)
    if (criteria.roles && criteria.roles.length > 0) {
      const titleLower = (job.title || '').toLowerCase();
      const matchRole = criteria.roles.some((r) => titleLower.includes(r.toLowerCase().trim()));
      if (!matchRole) return false;
    }

    // 2. Locations: (Loc A OR Loc B)
    if (criteria.locations && criteria.locations.length > 0) {
      const locLower = (job.location || '').toLowerCase();
      const countryLower = (job.country || '').toLowerCase();
      const matchLoc = criteria.locations.some((l) => {
        const cl = l.toLowerCase().trim();
        if (cl.includes('worldwide') || cl.includes('wfa') || cl.includes('anywhere')) {
          return (
            locLower.includes('remote') ||
            locLower.includes('worldwide') ||
            (job.remoteStatus || '').toLowerCase() === 'remote'
          );
        }
        if (cl.includes('india')) {
          return (
            countryLower === 'india' ||
            locLower.includes('india') ||
            locLower.includes('bangalore') ||
            locLower.includes('bengaluru') ||
            locLower.includes('mumbai') ||
            locLower.includes('delhi')
          );
        }
        return locLower.includes(cl) || countryLower.includes(cl);
      });
      if (!matchLoc) return false;
    }

    // 3. Workplace: (Remote OR Hybrid OR On-site)
    if (criteria.workplaceTypes && criteria.workplaceTypes.length > 0) {
      const mode = (job.remoteStatus || 'on-site').toLowerCase();
      const matchMode = criteria.workplaceTypes.some((wt) => {
        if (wt === 'remote') return mode === 'remote';
        if (wt === 'hybrid') return mode === 'hybrid';
        if (wt === 'on-site') return mode === 'on-site' || mode === 'onsite';
        return false;
      });
      if (!matchMode) return false;
    }

    // 4. Seniority: (Sen A OR Sen B)
    if (criteria.seniorities && criteria.seniorities.length > 0) {
      const senLower = ((job.seniority as string) || '').toLowerCase();
      const titleLower = (job.title || '').toLowerCase();
      const matchSen = criteria.seniorities.some((s) => {
        const cs = s.toLowerCase().trim();
        return senLower.includes(cs) || titleLower.includes(cs);
      });
      if (!matchSen) return false;
    }

    // 5. Companies: (Comp A OR Comp B)
    if (criteria.companies && criteria.companies.length > 0) {
      const compLower = (job.company || '').toLowerCase();
      const matchComp = criteria.companies.some((c) => compLower.includes(c.toLowerCase().trim()));
      if (!matchComp) return false;
    }

    // 6. Verified Only
    if (criteria.verifiedOnly && job.isVerifiedLive === false) {
      return false;
    }

    return true;
  }

  /**
   * Normalizes target locations to eliminate vague and contradictory duplicates.
   */
  public normalizeTargetLocations(locations: string[]): string[] {
    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const loc of locations) {
      const trimmed = loc.trim();
      if (!trimmed) continue;
      const lower = trimmed.toLowerCase();

      let canonical = trimmed;
      if (
        lower.includes('worldwide') ||
        lower.includes('work from anywhere') ||
        lower.includes('wfa') ||
        lower === 'global' ||
        lower === 'anywhere' ||
        lower === 'remote anywhere' ||
        lower === 'remote' ||
        lower === 'everywhere'
      ) {
        canonical = 'Remote Worldwide';
      }

      const key = canonical.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        normalized.push(canonical);
      }
    }

    return normalized.length > 0 ? normalized : ['India', 'Remote Worldwide'];
  }

  /**
   * Invalidate cache on profile updates.
   */
  public invalidateCache(): void {
    this.cachedVector = null;
    this.lastProfileHash = '';
  }
}

export const profileIntelligenceEngine = new ProfileIntelligenceEngine();
