/**
 * CareerOS Canonical SearchConfiguration
 *
 * Single Source of Truth for Candidate Discovery & Feed Filtering.
 * Directly derived from the Candidate Career Profile.
 *
 * Both Discovery Engine and Job Feed Filters consume this EXACT object.
 */

import { UserProfile } from '../profile/types';
import { roleTaxonomyEngine } from './engines/roleTaxonomyEngine';
import { locationFilterEngine } from './engines/locationFilterEngine';
import { targetCompaniesStore } from '../target-companies/targetCompanyStore';

export interface SearchConfiguration {
  targetRoles: string[];
  primaryRoles: string[];
  secondaryRoles: string[];
  adjacentRoles: string[];
  roleSynonyms: Record<string, string[]>;

  locations: string[]; // e.g. ['India', 'Worldwide Remote']
  remoteScopes: string[];
  workplaceTypes: ('remote' | 'hybrid' | 'on-site')[];

  seniority: string[];
  employmentTypes: string[];

  industries: string[];
  skills: string[];

  salaryMinimum: number;
  salaryCurrency: string;

  excludedRoles: string[];
  excludedIndustries: string[];
  excludedCompanies: string[];

  maxAgeDays: number; // Strictly 7 days by default
  minimumMatchScore: number;

  targetCompanies: string[];
  displaySummary: string;
}

/**
 * Standard negative career signals to exclude at the engine level
 * based on candidate's senior B2B / Commercial / Operations / Product trajectory.
 */
export const DEFAULT_EXCLUDED_ROLE_SIGNALS = [
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
 * Derives a canonical SearchConfiguration from a Candidate UserProfile.
 */
export function buildSearchConfiguration(profile?: UserProfile): SearchConfiguration {
  const targetPrimary = profile?.rolePreferences?.targetPrimaryTitle || 'Head of Business Development / Director of Enterprise Sales';
  const targetJobTitles = profile?.rolePreferences?.targetJobTitles || [
    'Head of Business Development',
    'Director of Enterprise Sales',
    'Senior Manager – Business Development & Strategic Partnerships',
    'Lead – Enterprise Business Development',
    'Growth & Revenue Lead',
    'Strategic Account Executive',
    'Director of Commercial Partnerships',
    'VP of Sales / Commercial Lead',
    'Product Management',
    'Product Operations',
    'Business Operations',
    'Chief of Staff',
    'Founder’s Office',
  ];

  // Infer primary, adjacent, and transferable roles through Role Taxonomy Engine
  const allTargetList = [targetPrimary, ...targetJobTitles].filter(Boolean);
  const spectrum = roleTaxonomyEngine.inferRoleSpectrum(allTargetList);

  const primaryRoles = Array.from(new Set([targetPrimary, ...targetJobTitles]));
  const secondaryRoles = spectrum.transferableRoles || [];
  const adjacentRoles = spectrum.adjacentRoles || [];

  // Locations: normalized through locationFilterEngine
  const rawLocations = profile?.workPreferences?.targetLocations && profile.workPreferences.targetLocations.length > 0
    ? profile.workPreferences.targetLocations
    : ['India', 'Worldwide Remote'];
  const locations = locationFilterEngine.normalizeTargetLocations(rawLocations);

  // Workplace types: default to remote + hybrid + on-site if none specified
  const workplaceTypes = (profile?.workPreferences?.workplaceTypes || ['remote', 'hybrid', 'on-site']) as ('remote' | 'hybrid' | 'on-site')[];

  // Experience level
  const expLevel = profile?.rolePreferences?.experienceLevel || 'lead';
  const seniorityLevels = ['senior', 'lead', 'director', 'manager'];
  if (expLevel === 'executive') seniorityLevels.push('executive');
  if (expLevel === 'mid') seniorityLevels.unshift('mid');

  // Skills
  const skills = [
    ...(profile?.skills?.technicalSkills || []),
    ...(profile?.skills?.toolsAndPlatforms || []),
  ];

  // Target Companies from Profile and Target Companies Store
  const userTargetCompanies = [
    ...(profile?.targetMarkets?.targetCompanies || []),
    ...targetCompaniesStore.getCompanies().map((c) => c.name),
  ];
  const uniqueTargetCompanies = Array.from(new Set(userTargetCompanies.filter(Boolean)));

  // Role synonyms mapping
  const roleSynonyms: Record<string, string[]> = {};
  primaryRoles.forEach((role) => {
    const occ = roleTaxonomyEngine.findOccupation(role);
    if (occ) {
      roleSynonyms[role] = [occ.preferredTitle, ...occ.alternateTitles.slice(0, 5)];
    }
  });

  return {
    targetRoles: primaryRoles,
    primaryRoles,
    secondaryRoles,
    adjacentRoles,
    roleSynonyms,

    locations: locations.length > 0 ? locations : ['India', 'Worldwide Remote'],
    remoteScopes: ['worldwide', 'india'],
    workplaceTypes: workplaceTypes.length > 0 ? workplaceTypes : ['remote', 'hybrid', 'on-site'],

    seniority: seniorityLevels,
    employmentTypes: ['full-time', 'contract'],

    industries: profile?.targetMarkets?.targetIndustries || ['Technology', 'B2B SaaS', 'Enterprise Software', 'FinTech'],
    skills,

    salaryMinimum: profile?.compensation?.minBaseSalary || 0,
    salaryCurrency: profile?.compensation?.currency || 'INR',

    excludedRoles: DEFAULT_EXCLUDED_ROLE_SIGNALS,
    excludedIndustries: [],
    excludedCompanies: [],

    maxAgeDays: 7, // Core Rule 1: Maximum active lifetime of 7 days
    minimumMatchScore: 55, // Strict threshold before Active Feed

    targetCompanies: uniqueTargetCompanies,
    displaySummary: `${primaryRoles.slice(0, 3).join(', ')} • ${(locations.length > 0 ? locations : ['India', 'Worldwide Remote']).slice(0, 2).join(' / ')} • ${(workplaceTypes.length > 0 ? workplaceTypes : ['remote', 'hybrid']).join('/')}`,
  };
}
