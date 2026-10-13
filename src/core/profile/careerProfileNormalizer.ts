/**
 * CareerOS Career Profile Normalizer
 *
 * Implements Section 2 of CareerOS Personal Job Discovery Engine:
 * USER PROFILE -> CAREER PROFILE NORMALIZATION
 *
 * Serves as the Canonical Profile Intelligence layer, transforming
 * raw UserProfile and resume data into a structured, normalized CareerProfile.
 * Generates primary, secondary, adjacent, and transferable role hierarchies,
 * role synonyms, skill/industry combinations, negative signals, and explicit
 * role confusion guards.
 */

import { UserProfile } from './types';
import { roleTaxonomyEngine } from '../jobs/engines/roleTaxonomyEngine';

export interface CareerProfile {
  candidateName: string;
  headline: string;
  summary: string;
  currentTitle: string;
  currentCompany: string;
  experienceLevel: 'entry' | 'mid' | 'senior' | 'lead' | 'manager' | 'director' | 'executive';
  totalYearsExperience: number;

  // Role Intelligence & Hierarchy
  targetPrimaryRole: string;
  targetJobTitles: string[];
  primaryRoles: string[];
  secondaryRoles: string[];
  adjacentRoles: string[];
  transferableRoles: string[];
  roleSynonyms: Record<string, string[]>;

  // Skills & Domain Context
  coreSkills: string[];
  toolsAndPlatforms: string[];
  softSkills: string[];
  skillKeywords: Set<string>;
  skillIndustryCombinations: string[];

  // Market & Location Preferences
  homeCountry: string;
  homeCity: string;
  targetLocations: string[];
  workplaceTypes: ('remote' | 'hybrid' | 'on-site')[];
  employmentTypes: string[];
  targetIndustries: string[];
  targetCompanies: string[];

  // Compensation
  minBaseSalary: number;
  salaryCurrency: string;

  // Negative Career Signals & Role Disambiguation
  negativeRoleSignals: string[];
  negativeCompanySignals: string[];
  confusionGuards: Array<{ role: string; excludePattern: string; explanation: string }>;

  normalizedAt: string;
}

/**
 * Standard negative signals to eliminate irrelevant, exploitative,
 * clerical, or wildly mismatched roles before they can reach the feed.
 */
export const CANONICAL_NEGATIVE_SIGNALS = [
  'telecaller',
  'telecalling',
  'telesales',
  'high-volume telesales',
  'inside sales executive',
  'call center',
  'bpo',
  'door-to-door',
  'door to door',
  'field sales representative',
  'commission-only',
  'commission only',
  'unpaid internship',
  'stipend only',
  'cold calling executive',
  'customer care executive',
  'medical representative',
  'data entry operator',
  'back office clerical',
  'civil engineer',
  'electrical engineer',
  'mechanical engineer',
  'chemical engineer',
  'structural engineer',
  'site supervisor',
  'hardware engineer',
  'embedded systems engineer',
  'robotics technician',
];

/**
 * Disambiguation rules preventing role confusion:
 * e.g., Account Executive vs AE Assistant, Growth vs Growth Intern,
 * Product Manager vs Project Coordinator, VP vs Sales Rep.
 */
export const CANONICAL_CONFUSION_GUARDS: Array<{
  role: string;
  excludePattern: string;
  explanation: string;
}> = [
  {
    role: 'Account Executive',
    excludePattern: 'assistant|trainee|apprentice|intern',
    explanation: 'Distinguishes senior Account Executive from assistant/trainee roles',
  },
  {
    role: 'Growth',
    excludePattern: 'growth intern|growth hacker intern|campus ambassador',
    explanation: 'Distinguishes Growth Lead/Manager from student internship roles',
  },
  {
    role: 'Product Manager',
    excludePattern: 'project coordinator|project tracker|pmo clerk',
    explanation: 'Distinguishes Product Management from administrative tracking roles',
  },
  {
    role: 'Operations',
    excludePattern: 'data entry|typing clerk|back office assistant',
    explanation: 'Distinguishes Business/Product Operations from low-level clerical data entry',
  },
  {
    role: 'Commercial Lead / VP',
    excludePattern: 'door to door|counter sales|van sales',
    explanation: 'Distinguishes Commercial/VP Sales leadership from manual retail/counter sales',
  },
];

/**
 * Parses and normalizes a candidate UserProfile into a canonical CareerProfile.
 */
export function normalizeCareerProfile(userProfile?: UserProfile): CareerProfile {
  const profile = userProfile || ({} as Partial<UserProfile>);

  const candidateName = profile.personalInfo?.fullName || 'Candidate';
  const headline = profile.personalInfo?.headline || '';
  const summary = profile.professionalSummary?.summaryText || '';
  const currentTitle = profile.rolePreferences?.currentTitle || 'Commercial & Revenue Professional';
  const currentCompany = profile.rolePreferences?.currentCompany || '';
  const experienceLevel = profile.rolePreferences?.experienceLevel || 'lead';
  const totalYearsExperience = profile.rolePreferences?.totalYearsExperience || 8;

  // Target roles
  const targetPrimaryRole =
    profile.rolePreferences?.targetPrimaryTitle ||
    'Head of Business Development / Director of Enterprise Sales';

  const userTargetTitles = profile.rolePreferences?.targetJobTitles || [
    'Head of Business Development',
    'Director of Enterprise Sales',
    'Senior Manager – Business Development & Strategic Partnerships',
    'Lead – Enterprise Business Development',
    'Growth & Revenue Lead',
    'Strategic Account Executive',
    'Director of Commercial Partnerships',
    'VP of Sales / Commercial Lead',
  ];

  // Derive taxonomy expansions
  const taxonomyExpansions = roleTaxonomyEngine.getRecommendedRoles(userTargetTitles);

  const primaryRoles = Array.from(
    new Set([targetPrimaryRole, ...userTargetTitles, ...taxonomyExpansions.primaryRoles])
  );

  const secondaryRoles = [
    'Business Operations',
    'Strategic Partnerships',
    'Growth Operations',
    'Commercial Strategy',
    'Enterprise Account Management',
  ];

  const adjacentRoles = Array.from(
    new Set([
      'Product Operations',
      'Chief of Staff',
      'Founder’s Office',
      'Revenue Operations',
      ...taxonomyExpansions.adjacentRoles,
    ])
  );

  const transferableRoles = Array.from(
    new Set([
      'Product Strategy',
      'Solutions Architecture',
      'Customer Success Leadership',
      ...taxonomyExpansions.transferableRoles,
    ])
  );

  // Synonyms mapping
  const roleSynonyms: Record<string, string[]> = {};
  primaryRoles.forEach((role) => {
    const syns = roleTaxonomyEngine.getSynonymsForRole(role);
    if (syns.length > 0) {
      roleSynonyms[role] = syns;
    }
  });

  // Skills
  const coreSkills = Array.from(
    new Set([
      ...(profile.skills?.technicalSkills || []),
      'B2B Sales',
      'Enterprise Sales',
      'Strategic Partnerships',
      'Business Development',
      'Revenue Operations',
      'Negotiation',
      'Pipeline Management',
    ])
  );

  const toolsAndPlatforms = Array.from(
    new Set([
      ...(profile.skills?.toolsAndPlatforms || []),
      'Salesforce',
      'HubSpot',
      'Apollo.io',
      'LinkedIn Sales Navigator',
    ])
  );

  const softSkills = profile.skills?.softSkills || [
    'Commercial Leadership',
    'Strategic Negotiation',
    'Cross-Functional Collaboration',
  ];

  const skillKeywords = new Set<string>();
  [...coreSkills, ...toolsAndPlatforms, ...softSkills].forEach((s) =>
    skillKeywords.add(s.toLowerCase().trim())
  );

  // Skill + Industry combinations
  const targetIndustries = profile.targetMarkets?.targetIndustries || [
    'B2B SaaS',
    'Enterprise Software',
    'FinTech',
    'AI & Automation',
    'Logistics & Supply Chain',
  ];

  const skillIndustryCombinations: string[] = [];
  coreSkills.slice(0, 5).forEach((sk) => {
    targetIndustries.slice(0, 3).forEach((ind) => {
      skillIndustryCombinations.push(`${sk} in ${ind}`);
    });
  });

  // Location & Workplace
  const homeCountry = profile.locationAndAuth?.currentCountry || profile.personalInfo?.country || 'India';
  const homeCity = profile.locationAndAuth?.currentCity || profile.personalInfo?.city || 'Delhi';

  const userPrefLocations = profile.workPreferences?.targetLocations || ['India', 'Worldwide Remote'];
  const targetLocations = Array.from(new Set(userPrefLocations));

  const workplaceTypes = profile.workPreferences?.workplaceTypes || ['remote', 'hybrid', 'on-site'];
  const employmentTypes = profile.workPreferences?.employmentTypes || ['full-time', 'contract'];

  const targetCompanies = Array.from(
    new Set([
      ...(profile.targetMarkets?.targetCompanies || []),
    ])
  );

  const minBaseSalary = profile.compensation?.minBaseSalary || 0;
  const salaryCurrency = profile.compensation?.currency || 'INR';

  return {
    candidateName,
    headline,
    summary,
    currentTitle,
    currentCompany,
    experienceLevel,
    totalYearsExperience,
    targetPrimaryRole,
    targetJobTitles: userTargetTitles,
    primaryRoles,
    secondaryRoles,
    adjacentRoles,
    transferableRoles,
    roleSynonyms,
    coreSkills,
    toolsAndPlatforms,
    softSkills,
    skillKeywords,
    skillIndustryCombinations,
    homeCountry,
    homeCity,
    targetLocations,
    workplaceTypes,
    employmentTypes,
    targetIndustries,
    targetCompanies,
    minBaseSalary,
    salaryCurrency,
    negativeRoleSignals: CANONICAL_NEGATIVE_SIGNALS,
    negativeCompanySignals: [],
    confusionGuards: CANONICAL_CONFUSION_GUARDS,
    normalizedAt: new Date().toISOString(),
  };
}
