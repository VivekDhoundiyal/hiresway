import { UserProfile } from '../profile/types';
import { SeniorityLevel, LearnedPreferences } from './types';

/**
 * CareerSearchModel
 * Structured internal representation of the user's complete professional identity
 * synthesized by the Profile Intelligence Engine.
 */
export interface CareerSearchModel {
  // Identity & Headline
  fullName: string;
  headline: string;
  summary: string;

  // Synthesized Domains & Trajectory
  primaryDomain: string; // e.g. 'Growth & Operations', 'Software Engineering', 'Enterprise Sales'
  functionalDomains: string[];
  businessModels: string[]; // e.g. ['B2B', 'SaaS', 'Enterprise', 'FinTech']
  careerProgression: string; // e.g. 'Account Executive → Senior AE → Head of Partnerships'
  leadershipExposure: boolean;
  startupExposure: boolean;

  // Seniority & Experience
  totalYearsExperience: number;
  seniorityLevel: SeniorityLevel;
  recentTitles: string[];
  recentCompanies: string[];
  keyAchievements: string[];

  // Competencies
  allSkills: string[];
  coreTools: string[];
  certifications: string[];

  // Generalized Country & Location Model
  locationModel: {
    homeCountry: string;
    homeCity: string;
    homeRegion: string;
    localMarketName: string;
    remotePreference: 'remote_first' | 'flexible' | 'on_site_only';
    wfaEligible: boolean;
    targetLocations: string[];
    isWorldwideAllowed: boolean;
    displayLocationSummary: string; // e.g. 'India · Remote Worldwide / Work From Anywhere'
  };

  // Compensation Expectations
  compensationModel: {
    currency: string;
    minBaseSalary: number;
    targetBaseSalary: number;
    formattedRange: string;
    hasStatedExpectations: boolean;
  };

  // Explicit Target Preferences
  targetTitles: string[];
  targetIndustries: string[];
  targetCompanies: string[];

  // Career Direction & Goals
  careerGoals: {
    shortTerm: string;
    longTermVision: string;
    primaryMotivation: string;
  };

  // Actionable Profile Guidance (contextual, gentle, only when critical data is missing)
  profileGapsForDiscovery: string[];
}

/**
 * Synthesizes a UserProfile into a structured CareerSearchModel.
 */
export function buildCareerSearchModel(
  profile: UserProfile,
  learned?: LearnedPreferences
): CareerSearchModel {
  const experiences = profile.workExperience || [];
  const allExpText = experiences
    .map((e) => `${e.title} ${e.company} ${e.description} ${(e.keyAchievements || []).join(' ')}`)
    .join(' ')
    .toLowerCase();

  // 1. Detect Functional Domains (Prioritizing explicit target roles & headline)
  const targetPrimary = profile.rolePreferences?.targetPrimaryTitle || '';
  const targetTitles = profile.rolePreferences?.targetJobTitles || [];
  const currentTitle = profile.rolePreferences?.currentTitle || '';
  const headline = profile.personalInfo?.headline || '';
  const primaryTitleFocus = [targetPrimary, ...targetTitles, currentTitle, headline]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const domains: string[] = [];

  // Check explicit title focus first
  if (
    /software|engineer|developer|frontend|backend|fullstack|full-stack|architect|web engineer|ui engineer|tech lead/i.test(
      primaryTitleFocus
    )
  ) {
    domains.push('Software Engineering & Architecture');
  } else if (
    /product manager|product management|group product manager|cpo|head of product/i.test(
      primaryTitleFocus
    )
  ) {
    domains.push('Product Management');
  } else if (
    /product designer|ui\/ux|design systems|ux designer|brand designer/i.test(
      primaryTitleFocus
    )
  ) {
    domains.push('Product Design & UX');
  } else if (
    /data scientist|machine learning|ai engineer|analytics engineer|data platform/i.test(
      primaryTitleFocus
    )
  ) {
    domains.push('Data & AI Engineering');
  }
  if (
    /sales|business development|account executive|bdr|sdr|revenue|commercial account/i.test(primaryTitleFocus)
  ) {
    domains.push('Enterprise Sales & Revenue');
  }
  if (
    /growth|operations|partnerships|business development|gtm lead|alliances/i.test(primaryTitleFocus)
  ) {
    domains.push('Growth & Operations');
  }

  // Next, check broader experience context if still empty
  if (domains.length === 0) {
    const hasEngineering =
      /software|engineer|developer|frontend|backend|fullstack|architect|typescript|react|python|cloud|devops/i.test(
        allExpText
      );
    const hasProduct =
      /product manager|product management|roadmap|product lead|head of product/i.test(
        allExpText
      );
    const hasDesign =
      /product designer|ui\/ux|design systems|figma/i.test(allExpText);
    const hasDataAI =
      /data scientist|machine learning|data platform|ai engineer/i.test(allExpText);
    const hasSales =
      /account executive|bdr|sdr|sales quota|outbound sales|deal close|client acquisition/i.test(
        allExpText
      );
    const hasGrowthOps =
      /partnerships|business development|gtm expansion|commercial growth/i.test(
        allExpText
      );

    if (hasEngineering) domains.push('Software Engineering & Architecture');
    if (hasProduct) domains.push('Product Management');
    if (hasDesign) domains.push('Product Design & UX');
    if (hasDataAI) domains.push('Data & AI Engineering');
    if (hasSales) domains.push('Enterprise Sales & Revenue');
    if (hasGrowthOps) domains.push('Growth & Operations');
  }

  if (domains.length === 0) {
    domains.push(targetPrimary || 'Technology & Product');
  }

  const primaryDomain = domains[0];

  // 2. Detect Business Models & Industry Context
  const businessModels: string[] = [];
  if (/saas|subscription|arr|mrr|acv/i.test(allExpText)) businessModels.push('B2B SaaS');
  if (/enterprise|fortune|b2b/i.test(allExpText)) businessModels.push('Enterprise B2B');
  if (/consumer|b2c|dtc|marketplace/i.test(allExpText)) businessModels.push('B2C / Marketplace');
  if (/fintech|payments|banking|financial/i.test(allExpText)) businessModels.push('FinTech');
  if (/developer tools|devtools|infrastructure|api/i.test(allExpText))
    businessModels.push('Developer Tooling');

  // 3. Detect Leadership & Startup Exposure
  const leadershipExposure =
    /lead|head of|director|vp|vice president|manager|founded|co-founder|mentored|built team/i.test(
      allExpText
    );
  const startupExposure =
    /0 to 1|seed|series a|series b|startup|founding engineer|early-stage|venture/i.test(allExpText);

  // 4. Career Progression Chain
  const recentTitles = experiences.map((e) => e.title).filter(Boolean);
  const recentCompanies = experiences.map((e) => e.company).filter(Boolean);
  const progressionList = [...recentTitles].reverse();
  const careerProgression =
    progressionList.length > 0 ? progressionList.join(' → ') : profile.rolePreferences?.currentTitle || profile.personalInfo?.headline || (profile as any).headline || '';

  // 5. Generalized Location & Country Model (Not hardcoded to any country)
  const homeCountry =
    profile.locationAndAuth?.currentCountry ||
    profile.personalInfo?.country ||
    'United States';
  const homeCity = profile.locationAndAuth?.currentCity || profile.personalInfo?.city || '';
  const homeRegion = profile.personalInfo?.stateProvince || '';

  const workplaceTypes = profile.workPreferences?.workplaceTypes || [];
  const prefersRemote = workplaceTypes.includes('remote') || workplaceTypes.length === 0;
  const prefersHybrid = workplaceTypes.includes('hybrid');
  const prefersOnSite = workplaceTypes.includes('on-site');

  let remotePreference: 'remote_first' | 'flexible' | 'on_site_only' = 'remote_first';
  if (prefersOnSite && !prefersRemote) {
    remotePreference = 'on_site_only';
  } else if (prefersHybrid || (prefersRemote && prefersOnSite)) {
    remotePreference = 'flexible';
  }

  const wfaEligible = prefersRemote;

  const configuredMarkets =
    profile.workPreferences?.targetLocations && profile.workPreferences.targetLocations.length > 0
      ? profile.workPreferences.targetLocations
      : [homeCountry, prefersRemote ? 'Remote Worldwide / Work From Anywhere' : ''].filter(Boolean);

  const isWorldwideAllowed = configuredMarkets.some(
    (m) =>
      m.toLowerCase().includes('worldwide') ||
      m.toLowerCase().includes('anywhere') ||
      m.toLowerCase().includes('wfa')
  );

  const displayLocationSummary = configuredMarkets.join(' · ');

  // 6. Generalized Compensation Model
  const currency = profile.compensation?.currency || 'USD';
  const minBase = profile.compensation?.minBaseSalary || 0;
  const targetBase = profile.compensation?.targetBaseSalary || 0;
  const hasStatedExpectations = minBase > 0 || targetBase > 0;

  const symbol = currency === 'INR' ? '₹' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  let formattedRange = 'Flexible';
  if (currency === 'INR') {
    if (minBase && targetBase) {
      formattedRange = `₹${(minBase / 100000).toFixed(0)}L – ₹${(targetBase / 100000).toFixed(0)}L`;
    } else if (minBase) {
      formattedRange = `₹${(minBase / 100000).toFixed(0)}L+`;
    }
  } else {
    if (minBase && targetBase) {
      formattedRange = `${symbol}${Math.round(minBase / 1000)}k – ${symbol}${Math.round(targetBase / 1000)}k`;
    } else if (minBase) {
      formattedRange = `${symbol}${Math.round(minBase / 1000)}k+`;
    }
  }

  // 7. Contextual Profile Gaps for Discovery
  const profileGapsForDiscovery: string[] = [];
  if (!profile.rolePreferences?.targetPrimaryTitle && (profile.rolePreferences?.targetJobTitles || []).length === 0) {
    profileGapsForDiscovery.push('Specify target job titles in Profile to sharpen recommendations');
  }
  if (workplaceTypes.length === 0) {
    profileGapsForDiscovery.push('Set remote / hybrid preference in Profile');
  }

  // 8. Integrate Learned Preferences (if available)
  const targetIndustries = [
    ...(profile.targetMarkets?.targetIndustries || []),
    ...(learned ? Object.keys(learned.preferredIndustries || {}) : []),
  ];

  return {
    fullName: profile.personalInfo?.fullName || '',
    headline: profile.personalInfo?.headline || (profile as any).headline || '',
    summary: profile.professionalSummary?.summaryText || '',
    primaryDomain,
    functionalDomains: domains,
    businessModels,
    careerProgression,
    leadershipExposure,
    startupExposure,
    totalYearsExperience: profile.rolePreferences?.totalYearsExperience || experiences.length * 2,
    seniorityLevel: profile.rolePreferences?.experienceLevel || 'senior',
    recentTitles,
    recentCompanies,
    keyAchievements: experiences.flatMap((e) => e.keyAchievements || []),
    allSkills: [
      ...(profile.skills?.technicalSkills || []),
      ...(profile.skills?.softSkills || []),
      ...(profile.skills?.toolsAndPlatforms || []),
    ],
    coreTools: profile.skills?.toolsAndPlatforms || [],
    certifications: (profile.certifications || []).map((c) => c.name),
    locationModel: {
      homeCountry,
      homeCity,
      homeRegion,
      localMarketName: `${homeCountry} Market`,
      remotePreference,
      wfaEligible,
      targetLocations: configuredMarkets,
      isWorldwideAllowed,
      displayLocationSummary,
    },
    compensationModel: {
      currency,
      minBaseSalary: minBase,
      targetBaseSalary: targetBase,
      formattedRange,
      hasStatedExpectations,
    },
    targetTitles: [
      profile.rolePreferences?.targetPrimaryTitle,
      ...(profile.rolePreferences?.targetJobTitles || []),
    ].filter(Boolean) as string[],
    targetIndustries,
    targetCompanies: profile.targetMarkets?.targetCompanies || [],
    careerGoals: {
      shortTerm: profile.careerGoals?.shortTermGoals || '',
      longTermVision: profile.careerGoals?.longTermVision || '',
      primaryMotivation: profile.careerGoals?.primaryMotivation || '',
    },
    profileGapsForDiscovery,
  };
}
