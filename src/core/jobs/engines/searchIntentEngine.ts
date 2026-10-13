/**
 * CareerOS Search Intent Engine
 *
 * Translates the user's complete Career Profile, Resume, Experience, Skills,
 * Preferences, Exclusions, and Target Companies into a canonical, machine-readable
 * SearchIntent object.
 *
 * Core Principle:
 * "Tell us who you are once. We find the jobs."
 * Profile -> normalize -> SearchIntent -> query sources -> normalize -> verify -> deduplicate -> match -> rank -> feed.
 */

import { UserProfile } from '../../profile/types';
import { JobFilterCriteria } from '../types';
import { roleTaxonomyEngine } from './roleTaxonomyEngine';
import { locationFilterEngine, CANONICAL_INDIA, CANONICAL_WORLDWIDE } from './locationFilterEngine';
import { preferenceLearningEngine } from './preferenceLearningEngine';

export interface SearchIntent {
  id: string;
  profileHash: string;

  // Normalized Role Spectrum
  primaryRoleTitle: string;
  primaryRoleFamily: string;
  primaryRoles: string[];
  adjacentRoles: string[];
  transferableRoles: string[];
  allEligibleRoles: string[];

  // Seniority & Experience
  seniorityLevel: string;
  yearsExperience: number;

  // Skills
  skills: {
    core: Set<string>;
    preferred: Set<string>;
  };

  // Geography & Work Policy (Semantic OR)
  targetLocations: string[];
  locationSemanticDisplay: string;
  homeCountry: string;
  workplaceTypes: ('remote' | 'hybrid' | 'on-site')[];
  isOpenToWorldwideRemote: boolean;

  // Compensation
  compensationFloor?: {
    minSalary: number;
    currency: string;
  };

  // Employment Types
  employmentTypes: string[];

  // Industry & Target Companies
  targetIndustries: string[];
  targetCompanyNames: string[];

  // Hard Exclusions
  hardExclusions: {
    companies: Set<string>;
    titles: Set<string>;
    locations: Set<string>;
    keywords: Set<string>;
  };

  // Auto-Derived Active Filters
  derivedFilters: Partial<JobFilterCriteria>;

  // Human-Friendly Summary Banner
  displaySummary: string; // e.g. "Enterprise Sales · Remote · India + Worldwide Remote"
  generatedAt: string;
}

function cleanToken(str: string): string {
  return (str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ');
}

export class SearchIntentEngine {
  private cachedIntent: SearchIntent | null = null;
  private lastProfileHash = '';

  /**
   * Generates or retrieves the cached SearchIntent for a profile.
   */
  public getSearchIntent(profile: UserProfile): SearchIntent {
    const hash = `${profile.lastUpdated || ''}_${profile.personalInfo?.fullName || ''}_${profile.rolePreferences?.targetPrimaryTitle || ''}_${(profile.workPreferences?.targetLocations || []).join(',')}`;
    if (this.cachedIntent && this.lastProfileHash === hash) {
      return this.cachedIntent;
    }

    const intent = this.compileSearchIntent(profile, hash);
    this.cachedIntent = intent;
    this.lastProfileHash = hash;
    return intent;
  }

  /**
   * Forces regeneration of the SearchIntent when profile or preferences change.
   */
  public regenerateSearchIntent(profile: UserProfile): SearchIntent {
    this.cachedIntent = null;
    this.lastProfileHash = '';
    return this.getSearchIntent(profile);
  }

  /**
   * Compiles the canonical SearchIntent object from profile data.
   */
  public compileSearchIntent(profile: UserProfile, profileHash: string): SearchIntent {
    // -------------------------------------------------------------------------
    // 1. ROLE TAXONOMY & SPECTRUM
    // -------------------------------------------------------------------------
    const primaryTitleRaw =
      profile.rolePreferences?.targetPrimaryTitle ||
      profile.personalInfo?.headline ||
      'Enterprise Account Executive';
    const targetTitlesRaw = profile.rolePreferences?.targetJobTitles || [];
    const allInputTitles = [primaryTitleRaw, ...targetTitlesRaw];

    const roleSpectrum = roleTaxonomyEngine.inferRoleSpectrum(allInputTitles);
    const primaryOccupation = roleTaxonomyEngine.findOccupation(primaryTitleRaw);
    const primaryRoleFamily = primaryOccupation?.familyName || 'B2B Sales & Revenue Growth';

    // -------------------------------------------------------------------------
    // 2. SENIORITY & YEARS OF EXPERIENCE
    // -------------------------------------------------------------------------
    const seniorityLevel = profile.rolePreferences?.experienceLevel || 'lead';
    const yearsExperience = profile.rolePreferences?.totalYearsExperience || 8;

    // -------------------------------------------------------------------------
    // 3. SKILLS EXTRACTION
    // -------------------------------------------------------------------------
    const coreSkills = new Set<string>();
    const preferredSkills = new Set<string>();

    (profile.skills?.technicalSkills || []).forEach((s) => {
      const cs = cleanToken(s);
      if (cs) coreSkills.add(cs);
    });

    (profile.skills?.toolsAndPlatforms || []).forEach((s) => {
      const cs = cleanToken(s);
      if (cs) coreSkills.add(cs);
    });

    (profile.skills?.softSkills || []).forEach((s) => {
      const cs = cleanToken(s);
      if (cs) preferredSkills.add(cs);
    });

    (profile.workExperience || []).forEach((exp) => {
      (exp.skillsUsed || []).forEach((s) => {
        const cs = cleanToken(s);
        if (cs) coreSkills.add(cs);
      });
    });

    // -------------------------------------------------------------------------
    // 4. LOCATIONS & SEMANTIC NORMALIZATION
    // -------------------------------------------------------------------------
    const rawLocations = profile.workPreferences?.targetLocations || ['India', 'Remote Worldwide'];
    const canonicalLocations = locationFilterEngine.normalizeTargetLocations(rawLocations);
    const locationSemanticDisplay = locationFilterEngine.formatLocationSemanticDisplay(canonicalLocations);

    const homeCountry = cleanToken(
      profile.locationAndAuth?.currentCountry ||
      (profile as any).locationAndAuthorization?.currentCountry ||
      profile.personalInfo?.country ||
      'India'
    );

    const workplaceTypes: ('remote' | 'hybrid' | 'on-site')[] =
      profile.workPreferences?.workplaceTypes && profile.workPreferences.workplaceTypes.length > 0
        ? profile.workPreferences.workplaceTypes
        : ['remote', 'hybrid'];

    const isOpenToWorldwideRemote =
      canonicalLocations.includes(CANONICAL_WORLDWIDE) ||
      workplaceTypes.includes('remote');

    // -------------------------------------------------------------------------
    // 5. COMPENSATION & EMPLOYMENT
    // -------------------------------------------------------------------------
    const minSalary =
      profile.compensation?.minBaseSalary ||
      (profile as any).compensationExpectations?.minBaseSalary ||
      0;
    const currency =
      profile.compensation?.currency ||
      (profile as any).compensationExpectations?.currency ||
      'USD';

    const employmentTypes = (profile.workPreferences?.employmentTypes || ['full-time']).map(cleanToken);

    // -------------------------------------------------------------------------
    // 6. TARGET COMPANIES & INDUSTRIES
    // -------------------------------------------------------------------------
    const targetIndustries = [
      ...(profile.targetMarkets?.targetIndustries || []),
      ...((profile.workPreferences as any)?.targetIndustries || []),
    ].map(cleanToken).filter(Boolean);

    const targetCompanyNames = [
      ...(profile.targetMarkets?.targetCompanies || []),
      ...((profile.workPreferences as any)?.targetCompanyNames || []),
      ...((profile.workPreferences as any)?.targetCompanies || []),
    ].map(cleanToken).filter(Boolean);

    // -------------------------------------------------------------------------
    // 7. HARD EXCLUSIONS
    // -------------------------------------------------------------------------
    const learned = preferenceLearningEngine.getPreferences();
    const excludedCompanies = new Set<string>();
    const excludedTitles = new Set<string>();
    const excludedLocations = new Set<string>();
    const excludedKeywords = new Set<string>();

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

    Object.entries(learned.disfavoredCompanies || {}).forEach(([comp, count]) => {
      if (count >= 3) excludedCompanies.add(cleanToken(comp));
    });
    Object.entries(learned.disfavoredTitles || {}).forEach(([title, count]) => {
      if (count >= 3) excludedTitles.add(cleanToken(title));
    });
    Object.entries(learned.disfavoredLocations || {}).forEach(([loc, count]) => {
      if (count >= 3) excludedLocations.add(cleanToken(loc));
    });

    // -------------------------------------------------------------------------
    // 8. AUTO-DERIVE ACTIVE FILTERS (No Over-Constraining)
    // -------------------------------------------------------------------------
    const derivedRoles = roleSpectrum.primaryRoles.slice(0, 4);
    const derivedFilters: Partial<JobFilterCriteria> = {
      searchQuery: '',
      fitTier: 'all',
      roles: derivedRoles,
      locations: canonicalLocations,
      remoteStatuses: workplaceTypes.includes('remote') ? ['worldwide_remote', 'india_remote'] : [],
      countryMarket: canonicalLocations.includes(CANONICAL_INDIA) ? 'india_global' : 'all',
      seniority: 'all',
      companyFilter: 'all',
      jobType: 'all',
      salaryDisclosedOnly: false,
      targetCompanyOnly: false,
      verifiedOnly: false,
      sortBy: 'match',
    };

    // -------------------------------------------------------------------------
    // 9. CLEAN SUMMARY DISPLAY STRING
    // -------------------------------------------------------------------------
    const rolePart = primaryTitleRaw || primaryOccupation?.preferredTitle || derivedRoles[0] || 'Enterprise Sales';
    const workplacePart = workplaceTypes.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' / ');
    const locPart = canonicalLocations.join(' + ');
    const displaySummary = `${rolePart} · ${workplacePart} · ${locPart}`;

    return {
      id: `intent-${Date.now()}`,
      profileHash,
      primaryRoleTitle: primaryTitleRaw,
      primaryRoleFamily,
      primaryRoles: roleSpectrum.primaryRoles,
      adjacentRoles: roleSpectrum.adjacentRoles,
      transferableRoles: roleSpectrum.transferableRoles,
      allEligibleRoles: [
        ...roleSpectrum.primaryRoles,
        ...roleSpectrum.adjacentRoles,
        ...roleSpectrum.transferableRoles,
      ],
      seniorityLevel,
      yearsExperience,
      skills: {
        core: coreSkills,
        preferred: preferredSkills,
      },
      targetLocations: canonicalLocations,
      locationSemanticDisplay,
      homeCountry,
      workplaceTypes,
      isOpenToWorldwideRemote,
      compensationFloor: minSalary > 0 ? { minSalary, currency } : undefined,
      employmentTypes,
      targetIndustries,
      targetCompanyNames,
      hardExclusions: {
        companies: excludedCompanies,
        titles: excludedTitles,
        locations: excludedLocations,
        keywords: excludedKeywords,
      },
      derivedFilters,
      displaySummary,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const searchIntentEngine = new SearchIntentEngine();
